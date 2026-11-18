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
  assert.match(b, /Surat Keterangan Sakit dengan No\. SK\/KLL\/20261118\/001 telah diserahkan langsung kepada Anda di klinik/);
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
  assert.ok(!/Surat Keterangan|SK\/KLL/.test(b), 'rujukan tidak menerbitkan surat sakit');
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

test('surat sakit HANYA untuk istirahat sakit: fit to work & rujukan tanpa surat/nomor', () => {
  const sick = E.buildEmails(visit(), settings);
  assert.match(sick.boss.body, /Surat Keterangan Sakit dengan No\. SK\/KLL\/20261118\/001 telah diserahkan langsung kepada karyawan/);
  assert.match(sick.worker.subject, /\(No\. SK\/KLL\/20261118\/001\)/);
  for (const rec of ['FIT', 'REFER']) {
    const m = E.buildEmails(visit({ recommendation: rec, restDays: 0, suratNo: '' }), settings);
    for (const k of ['worker', 'boss']) {
      assert.ok(!/Surat Keterangan|SK\/KLL|surat sakit diterbitkan/.test(m[k].body), rec + ' ' + k + ' memuat surat');
      assert.ok(!/\(No\./.test(m[k].subject), rec + ' ' + k + ' subjek memuat nomor');
      assert.ok(m[k].body.endsWith(FOOTER));
    }
  }
  const fit = E.buildEmails(visit({ recommendation: 'FIT', restDays: 0, suratNo: '' }), settings);
  assert.match(fit.boss.body, /Tidak ada surat keterangan sakit yang diterbitkan/);
});

test('tanda tangan: Best Regards + nama + jabatan + perusahaan (bawaan & dapat diganti)', () => {
  const def = E.buildEmails(visit({ nurse: '' }), {});
  const sig = 'Best Regards,\nEny Rohmatul Fitri\nPerawat Perusahaan\nPT Hexindo Adiperkasa Tbk\n\n--\n' + FOOTER;
  assert.ok(def.worker.body.endsWith(sig), 'email pekerja');
  assert.ok(def.boss.body.endsWith(sig), 'email atasan');
  assert.ok(!/Salam sehat|Hormat kami/.test(def.worker.body + def.boss.body));
  const custom = E.buildEmails(visit({ nurse: 'Ns. Lain' }), { nurseTitle: 'Perawat', companyName: 'PT X' });
  assert.match(custom.boss.body, /Best Regards,\nNs\. Lain\nPerawat\nPT X\n/);
});

test('pembuka email pekerja: tanpa NIK, hanya nama dan departemen', () => {
  const b = E.buildEmails(visit(), settings).worker.body;
  assert.ok(b.startsWith('Kepada Yth.\nBapak/Ibu Budi Santoso\nService\n\nTerima kasih'), b.slice(0, 120));
  assert.ok(!/NIK/.test(b.split('\n\n')[0]), 'NIK tidak boleh ada di pembuka');
  // email atasan tetap memuat NIK sebagai data identitas karyawan
  assert.match(E.buildEmails(visit(), settings).boss.body, /NIK: 0012345/);
});

test('toHtml: URL menjadi tautan yang dapat diklik, karakter khusus di-escape', () => {
  const h = E.toHtml(FOOTER + '\n\nA & B <script>x</script>\n  - butir "satu"');
  assert.match(h, /<a href="https:\/\/s\.id\/klinikHAP">https:\/\/s\.id\/klinikHAP<\/a>/);
  assert.ok(!/<script>/.test(h));
  assert.match(h, /A &amp; B &lt;script&gt;/);
  assert.match(h, /&nbsp;&nbsp;- butir &quot;satu&quot;/);
  // titik/tanda baca di akhir URL tidak ikut tautan
  assert.match(E.toHtml('Lihat https://contoh.id/x.'), /<a href="https:\/\/contoh\.id\/x">https:\/\/contoh\.id\/x<\/a>\./);
  // kedua email: tautan umpan balik hidup
  const m = E.buildEmails(visit(), settings);
  for (const k of ['worker', 'boss']) assert.match(E.toHtml(m[k].body), /<a href="https:\/\/s\.id\/klinikHAP">/);
});

test('.eml dengan HTML: multipart/alternative berisi teks dan HTML yang dapat didekode', () => {
  const body = 'Halo \u2013 tes\n' + FOOTER;
  const html = E.toHtml(body);
  const eml = E.toEml({ to: 'a@b.co', subject: 'Uji', body, html });
  assert.match(eml, /Content-Type: multipart\/alternative; boundary="(=_klinikhap_[a-z0-9]+)"/);
  const bd = /boundary="([^"]+)"/.exec(eml)[1];
  const parts = eml.split('--' + bd).slice(1, -1);
  assert.equal(parts.length, 2);
  const dec = (p) => Buffer.from(p.split('\r\n\r\n')[1].replace(/\r\n/g, ''), 'base64').toString('utf8');
  assert.match(parts[0], /Content-Type: text\/plain/); assert.equal(dec(parts[0]), body.replace(/\n/g, '\r\n'));
  assert.match(parts[1], /Content-Type: text\/html/); assert.equal(dec(parts[1]), html);
  assert.ok(eml.trimEnd().endsWith('--' + bd + '--'));
});

