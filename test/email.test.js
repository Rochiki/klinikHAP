'use strict';
process.env.TZ = 'Asia/Jakarta';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/email.js');

const FOOTER = 'Punya keluhan atau saran pengembangan layanan? Silakan input melalui https://s.id/klinikHAP';

function visit(over) {
  return Object.assign({
    suratNo: 'SK/KLL/20261118/001',
    visitAt: new Date(2026, 10, 18, 9, 16).toISOString(),
    checkOutAt: new Date(2026, 10, 18, 9, 42).toISOString(),
    name: 'Budi Santoso', nik: '0012345', dept: 'Service',
    workerEmail: 'budi@contoh.co.id', supervisorName: 'Ibu Sari', supervisorEmail: 'sari@contoh.co.id',
    hrdEmail: 'hrd@contoh.co.id, hrd2@contoh.co.id',
    doctor: 'dr. Andi', nurse: 'Ns. Rina',
    complaint: 'Demam dan batuk 3 hari\nRiwayat alergi: tidak ada',
    medications: '1. Paracetamol 500 mg 3x1\n- Vitamin C 1x1',
    recommendation: 'SICK', restDays: 2, restStart: '', referralTo: ''
  }, over || {});
}
const settings = { clinicName: 'Klinik HAP', nurseName: 'Ns. Default', ccAlways: 'arsip@contoh.co.id' };

test('nomor surat mengikuti format SK/KLL/YYYYMMDD/XXX', () => {
  assert.equal(E.buildSuratNo('SK/KLL', new Date(2026, 10, 18), 1), 'SK/KLL/20261118/001');
  assert.equal(E.buildSuratNo('SK/KLL', new Date(2026, 0, 5), 42), 'SK/KLL/20260105/042');
  assert.equal(E.buildSuratNo('SK/KLL', new Date(2026, 0, 5), 1234), 'SK/KLL/20260105/1234');
});

test('kedua email diakhiri persis dengan teks umpan balik', () => {
  const m = E.buildEmails(visit(), settings);
  for (const k of ['worker', 'boss']) {
    assert.ok(m[k].body.endsWith(FOOTER), k + ' harus berakhir dengan teks umpan balik');
  }
});

test('email pekerja memuat ringkasan, dokter, status, no. surat', () => {
  const b = E.buildEmails(visit(), settings).worker.body;
  assert.match(b, /Budi Santoso/);
  assert.match(b, /Jam masuk - keluar: 09:16 - 09:42/);
  assert.match(b, /Rabu, 18 November 2026/);
  assert.match(b, /Dokter pemeriksa: dr\. Andi/);
  assert.match(b, /Demam dan batuk 3 hari/);
  assert.match(b, /- Paracetamol 500 mg 3x1/);
  assert.match(b, /- Vitamin C 1x1/);
  assert.match(b, /Istirahat Sakit \/ Sick Leave/);
  assert.match(b, /2 hari \(18 November 2026 s\.d\. 19 November 2026\)/);
  assert.match(b, /No\. SK\/KLL\/20261118\/001 telah diserahkan langsung kepada Anda di klinik/);
});

test('email atasan TIDAK membocorkan diagnosis, obat, atau tujuan rujukan', () => {
  const v = visit({ referralTo: 'RS Rahasia', recommendation: 'REFER', restDays: 0 });
  const b = E.buildEmails(v, settings).boss.body;
  for (const secret of ['Demam', 'batuk', 'alergi', 'Paracetamol', 'Vitamin', 'RS Rahasia', 'dr. Andi']) {
    assert.ok(!b.includes(secret), 'bocor: ' + secret);
  }
  assert.match(b, /Nama: Budi Santoso/);
  assert.match(b, /NIK: 0012345/);
  assert.match(b, /Departemen: Service/);
  assert.match(b, /Jam masuk - keluar: 09:16 - 09:42/);
  assert.match(b, /Rujukan Lanjutan/);
  assert.match(b, /telah diserahkan langsung kepada yang bersangkutan/);
});

