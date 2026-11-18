const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/surat.js');
const E = require('../js/email.js');
const SHA = require('../js/sha256.js');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');

const visit = {
  name: 'Budi Santoso', nik: '0012345', dept: 'QSHE', doctor: 'dr. Indah', doctorSip: '440/1/SIP/2026', nurse: 'Eny',
  suratNo: '007/SKS/QSHE-HAP/XI/2026', visitAt: new Date(2026, 10, 18, 10, 12).toISOString(),
  recommendation: 'SICK', restDays: 3, diagnosis: 'Faringitis', complaint: 'batukX'
};
const settings = { companyName: 'PT Hexindo Adiperkasa Tbk', address: 'Jl. Pulo Kambing II Kav. I-II No. 33, Jakarta Timur 13930', phone: '(021) 461 1688', verifySecret: 'rahasia' };

test('sha256 cocok dengan crypto bawaan Node', () => {
  const c = require('node:crypto');
  for (const t of ['', 'abc', 'Klinik é ✓'.repeat(20)]) assert.equal(SHA.hex(t), c.createHash('sha256').update(t).digest('hex'));
});

test('kode verifikasi stabil, berubah bila data/rahasia berubah', () => {
  const c1 = S.verifyCode(visit, 'rahasia');
  assert.match(c1, /^[0-9A-F]{4}-[0-9A-F]{4}$/);
  assert.equal(c1, S.verifyCode(visit, 'rahasia'));
  assert.notEqual(c1, S.verifyCode(Object.assign({}, visit, { restDays: 4 }), 'rahasia'));
  assert.notEqual(c1, S.verifyCode(visit, 'lain'));
});

test('PDF surat: valid, memuat kop/nomor/dokter dan diagnosis', () => {
  const r = S.build(visit, settings, { lang: 'id' });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sk-')), f = path.join(dir, 'a.pdf');
  fs.writeFileSync(f, r.bytes);
  assert.equal(Buffer.from(r.bytes.slice(0, 5)).toString(), '%PDF-');
  let txt = '';
  try { txt = execFileSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf8' }); } catch (e) { return; } // pdftotext opsional
  for (const w of ['PELAYANAN KESEHATAN', 'SURAT KETERANGAN SAKIT', '007/SKS/QSHE-HAP/XI/2026', 'Budi Santoso', 'dr. Indah',
    'Pulo Kambing', 'Diagnosis', 'Faringitis', 'tanda tangan basah', r.code]) assert.ok(txt.includes(w), 'tidak memuat: ' + w);
  assert.ok(!/batukX/.test(txt)); // keluhan tidak ikut
  assert.equal(r.filename, 'Surat-Sakit-007-SKS-QSHE-HAP-XI-2026.pdf');
});

test('QR: tautan verifikasi bila diisi, teks ringkas bila tidak', () => {
  const code = S.verifyCode(visit, 'x');
  assert.match(S.qrPayload(visit, {}, code), /^HEXINDO - SURAT KETERANGAN SAKIT\nNo: 007\/SKS\/QSHE-HAP\/XI\/2026\n/);
  assert.equal(S.qrPayload(visit, { verifyUrl: 'https://x.id/app/#abc' }, code), 'https://x.id/app/#v=007%2FSKS%2FQSHE-HAP%2FXI%2F2026|' + code);
  assert.ok(!/Faringitis/.test(S.qrPayload(visit, {}, code)));
});

test('surat hanya untuk istirahat sakit bernomor; versi English', () => {
  assert.throws(() => S.build(Object.assign({}, visit, { recommendation: 'FIT' }), settings, {}), /istirahat sakit/);
  assert.ok(S.build(visit, settings, { lang: 'en' }).bytes.length > 1000);
});

test('.eml dengan lampiran PDF: multipart/mixed berisi alternatif + application/pdf', () => {
  const pdf = S.build(visit, settings, {});
  const eml = E.toEml({ to: 'a@x.id', subject: 'Uji', body: 'Isi', html: '<p>Isi</p>', attachment: { name: pdf.filename, bytes: pdf.bytes } });
  assert.match(eml, /Content-Type: multipart\/mixed; boundary=/);
  assert.match(eml, /multipart\/alternative/);
  assert.match(eml, /Content-Disposition: attachment; filename="Surat-Sakit-007-SKS-QSHE-HAP-XI-2026\.pdf"/);
  const m = /filename="[^"]+"\r\n\r\n([A-Za-z0-9+/=\r\n]+)\r\n--/.exec(eml);
  assert.equal(Buffer.from(m[1].replace(/\s/g, ''), 'base64').slice(0, 5).toString(), '%PDF-');
  assert.ok(!/multipart\/mixed/.test(E.toEml({ to: 'a@x.id', subject: 'Uji', body: 'Isi' })));
});

test('tanda tangan digital dokter: gambar JPEG ikut di PDF di atas nama dokter', () => {
  const jpeg = new Uint8Array(Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAEAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==', 'base64'));
  const v = { visitAt: new Date(2026, 10, 18, 10, 12).toISOString(), nik: 'T1', name: 'Rosiana R', dept: 'QSHE', doctor: 'dr. Indah', recommendation: 'SICK', restDays: 2, suratNo: '001/SKS/QSHE-HAP/XI/2026' };
  const a = S.build(v, {}, { lang: 'id', secret: 'x', logo: null });
  const b = S.build(v, {}, { lang: 'id', secret: 'x', logo: null, signature: { bytes: jpeg, width: 8, height: 4 } });
  const cnt = (r) => Buffer.from(r.bytes).toString('latin1').split('/Subtype /Image').length - 1;
  assert.equal(cnt(a), 0); assert.equal(cnt(b), 1); assert.equal(a.code, b.code);
});
