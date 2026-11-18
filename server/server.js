'use strict';
/*
 * Server lokal opsional untuk Klinik HAP:
 *  - menyajikan berkas web (index.html, css/, js/, img/)
 *  - POST /api/send  : kirim email lewat SMTP perusahaan (tombol "Kirim Langsung")
 *  - GET  /api/health: status pengiriman
 * Data kunjungan TIDAK pernah dikirim ke server ini; hanya isi email yang dikirim.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

function loadEnv(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return; }
  text.split(/\r?\n/).forEach((line) => {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) return;
    let v = m[2];
    if (/^(".*"|'.*')$/.test(v)) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  });
}
loadEnv(path.join(__dirname, '.env'));

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const MAX_BODY = 256 * 1024;
const EMAIL_RE = /^[^\s@,;<>()]+@[^\s@,;<>()]+\.[^\s@,;<>()]+$/;
const ALLOWED_DOMAINS = (process.env.ALLOWED_DOMAINS || '')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

function createTransport() {
  const nodemailer = require('nodemailer');
  if (process.env.SMTP_HOST) {
    return {
      mode: 'smtp',
      transport: nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' } : undefined
      })
    };
  }
  if (process.env.MAIL_DRY_RUN === '1') {
    return { mode: 'dry-run', transport: nodemailer.createTransport({ jsonTransport: true }) };
  }
  return null;
}

/* Membuka draf di Outlook classic (desktop) lewat COM PowerShell. Hanya Windows + Outlook classic.
 * Data dikirim lewat stdin sebagai base64 (aman untuk karakter khusus; tidak ada interpolasi ke perintah). */
const PS_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  "$raw = [Console]::In.ReadToEnd().Trim()",
  "$j = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($raw)) | ConvertFrom-Json",
  "$ol = New-Object -ComObject Outlook.Application",
  "$m = $ol.CreateItem(0)",
  "$m.To = [string]$j.to; $m.CC = [string]$j.cc; $m.Subject = [string]$j.subject; $m.Body = [string]$j.text",
  "$m.Display()"
].join('\n');

function openInOutlookClassic(mail) {
  return new Promise((resolve, reject) => {
    const { spawn } = require('node:child_process');
    const enc = Buffer.from(PS_SCRIPT, 'utf16le').toString('base64');
    const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', enc],
      { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
    let err = '';
    const timer = setTimeout(() => { ps.kill(); reject(new Error('Outlook tidak merespons.')); }, 30000);
    ps.stderr.on('data', (d) => { err += d; });
    ps.on('error', (e) => { clearTimeout(timer); reject(e); });
    ps.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(); else reject(new Error(err.trim().split('\n')[0] || 'Outlook gagal dibuka (kode ' + code + ').'));
    });
    ps.stdin.end(Buffer.from(JSON.stringify(mail), 'utf8').toString('base64'));
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'"
};

function sendJson(res, status, obj) {
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, SECURITY_HEADERS));
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error('Isi terlalu besar.'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parseList(s) { return String(s || '').split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean); }

function validateMail(b, opts) {
  const requireTo = !opts || opts.requireTo !== false;
  if (!b || typeof b !== 'object') return 'Permintaan tidak valid.';
  const to = parseList(b.to), cc = parseList(b.cc);
  if (requireTo && !to.length) return 'Alamat tujuan wajib diisi.';
  if (to.length + cc.length > 10) return 'Terlalu banyak penerima.';
  for (const a of to.concat(cc)) {
    if (!EMAIL_RE.test(a)) return 'Alamat email tidak valid: ' + a;
    if (ALLOWED_DOMAINS.length && !ALLOWED_DOMAINS.includes(a.split('@')[1].toLowerCase())) {
      return 'Domain penerima tidak diizinkan: ' + a;
    }
  }
  if (typeof b.subject !== 'string' || !b.subject.trim() || b.subject.length > 300 || /[\r\n]/.test(b.subject)) return 'Subjek tidak valid.';
  if (typeof b.text !== 'string' || !b.text.trim() || b.text.length > 20000) return 'Isi email tidak valid.';
  return null;
}