test('email atasan memuat durasi istirahat tetapi tanpa diagnosis', () => {
  const m = E.buildEmails(visit(), settings);
  assert.match(m.boss.body, /Durasi istirahat: 2 hari/);
  assert.ok(!m.boss.subject.includes('Demam'));
  assert.equal(m.boss.to, 'sari@contoh.co.id');
  assert.equal(m.boss.cc, 'hrd@contoh.co.id, hrd2@contoh.co.id, arsip@contoh.co.id');
  assert.equal(m.worker.to, 'budi@contoh.co.id');
  assert.equal(m.worker.cc, 'arsip@contoh.co.id');
});

test('fit to work tidak menampilkan durasi istirahat; 1 hari tidak memakai rentang', () => {
  const fit = E.buildEmails(visit({ recommendation: 'FIT', restDays: 0 }), settings);
  assert.ok(!/Durasi istirahat/.test(fit.worker.body));
  assert.ok(!/Durasi istirahat/.test(fit.boss.body));
  assert.match(fit.worker.body, /layak kembali bekerja/);
  const one = E.buildEmails(visit({ restDays: 1 }), settings);
  assert.match(one.worker.body, /Durasi istirahat: 1 hari \(18 November 2026\)/);
});

test('istirahat dapat mulai di tanggal lain & melewati pergantian bulan', () => {
  const r = E.restRange(visit({ restDays: 3, restStart: '2026-11-29' }));
  assert.equal(E.restText(r), '3 hari (29 November 2026 s.d. 1 Desember 2026)');
  assert.equal(E.restRange(visit({ recommendation: 'FIT' })), null);
  assert.equal(E.restRange(visit({ restDays: 0 })), null);
});

test('tanpa obat dan tanpa email: tetap menghasilkan draf yang wajar', () => {
  const m = E.buildEmails(visit({ medications: '', workerEmail: '', supervisorEmail: '', supervisorName: '' }), {});
  assert.match(m.worker.body, /Obat yang diresepkan: Tidak ada obat yang diresepkan/);
  assert.match(m.boss.body, /Bapak\/Ibu Atasan \/ HRD/);
  assert.equal(m.worker.to, '');
  assert.equal(m.worker.cc, '');
});

test('validasi email & pemisah daftar', () => {
  assert.ok(E.isEmail('a@b.co'));
  assert.ok(!E.isEmail('a@b'));
  assert.ok(!E.isEmail('a b@c.id'));
  assert.deepEqual(E.splitEmails('a@b.co; c@d.id ,e@f.id'), ['a@b.co', 'c@d.id', 'e@f.id']);
});

test('mailto meng-encode subjek dan isi (termasuk baris baru & karakter khusus)', () => {
  const u = E.mailtoUrl({ to: 'a@b.co', cc: 'c@d.id', subject: 'Halo & selamat', body: 'Baris 1\nBaris 2 100%' });
  assert.ok(u.startsWith('mailto:a@b.co?'));
  assert.match(u, /cc=c%40d\.id/);
  assert.match(u, /subject=Halo%20%26%20selamat/);
  assert.match(u, /body=Baris%201%0D%0ABaris%202%20100%25/);
});

test('.eml: header benar, subjek non-ASCII ter-encode, isi dapat didekode kembali', () => {
  const body = 'Terima kasih – Anda dinyatakan sehat.\nSalam';
  const eml = E.toEml({ to: 'a@b.co', cc: '', subject: 'Ringkasan – Kunjungan Klinik HAP – 18 November 2026', body });
  assert.match(eml, /^X-Unsent: 1\r\nTo: a@b\.co\r\nSubject: =\?UTF-8\?B\?/);
  assert.ok(!/\nCc:/.test(eml));
  const [head, payload] = eml.split('\r\n\r\n');
  assert.match(head, /Content-Transfer-Encoding: base64/);
  assert.equal(Buffer.from(payload.replace(/\r\n/g, ''), 'base64').toString('utf8'), body.replace(/\n/g, '\r\n'));
  head.split('\r\n').forEach((l) => assert.ok(l.length <= 78, 'baris header terlalu panjang: ' + l));
  const subj = head.match(/Subject: ([\s\S]*?)\r\nMIME/)[1].split('\r\n ').map((w) =>
    Buffer.from(w.replace(/^=\?UTF-8\?B\?/, '').replace(/\?=$/, ''), 'base64').toString('utf8')).join('');
  assert.equal(subj, 'Ringkasan – Kunjungan Klinik HAP – 18 November 2026');
});
