'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const nodemailer = require('nodemailer');
const { createServer } = require('../server/server.js');

function listen(mailer) {
  return new Promise((resolve) => {
    const srv = createServer(mailer).listen(0, '127.0.0.1', () => resolve({ srv, base: 'http://127.0.0.1:' + srv.address().port }));
  });
}
const good = { to: 'a@contoh.co.id', cc: 'b@contoh.co.id', subject: 'Uji', text: 'Isi' };
const post = (base, body, headers) => fetch(base + '/api/send', {
  method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, headers), body: JSON.stringify(body)
});

test('tanpa SMTP: health menyatakan tidak bisa kirim, send -> 503', async () => {
  const { srv, base } = await listen(null);
  try {
    const h = await (await fetch(base + '/api/health')).json();
    assert.equal(h.canSend, false); assert.equal(h.dryRun, false);
    assert.equal((await post(base, good)).status, 503);
  } finally { srv.close(); }
});

test('mode uji: validasi, kirim sukses, dan penolakan permintaan buruk', async () => {
  const mailer = { mode: 'dry-run', transport: nodemailer.createTransport({ jsonTransport: true }) };
  const { srv, base } = await listen(mailer);
  const origLog = console.log; console.log = () => {};
  try {
    assert.equal((await (await fetch(base + '/api/health')).json()).dryRun, true);
    const ok = await post(base, good);
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).ok, true);
    assert.equal((await post(base, Object.assign({}, good, { to: '' }))).status, 400);
    assert.equal((await post(base, Object.assign({}, good, { to: 'bukan-email' }))).status, 400);
    assert.equal((await post(base, Object.assign({}, good, { subject: 'A\r\nBcc: x@y.id' }))).status, 400);
    assert.equal((await post(base, Object.assign({}, good, { text: '' }))).status, 400);
    // CSRF: Origin situs lain ditolak
    assert.equal((await post(base, good, { Origin: 'https://jahat.example' })).status, 403);
    // Origin yang sama diterima
    assert.equal((await post(base, good, { Origin: base })).status, 200);
    assert.equal((await fetch(base + '/api/send')).status, 405);
  } finally { console.log = origLog; srv.close(); }
});

test('berkas statis: hanya yang diizinkan; .env, server/, package.json, traversal ditolak', async () => {
  const { srv, base } = await listen(null);
  try {
    const idx = await fetch(base + '/');
    assert.equal(idx.status, 200);
    assert.match(await idx.text(), /Klinik HAP/);
    assert.equal((await fetch(base + '/js/app.js')).status, 200);
    assert.equal((await fetch(base + '/css/style.css')).status, 200);
    for (const p of ['/server/server.js', '/server/.env', '/package.json', '/.env', '/js/../package.json',
      '/%2e%2e/package.json', '/js/%2e%2e/server/server.js', '/test/email.test.js', '/node_modules/nodemailer/package.json']) {
      const r = await fetch(base + p);
      assert.equal(r.status, 404, p + ' seharusnya 404');
    }
    assert.ok((await fetch(base + '/')).headers.get('content-security-policy'));
  } finally { srv.close(); }
});

test('isi permintaan > 256 KB ditolak (413) atau koneksi diputus', async () => {
  const mailer = { mode: 'dry-run', transport: nodemailer.createTransport({ jsonTransport: true }) };
  const { srv, base } = await listen(mailer);
  const http = require('node:http');
  try {
    const outcome = await new Promise((resolve) => {
      const req = http.request(base + '/api/send', { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
        res.resume(); resolve(res.statusCode);
      });
      req.on('error', () => resolve('putus'));
      req.end(JSON.stringify(Object.assign({}, good, { text: 'x'.repeat(300 * 1024) })));
    });
    assert.ok(outcome === 413 || outcome === 'putus', 'hasil: ' + outcome);
  } finally { srv.close(); }
});

test('/api/outlook: memanggil pembuka Outlook dengan data bersih; tolak CSRF & input buruk; 501 bila tidak didukung', async () => {
  const calls = [];
  const srv1 = await new Promise((r) => { const s = createServer(null, { opener: async (m) => { calls.push(m); } }).listen(0, '127.0.0.1', () => r(s)); });
  const base = 'http://127.0.0.1:' + srv1.address().port;
  const post2 = (b, h) => fetch(base + '/api/outlook', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, h), body: JSON.stringify(b) });
  try {
    assert.equal((await (await fetch(base + '/api/health')).json()).canOutlook, true);
    const r = await post2({ to: 'a@x.id, b@x.id', cc: 'c@x.id', subject: 'Uji', text: 'Isi \u2013 \"kutip\" $(rm) `x`' });
    assert.equal(r.status, 200);
    assert.deepEqual(calls[0], { to: 'a@x.id;b@x.id', cc: 'c@x.id', subject: 'Uji', text: 'Isi \u2013 \"kutip\" $(rm) `x`' });
    assert.equal((await post2({ to: '', subject: 'Uji', text: 'Isi' })).status, 200);   // tujuan boleh kosong
    assert.equal((await post2({ to: 'salah', subject: 'Uji', text: 'Isi' })).status, 400);
    assert.equal((await post2({ to: 'a@x.id', subject: 'A\nB', text: 'Isi' })).status, 400);
    assert.equal((await post2({ to: 'a@x.id', subject: 'Uji', text: 'Isi' }, { Origin: 'https://jahat.example' })).status, 403);
  } finally { srv1.close(); }
  const srv2 = await new Promise((r) => { const s = createServer(null, { opener: null }).listen(0, '127.0.0.1', () => r(s)); });
  try {
    const r = await fetch('http://127.0.0.1:' + srv2.address().port + '/api/outlook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(r.status, 501);
  } finally { srv2.close(); }
  const srv3 = await new Promise((r) => { const s = createServer(null, { opener: async () => { throw new Error('boom'); } }).listen(0, '127.0.0.1', () => r(s)); });
  const origErr = console.error; console.error = () => {};
  try {
    const r = await fetch('http://127.0.0.1:' + srv3.address().port + '/api/outlook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: 'a@x.id', subject: 'U', text: 'I' }) });
    assert.equal(r.status, 502);
  } finally { console.error = origErr; srv3.close(); }
});