function createServer(mailer, opts) {
  const opener = opts && 'opener' in opts ? opts.opener : (process.platform === 'win32' ? openInOutlookClassic : null);
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');

      if (url.pathname === '/api/health' && req.method === 'GET') {
        return sendJson(res, 200, { ok: true, canSend: !!mailer, dryRun: !!mailer && mailer.mode === 'dry-run', canOutlook: !!opener });
      }

      if (url.pathname === '/api/send' || url.pathname === '/api/outlook') {
        const isOutlook = url.pathname === '/api/outlook';
        if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'Metode tidak diizinkan.' });
        // tolak permintaan dari situs lain (CSRF): Origin harus sama dengan Host
        const origin = req.headers.origin;
        if (origin) {
          let oh = ''; try { oh = new URL(origin).host; } catch (e) { /* kosong */ }
          if (oh !== req.headers.host) return sendJson(res, 403, { ok: false, error: 'Asal permintaan ditolak.' });
        }
        if (isOutlook && !opener) return sendJson(res, 501, { ok: false, error: 'Buka-langsung di Outlook hanya tersedia di Windows dengan Outlook classic.' });
        if (!isOutlook && !mailer) return sendJson(res, 503, { ok: false, error: 'SMTP belum dikonfigurasi (lihat server/.env.example).' });
        if (!/^application\/json/i.test(req.headers['content-type'] || '')) return sendJson(res, 415, { ok: false, error: 'Content-Type harus application/json.' });
        let body;
        try { body = JSON.parse(await readBody(req)); } catch (e) {
          return sendJson(res, e.status || 400, { ok: false, error: e.status ? e.message : 'JSON tidak valid.' });
        }
        const problem = validateMail(body, { requireTo: !isOutlook });
        if (problem) return sendJson(res, 400, { ok: false, error: problem });
        if (isOutlook) {
          try {
            await opener({ to: parseList(body.to).join(';'), cc: parseList(body.cc).join(';'), subject: body.subject, text: body.text });
            return sendJson(res, 200, { ok: true });
          } catch (e) {
            console.error('Gagal membuka Outlook:', e.message);
            return sendJson(res, 502, { ok: false, error: 'Outlook classic tidak bisa dibuka otomatis. Pastikan Outlook terpasang dan tidak dijalankan sebagai Administrator. (' + String(e.message).slice(0, 120) + ')' });
          }
        }
        try {
          const info = await mailer.transport.sendMail({
            from: process.env.MAIL_FROM || process.env.SMTP_USER || 'klinik@localhost',
            to: parseList(body.to), cc: parseList(body.cc).length ? parseList(body.cc) : undefined,
            subject: body.subject, text: body.text
          });
          if (mailer.mode === 'dry-run') console.log('[dry-run] email ke', body.to, '|', body.subject);
          return sendJson(res, 200, { ok: true, messageId: info.messageId || null });
        } catch (e) {
          console.error('Gagal kirim email:', e.code || '', e.message);
          return sendJson(res, 502, { ok: false, error: 'Gagal mengirim email ke server SMTP. Periksa pengaturan server/.env dan koneksi.' });
        }
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { ok: false, error: 'Metode tidak diizinkan.' });

      // berkas statis: hanya index.html, css/, js/, img/
      let rel;
      try { rel = decodeURIComponent(url.pathname); } catch (e) { rel = ''; }
      if (rel === '/') rel = '/index.html';
      const allowed = rel === '/index.html' || /^\/(css|js|img)\/[^/]+$/.test(rel);
      const file = path.join(ROOT, rel);
      if (!allowed || !file.startsWith(ROOT + path.sep) || !MIME[path.extname(file).toLowerCase()]) {
        res.writeHead(404, SECURITY_HEADERS); return res.end('Tidak ditemukan');
      }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404, SECURITY_HEADERS); return res.end('Tidak ditemukan'); }
        res.writeHead(200, Object.assign({ 'Content-Type': MIME[path.extname(file).toLowerCase()], 'Cache-Control': 'no-cache' }, SECURITY_HEADERS));
        res.end(req.method === 'HEAD' ? undefined : data);
      });
    } catch (e) {
      console.error(e);
      sendJson(res, 500, { ok: false, error: 'Kesalahan server.' });
    }
  });
}

module.exports = { createServer, createTransport, validateMail, openInOutlookClassic };

if (require.main === module) {
  const mailer = createTransport();
  createServer(mailer).listen(PORT, HOST, () => {
    console.log('Klinik HAP berjalan di http://' + (HOST === '0.0.0.0' ? 'localhost' : HOST) + ':' + PORT);
    console.log(mailer
      ? (mailer.mode === 'smtp' ? 'Pengiriman email: SMTP ' + process.env.SMTP_HOST : 'Pengiriman email: MODE UJI (tidak benar-benar dikirim)')
      : 'Pengiriman email: tidak aktif (tanpa SMTP). Email tetap bisa dibuka lewat aplikasi email.');
  });
}
