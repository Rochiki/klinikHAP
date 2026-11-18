const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/recap.js');
const M = require('../js/master.js');
const X = require('../js/xlsx.js');

const HEADERS = ['No', 'Tanggal', 'Bulan-ke', 'Bulan', 'NIK', 'Inisial', 'Departemen', 'Status pasien', 'Kelompok kerja',
  'Diagnosis (pilih)', 'Kelompok penyakit', 'ICD-10', 'Obat 1', 'Obat 2', 'Obat 3', 'Obat 4', 'Obat 5',
  'Jml 1', 'Jml 2', 'Jml 3', 'Jml 4', 'Jml 5', 'Item obat', 'Anti-biotik', 'Steroid', 'NSAID', 'Perhatian HT/DM', 'Sedatif',
  'ISPA non-pneu', 'Diare', 'Peserta HC', 'Hari (1=Sen)', 'Istirahat (hari)', 'Dirujuk', 'Dugaan terkait kerja', 'Catatan'];

const v = (over) => Object.assign({
  visitAt: new Date(2026, 10, 18, 10, 12).toISOString(), nik: 'T001', name: 'Pak Budi Santoso', dept: 'QSHE', status: 'Karyawan',
  diagnosis: 'COMMOND COLD', meds: [{ name: 'CEFADROXIL', qty: 6 }, { name: 'Alphara', qty: 4 }],
  recommendation: 'SICK', restDays: 2, workRelated: 'Tidak', note: ''
}, over || {});

test('judul kolom sama persis dengan contoh rekap (36 kolom)', () => {
  assert.deepEqual(R.HEADERS, HEADERS);
});

test('baris rekap: kolom isian dan kolom otomatis terisi benar', () => {
  const r = R.buildRow(v(), { hcNiks: 't001' }, 5);
  const o = {}; HEADERS.forEach((h, i) => { o[h] = r[i]; });
  assert.equal(o.No, 5);
  assert.equal(o['Bulan-ke'], 8); assert.equal(o.Bulan, 'Nov-26');
  assert.equal(o.Inisial, 'B.S.');                       // nama lengkap tidak dibawa
  assert.equal(o['Kelompok kerja'], 'Office');
  assert.equal(o['Diagnosis (pilih)'], 'Common Cold (Nasofaringitis akut)');
  assert.equal(o['Kelompok penyakit'], 'Saluran Pernapasan'); assert.equal(o['ICD-10'], 'J00');
  assert.equal(o['Obat 1'], 'CEFADROXIL'); assert.equal(o['Jml 1'], 6); assert.equal(o['Item obat'], 2);
  assert.equal(o['Anti-biotik'], 1); assert.equal(o.Sedatif, 1); assert.equal(o.Steroid, 0);
  assert.equal(o['ISPA non-pneu'], 1); assert.equal(o.Diare, 0);
  assert.equal(o['Peserta HC'], 1);
  assert.equal(o['Hari (1=Sen)'], 3);                    // Rabu
  assert.equal(o['Istirahat (hari)'], 2); assert.equal(o.Dirujuk, 'Tidak');
});

test('rujukan, di luar periode, tanpa NIK, diagnosis tak dikenal', () => {
  const r = R.buildRow(v({ recommendation: 'REFER', restDays: 0, nik: '', status: 'Tamu/Vendor', diagnosis: 'Penyakit Langka',
    visitAt: new Date(2027, 3, 2).toISOString(), dept: 'Departemen Baru' }), {}, 1);
  assert.equal(r[2], 'Luar periode'); assert.equal(r[3], '');
  assert.equal(r[4], ''); assert.equal(r[7], 'Tamu/Vendor');
  assert.equal(r[8], 'Belum dipetakan'); assert.equal(r[10], 'Belum dipetakan'); assert.equal(r[11], '');
  assert.equal(r[33], 'Ya'); assert.equal(r[32], '');
});

test('data lama (keluhan + obat teks) tetap masuk rekap', () => {
  const r = R.buildRow({ visitAt: new Date(2026, 5, 1).toISOString(), nik: '1', name: 'A B', dept: 'IT', complaint: 'Gastritis\nmual',
    medications: '1. Neoralgin\n- Sanmol', recommendation: 'FIT' }, {}, 1);
  assert.equal(r[9], 'Gastritis'); assert.equal(r[12], 'Neoralgin'); assert.equal(r[13], 'Sanmol'); assert.equal(r[25], 1);
});

test('inisial dan awal periode', () => {
  assert.equal(R.initials('Dr. Ardhito P Nugraha'), 'A.P.N.');
  assert.equal(R.periodMonth(new Date(2026, 3, 1), '2026-04-01'), 1);
  assert.equal(R.periodMonth(new Date(2027, 2, 31), '2026-04-01'), 12);
  assert.equal(R.periodMonth(new Date(2026, 2, 31), '2026-04-01'), 'Luar periode');
});