test('toHtml: rincian "Label: nilai" menjadi tabel; kalimat berakhiran titik dua tidak salah dikenali', () => {
  const m = E.buildEmails(visit({ recommendation: 'FIT', restDays: 0, suratNo: '' }), settings);
  const h = E.toHtml(m.worker.body);
  assert.match(h, /<table[^>]*>/);
  assert.match(h, /<td[^>]*>Tanggal kunjungan<\/td><td[^>]*>Rabu, 18 November 2026<\/td>/);
  assert.match(h, /<td[^>]*>Obat yang diresepkan<\/td><td[^>]*><ul[^>]*><li>Paracetamol 500 mg 3x1<\/li><li>Vitamin C 1x1<\/li><\/ul>/);
  assert.equal((h.match(/<table/g) || []).length, 1, 'kelompok rincian digabung dalam satu tabel agar kolom sejajar');
  assert.ok(!/<td[^>]*>Terima kasih/.test(h) && !/<td[^>]*>Berikut ringkasan/.test(h), 'kalimat pengantar bukan baris tabel');
  assert.match(h, /<p[^>]*>Terima kasih telah berkunjung[^<]*Anda:<\/p>/);
  // keluhan multibaris tetap satu sel
  assert.match(h, /<td[^>]*>Keluhan \/ diagnosa<\/td><td[^>]*>Demam dan batuk 3 hari<br>Riwayat alergi: tidak ada<\/td>/);
  // email atasan juga berupa tabel
  assert.match(E.toHtml(E.buildEmails(visit(), settings).boss.body), /<td[^>]*>NIK<\/td><td[^>]*>0012345<\/td>/);
});

test('teks polos: rincian dipisah per kelompok dengan baris kosong', () => {
  const b = E.buildEmails(visit(), settings).worker.body;
  assert.match(b, /Dokter pemeriksa: dr\. Andi\n\nKeluhan \/ diagnosa:/);
  assert.match(b, /- Vitamin C 1x1\n\nRekomendasi medis:/);
});

test('sapaan tidak menggandakan gelar di depan nama', () => {
  const m = E.buildEmails(visit({ name: 'Ibu Sari Dewi', supervisorName: 'Pak Budi' }), settings);
  assert.match(m.worker.body, /^Kepada Yth\.\nBapak\/Ibu Sari Dewi\n/);
  assert.match(m.boss.body, /^Kepada Yth\.\nBapak\/Ibu Budi\n/);
  assert.match(E.buildEmails(visit({ supervisorName: 'Budiman' }), settings).boss.body, /Bapak\/Ibu Budiman\n/); // 'Bu' bukan awalan kata
});

/* ---------- dwibahasa ---------- */
const { test: t2 } = require('node:test');
const assert2 = require('node:assert/strict');
const E2 = require('../js/email.js');

const visitEn = {
  name: 'Pak Budi Santoso', nik: '0012345', dept: 'QSHE', doctor: 'dr Indah',
  complaint: 'ISPA', medications: '- Bodrex', recommendation: 'SICK', restDays: 3,
  suratNo: 'SK/KLL/20261118/001', visitAt: new Date(2026, 10, 18, 10, 12).toISOString(),
  checkOutAt: new Date(2026, 10, 18, 10, 40).toISOString(), supervisorName: 'Bu Sari'
};

t2('bahasa default tetap Indonesia', () => {
  const m = E2.buildEmails(visitEn, {});
  assert2.match(m.worker.body, /^Kepada Yth\./);
  assert2.match(m.worker.subject, /^Ringkasan Kunjungan/);
});

t2('versi English: sapaan, label, tanggal, surat, footer', () => {
  const m = E2.buildEmails(visitEn, {}, 'en');
  assert2.match(m.worker.body, /^Dear Budi Santoso,/);
  assert2.match(m.worker.body, /Date of visit: Wednesday, 18 November 2026/);
  assert2.match(m.worker.body, /Rest duration: 3 days \(18 November 2026 to 20 November 2026\)/);
  assert2.match(m.worker.body, /sick leave certificate \(No\. SK\/KLL\/20261118\/001\)/);
  assert2.match(m.worker.subject, /Visit Summary/);
  assert2.match(m.boss.body, /^Dear Sari,/);
  assert2.ok(m.worker.body.endsWith(E2.FEEDBACK_EN));
  assert2.ok(m.boss.body.endsWith(E2.FEEDBACK_EN));
  assert2.doesNotMatch(m.worker.body + m.boss.body, /Kepada|Keluhan|hari/);
});

t2('versi English email atasan tetap tanpa diagnosis dan obat', () => {
  const m = E2.buildEmails(visitEn, {}, 'en');
  assert2.doesNotMatch(m.boss.body, /ISPA|Bodrex/);
  assert2.match(m.boss.body, /Employee ID \(NIK\): 0012345/);
});

t2('English: Fit to Work tanpa surat; pengaturan emailLang dipakai; bahasa tak dikenal jatuh ke id', () => {
  const fit = Object.assign({}, visitEn, { recommendation: 'FIT', restDays: '', suratNo: '' });
  const m = E2.buildEmails(fit, { emailLang: 'en' });
  assert2.doesNotMatch(m.worker.body, /certificate \(No/);
  assert2.match(m.boss.body, /No sick leave certificate was issued/);
  assert2.match(E2.buildEmails(visitEn, {}, 'fr').worker.body, /^Kepada Yth\./);
});

t2('English: HTML tetap berupa tabel rincian dan link aktif', () => {
  const html = E2.toHtml(E2.buildEmails(visitEn, {}, 'en').worker.body);
  assert2.match(html, /<table/);
  assert2.match(html, /Date of visit/);
  assert2.match(html, /<a href="https:\/\/s\.id\/klinikHAP"/);
});
