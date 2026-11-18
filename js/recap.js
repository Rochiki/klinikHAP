/*
 * Klinik HAP - rekap kunjungan dalam tata letak INPUT_KUNJUNGAN (kolom, warna, lebar sama dengan contoh klinik).
 * Kolom kuning = isian, kolom abu-abu = dihitung otomatis (di sini sudah berupa nilai, bukan rumus).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./master.js'), require('./xlsx.js'));
  } else root.KlinikRecap = factory(root.KlinikMaster, root.KlinikXlsx);
})(typeof self !== 'undefined' ? self : this, function (M, X) {
  'use strict';

  var TITLE = 'INPUT_KUNJUNGAN — Log kunjungan klinik (1 baris = 1 kunjungan)';
  var SUBTITLE = 'Isi sel KUNING saja. Kolom abu-abu dihitung otomatis. Gunakan NIK/inisial (bukan nama lengkap) untuk melindungi data kesehatan pribadi.';
  var MONTH_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  /* h = judul, w = lebar, auto = kolom otomatis, al = rata, nf = format angka (sesuai contoh) */
  var COLS = [
    { h: 'No', w: 8.36, auto: 1, al: 'center' }, { h: 'Tanggal', w: 9.91, al: 'center', nf: 'date' },
    { h: 'Bulan-ke', w: 8.09, auto: 1, al: 'center' }, { h: 'Bulan', w: 6.63, auto: 1, al: 'center' },
    { h: 'NIK', w: 9.0 }, { h: 'Inisial', w: 15.63 }, { h: 'Departemen', w: 22.36 }, { h: 'Status pasien', w: 22.27 },
    { h: 'Kelompok kerja', w: 14.09, auto: 1, al: 'center' }, { h: 'Diagnosis (pilih)', w: 28.91 },
    { h: 'Kelompok penyakit', w: 22.18, auto: 1 }, { h: 'ICD-10', w: 6.91, auto: 1, al: 'center' },
    { h: 'Obat 1', w: 23.63 }, { h: 'Obat 2', w: 23.63 }, { h: 'Obat 3', w: 22.27 }, { h: 'Obat 4', w: 21.91 }, { h: 'Obat 5', w: 8.36 },
    { h: 'Jml 1', w: 5.36, al: 'center', nf: '#,##0' }, { h: 'Jml 2', w: 5.36, al: 'center', nf: '#,##0' },
    { h: 'Jml 3', w: 5.36, al: 'center', nf: '#,##0' }, { h: 'Jml 4', w: 5.36, al: 'center', nf: '#,##0' },
    { h: 'Jml 5', w: 5.36, al: 'center', nf: '#,##0' },
    { h: 'Item obat', w: 4.63, auto: 1, al: 'center' }, { h: 'Anti-biotik', w: 5.54, auto: 1, al: 'center' },
    { h: 'Steroid', w: 5.91, auto: 1, al: 'center' }, { h: 'NSAID', w: 6.18, auto: 1, al: 'center' },
    { h: 'Perhatian HT/DM', w: 8.27, auto: 1, al: 'center' }, { h: 'Sedatif', w: 6.18, auto: 1, al: 'center' },
    { h: 'ISPA non-pneu', w: 5.09, auto: 1, al: 'center' }, { h: 'Diare', w: 5.27, auto: 1, al: 'center' },
    { h: 'Peserta HC', w: 6.36, auto: 1, al: 'center' }, { h: 'Hari (1=Sen)', w: 5.73, auto: 1, al: 'center' },
    { h: 'Istirahat (hari)', w: 7.82, al: 'center', nf: '#,##0' }, { h: 'Dirujuk', w: 6.91 },
    { h: 'Dugaan terkait kerja', w: 7.36 }, { h: 'Catatan', w: 7.45 }
  ];

  var INPUT_FILL = 'FFF7D6', INPUT_LINE = 'E5D9A8', AUTO_FILL = 'EEF2F7', AUTO_LINE = 'C9D6E3', NAVY = '0F2A44';

  /** 'Ardhito P Nugraha' -> 'A.P.N.' (nama lengkap tidak dibawa ke rekap). */
  function initials(name) {
    var n = String(name || '').trim().replace(/^(?:bapak\/ibu|bapak|ibu|pak|bu|mr\.?|mrs\.?|ms\.?|dr\.?)\s+/i, '');
    var parts = n.split(/[\s.]+/).filter(Boolean);
    return parts.map(function (p) { return p.charAt(0).toUpperCase() + '.'; }).join('').slice(0, 12);
  }

  function parseList(text) {
    return String(text || '').split(/[\s,;]+/).map(function (s) { return s.trim().toUpperCase(); }).filter(Boolean);
  }

  /** Bulan-ke (1..12) terhadap awal periode, atau 'Luar periode'. */
  function periodMonth(date, periodStart) {
    var ps = /^(\d{4})-(\d{2})-(\d{2})$/.exec(periodStart || '');
    var start = ps ? new Date(+ps[1], +ps[2] - 1, 1) : new Date(2026, 3, 1);
    var n = (date.getFullYear() - start.getFullYear()) * 12 + date.getMonth() - start.getMonth() + 1;
    return n >= 1 && n <= 12 ? n : 'Luar periode';
  }

  /** Teks diagnosis yang dipakai di rekap (isian diagnosis, atau baris pertama keluhan). */
  function diagnosisOf(v) {
    var d = String(v.diagnosis || '').trim();
    if (d) return d;
    return String(v.complaint || '').split(/\r?\n/)[0].trim();
  }

  /** Daftar obat terstruktur [{name, qty}]; mendukung data lama (teks per baris). */
  function medsOf(v) {
    if (Array.isArray(v.meds) && v.meds.length) {
      return v.meds.filter(function (m) { return m && String(m.name || '').trim(); })
        .map(function (m) { return { name: String(m.name).trim(), qty: m.qty === '' || m.qty == null ? null : Number(m.qty) }; });
    }
    return String(v.medications || '').split(/\r?\n/).map(function (l) {
      return l.trim().replace(/^(?:[-*•]|\d+[.)])\s+/, '');
    }).filter(Boolean).map(function (n) { return { name: n, qty: null }; });
  }

  /** Satu baris rekap (36 nilai, urutan sama dengan COLS). */
  function buildRow(v, settings, no) {
    settings = settings || {};
    var d = new Date(v.visitAt), day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var pm = periodMonth(day, settings.periodStart);
    var dxText = diagnosisOf(v), dx = M.lookupDx(dxText);
    var meds = medsOf(v).slice(0, 5), flags = M.drugFlags(meds.map(function (m) { return m.name; }));
    var hc = parseList(settings.hcNiks), nik = String(v.nik || '').trim();
    var weekday = ((d.getDay() + 6) % 7) + 1; // 1 = Senin
    var rest = v.recommendation === 'SICK' && Math.floor(Number(v.restDays)) >= 1 ? Math.floor(Number(v.restDays)) : '';
    var row = [
      no, day, pm,
      typeof pm === 'number' ? MONTH_ID[(new Date(day.getFullYear(), day.getMonth(), 1)).getMonth()] + '-' + String(day.getFullYear()).slice(2) : '',
      nik, initials(v.name), v.dept || '', v.status || 'Karyawan',
      M.workGroup(v.dept), dx ? dx.name : dxText,
      dxText ? (dx ? dx.group : 'Belum dipetakan') : '', dx ? dx.icd : ''
    ];
    for (var i = 0; i < 5; i++) row.push(meds[i] ? meds[i].name : '');
    for (i = 0; i < 5; i++) row.push(meds[i] && meds[i].qty != null && isFinite(meds[i].qty) ? meds[i].qty : '');
    row.push(dxText ? meds.length : '', flags.ab, flags.ster, flags.nsaid, flags.hcc, flags.sed,
      dx ? dx.ispa : 0, dx ? dx.diare : 0, nik && hc.indexOf(nik.toUpperCase()) >= 0 ? 1 : 0, weekday,
      rest, v.recommendation === 'REFER' ? 'Ya' : 'Tidak', v.workRelated === 'Ya' ? 'Ya' : 'Tidak', v.note || '');
    return row;
  }

  function style(col, header) {
    if (header) {
      return { font: { b: 1, color: 'FFFFFF', sz: 10 }, fill: NAVY, border: '2B4C6F', align: { h: 'center', v: 'center', wrap: 1 } };
    }
    var st = {
      font: { sz: 10, color: col.auto ? '334155' : '000000' }, fill: col.auto ? AUTO_FILL : INPUT_FILL,
      border: col.auto ? AUTO_LINE : INPUT_LINE, align: { v: 'center' }
    };
    if (col.al) st.align.h = col.al;
    if (col.nf) st.numFmt = col.nf;
    return st;
  }

  /** Model lembar kerja siap tulis untuk daftar kunjungan (urut tanggal naik). */
  function buildSheet(visits, settings, now) {
    var sorted = visits.slice().sort(function (a, b) { return new Date(a.visitAt) - new Date(b.visitAt); });
    var n = COLS.length, last = X.colName(n);
    var rows = [], pad2 = function (x) { return String(x).padStart(2, '0'); };
    var created = now || new Date();
    var stamp = pad2(created.getDate()) + '/' + pad2(created.getMonth() + 1) + '/' + created.getFullYear();

    var r1 = [{ v: TITLE, s: { font: { b: 1, sz: 15, color: 'FFFFFF' }, fill: NAVY, align: { h: 'left', v: 'center' } } }];
    var r2 = [{ v: SUBTITLE, s: { font: { i: 1, sz: 9, color: 'CFE3F5' }, fill: NAVY, align: { h: 'left', v: 'center' } } }];
    for (var i = 1; i < n; i++) {
      r1.push({ v: null, s: { fill: NAVY } });
      r2.push({ v: null, s: { fill: NAVY } });
    }
    rows[0] = { height: 30, cells: r1 };
    rows[1] = { height: 18, cells: r2 };
    var legend = [
      { v: 'Legenda:', s: { font: { b: 1, sz: 9 }, align: { v: 'center' } } },
      { v: 'Input', s: { font: { sz: 10 }, fill: INPUT_FILL, border: INPUT_LINE, align: { v: 'center' } } },
      { v: 'Otomatis', s: { font: { sz: 10, color: '334155' }, fill: AUTO_FILL, border: AUTO_LINE, align: { v: 'center' } } },
      { v: 'Rekap dibuat dari aplikasi Klinik HAP pada ' + stamp + ' (' + sorted.length + ' kunjungan). Kolom abu-abu sudah berisi nilai hasil hitung aplikasi.',
        s: { font: { i: 1, sz: 9, color: '475569' }, align: { v: 'top', wrap: 1 } } }
    ];
    rows[2] = { cells: legend };
    rows[4] = { height: 40, cells: COLS.map(function (c) { return { v: c.h, s: style(c, true) }; }) };
    sorted.forEach(function (v, k) {
      var vals = buildRow(v, settings, k + 1);
      rows[5 + k] = { cells: vals.map(function (val, ci) { return { v: val, s: style(COLS[ci], false) }; }) };
    });
    return {
      name: 'Sheet1',
      cols: COLS.map(function (c) { return { width: c.w }; }),
      rows: rows,
      merges: ['A1:' + last + '1', 'A2:' + last + '2', 'D3:L3'],
      freeze: 'A6'
    };
  }

  /** Berkas .xlsx (Uint8Array) untuk daftar kunjungan. */
  function toXlsx(visits, settings, now) {
    return X.build([buildSheet(visits, settings, now)]);
  }

  return {
    COLS: COLS, HEADERS: COLS.map(function (c) { return c.h; }), initials: initials, periodMonth: periodMonth,
    diagnosisOf: diagnosisOf, medsOf: medsOf, buildRow: buildRow, buildSheet: buildSheet, toXlsx: toXlsx
  };
});