test('berkas xlsx: zip valid, CRC benar, struktur lembar sesuai contoh', () => {
  const bytes = R.toXlsx([v(), v({ visitAt: new Date(2026, 5, 1).toISOString() })], {}, new Date(2026, 10, 18));
  assert.equal(bytes[0], 0x50); assert.equal(bytes[1], 0x4b);
  const txt = Buffer.from(bytes).toString('latin1');
  assert.ok(txt.includes('xl/worksheets/sheet1.xml') && txt.includes('xl/styles.xml'));
  assert.ok(txt.includes('INPUT_KUNJUNGAN'));
  assert.equal(X.crc32(Buffer.from('123456789')), 0xCBF43926);
});

test('master: kelompok kerja, diagnosis dan alias, kelas obat', () => {
  assert.equal(M.workGroup('Security'), 'Lapangan'); assert.equal(M.workGroup('security'), 'Lapangan');
  assert.equal(M.lookupDx('gea').diare, 1); assert.equal(M.lookupDx('PHARINGITIS').icd, 'J02.9');
  assert.equal(M.lookupDx('tidak ada'), null);
  const f = M.drugFlags(['Kalmethasone/Faridexon']);
  assert.deepEqual([f.ster, f.hcc, f.ab], [1, 1, 0]);
});

/* ---- berkas xlsx sama dengan contoh: rumus hidup, dropdown, lembar acuan, tanpa tautan luar ---- */
function unzip(bytes) { // pembaca zip "store" sederhana
  const b = Buffer.from(bytes), out = {};
  let p = 0;
  while (b.readUInt32LE(p) === 0x04034b50) {
    const size = b.readUInt32LE(p + 18), nl = b.readUInt16LE(p + 26), el = b.readUInt16LE(p + 28);
    const name = b.toString('utf8', p + 30, p + 30 + nl);
    out[name] = b.toString('utf8', p + 30 + nl + el, p + 30 + nl + el + size);
    p += 30 + nl + el + size;
  }
  return out;
}

test('xlsx: rumus kolom otomatis sama dengan contoh, 2000 baris siap isi, dropdown, nama acuan', () => {
  const f = unzip(R.toXlsx([v()], { periodStart: '2026-04-01', hcNiks: 'T001' }, new Date(2026, 10, 18)));
  const sh = f['xl/worksheets/sheet1.xml'], wb = f['xl/workbook.xml'];
  assert.ok(sh.includes('<f t="shared" ref="A6:A69" si="0">IF(B6=&quot;&quot;,&quot;&quot;,ROW()-5)</f>'));
  assert.ok(sh.includes('IFERROR(VLOOKUP(G6,DEPT_MAP,2,0),&quot;Belum dipetakan&quot;)'));
  assert.ok(sh.includes('SUMPRODUCT(COUNTIFS(OB_LIST,M6:Q6,OB_AB,1))&gt;0'));
  assert.ok(sh.includes('<c r="A2005"') && !sh.includes('<c r="A2006"'));
  assert.equal((sh.match(/<dataValidation /g) || []).length, 6);
  ['DEPT_LIST', 'DX_DD', 'OB_DD', 'L_STATUS', 'L_YN', 'PERIOD_START', 'HC_NIK', 'MONTH_SHORT'].forEach((n) => assert.ok(sh.includes(n) || wb.includes('definedName name="' + n + '"'), n));
  assert.equal((wb.match(/<definedName /g) || []).length, 20);
  assert.ok(wb.includes('fullCalcOnLoad="1"'));
  ['MASTER_DIAGNOSA', 'MASTER_OBAT', 'MASTER_MAP', 'INPUT_HEALTH_CORNER'].forEach((n) => assert.ok(wb.includes('name="' + n + '"'), n));
  assert.ok(!Object.keys(f).some((k) => k.includes('externalLink')), 'tidak ada tautan ke berkas luar');
  assert.ok(f['xl/worksheets/sheet5.xml'].includes('T001'), 'NIK peserta HC masuk lembar HC');
});

test('xlsx: lebih dari 2000 kunjungan tetap tertampung; obat baru masuk MASTER_OBAT', () => {
  const many = []; for (let i = 0; i < 2100; i++) many.push(v({ meds: [{ name: 'Obat Baru ' + (i % 3), qty: 1 }] }));
  const f = unzip(R.toXlsx(many, {}, new Date()));
  assert.ok(f['xl/worksheets/sheet1.xml'].includes('<c r="A2105"'));
  assert.ok(f['xl/worksheets/sheet3.xml'].includes('Obat Baru 2'));
});

test('master lengkap seperti contoh: 71 diagnosis baku, 66 departemen, 37 obat', () => {
  assert.ok(M.DX.length >= 71 && Object.keys(M.DEPT).length === 66 && M.DRUG_MASTER.length === 37);
  assert.equal(M.lookupDx('Konstipasi').icd, 'K59.0'); assert.equal(M.workGroup('Internal Audit'), 'Office');
  assert.deepEqual(M.drugFlags(['Gentanicin salep']), { ab: 1, ster: 0, nsaid: 0, hcc: 0, sed: 0 });
});
