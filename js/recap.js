/*
 * Klinik HAP - rekap kunjungan dalam tata letak INPUT_KUNJUNGAN (kolom, warna, lebar sama dengan contoh klinik).
 * Kolom kuning = isian, kolom abu-abu = rumus hidup yang sama dengan contoh; lembar acuan (MASTER_*) ikut di dalam berkas.
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

  /* Rumus kolom otomatis, persis seperti contoh (baris 6 sebagai acuan). Nama (PERIOD_START, DX_LIST, dst.) ada di buku kerja ini. */
  var FORMULAS = {
    0: 'IF(B6="","",ROW()-5)',
    2: 'IF(B6="","",IF(OR(B6<PERIOD_START,B6>=EDATE(PERIOD_START,12)),"Luar periode",(YEAR(B6)-YEAR(PERIOD_START))*12+MONTH(B6)-MONTH(PERIOD_START)+1))',
    3: 'IF(ISNUMBER(C6),INDEX(MONTH_SHORT,C6),"")',
    8: 'IF(G6="","",IFERROR(VLOOKUP(G6,DEPT_MAP,2,0),"Belum dipetakan"))',
    10: 'IF(J6="","",IFERROR(INDEX(DX_GRP,MATCH(J6,DX_LIST,0)),"Belum dipetakan"))',
    11: 'IF(J6="","",IFERROR(INDEX(DX_ICD,MATCH(J6,DX_LIST,0)),""))',
    22: 'IF(J6="","",COUNTA(M6:Q6))',
    23: 'IF(J6="","",IF(SUMPRODUCT(COUNTIFS(OB_LIST,M6:Q6,OB_AB,1))>0,1,0))',
    24: 'IF(J6="","",IF(SUMPRODUCT(COUNTIFS(OB_LIST,M6:Q6,OB_STER,1))>0,1,0))',
    25: 'IF(J6="","",IF(SUMPRODUCT(COUNTIFS(OB_LIST,M6:Q6,OB_NSAID,1))>0,1,0))',
    26: 'IF(J6="","",IF(SUMPRODUCT(COUNTIFS(OB_LIST,M6:Q6,OB_HCC,1))>0,1,0))',
    27: 'IF(J6="","",IF(SUMPRODUCT(COUNTIFS(OB_LIST,M6:Q6,OB_SED,1))>0,1,0))',
    28: 'IF(J6="","",IFERROR(INDEX(DX_ISPA,MATCH(J6,DX_LIST,0))*1,0))',
    29: 'IF(J6="","",IFERROR(INDEX(DX_DIARE,MATCH(J6,DX_LIST,0))*1,0))',
    30: 'IF(J6="","",IF(E6="",0,IF(COUNTIF(HC_NIK,E6)>0,1,0)))',
    31: 'IF(B6="","",WEEKDAY(B6,2))'
  };
  var FIRST = 6, CHUNK = 64;

  /** Nilai tersimpan kolom otomatis agar tampil benar sebelum Excel menghitung ulang (kosong bila diagnosis kosong). */
  function cachedRow(vals) {
    var out = vals.slice(), noDx = !vals[9];
    if (!vals[1]) { out[0] = ''; out[2] = ''; out[3] = ''; out[31] = ''; }
    if (!vals[6]) out[8] = '';
    for (var c = 22; c <= 30; c++) if (noDx) out[c] = '';
    if (noDx) { out[10] = ''; out[11] = ''; }
    return out;
  }

  /** Cell kolom otomatis memakai rumus bersama (potongan 64 baris, seperti Excel). */
  function formulaCell(ci, rowNo, lastRow, value, st) {
    var k = Math.floor((rowNo - FIRST) / CHUNK), start = FIRST + k * CHUNK, end = Math.min(lastRow, start + CHUNK - 1);
    var si = ci * 1000 + k, cell = { v: value, s: st, si: si };
    if (rowNo === start) {
      cell.f = FORMULAS[ci].replace(/([A-Z]{1,2})6\b/g, '$1' + rowNo);
      cell.ref = X.colName(ci + 1) + start + ':' + X.colName(ci + 1) + end;
    }
    return cell;
  }

  function lastRowFor(n) { return FIRST - 1 + Math.max(2000, n + 200); }

  function head(title, sub, ncols) {
    var navy = { fill: NAVY };
    var r1 = [{ v: title, s: { font: { b: 1, sz: 15, color: 'FFFFFF' }, fill: NAVY, align: { h: 'left', v: 'center' } } }];
    var r2 = [{ v: sub, s: { font: { i: 1, sz: 9, color: 'CFE3F5' }, fill: NAVY, align: { h: 'left', v: 'center' } } }];
    for (var i = 1; i < ncols; i++) { r1.push({ v: null, s: navy }); r2.push({ v: null, s: navy }); }
    return [{ height: 30, cells: r1 }, { height: 18, cells: r2 }];
  }
  var HEAD_ST = { font: { b: 1, color: 'FFFFFF', sz: 10 }, fill: NAVY, border: '2B4C6F', align: { h: 'center', v: 'center', wrap: 1 } };
  var CELL_ST = { font: { sz: 10 }, fill: INPUT_FILL, border: INPUT_LINE, align: { v: 'center' } };
  var CELL_C = { font: { sz: 10 }, fill: INPUT_FILL, border: INPUT_LINE, align: { v: 'center', h: 'center' } };

  /** Lembar INPUT_KUNJUNGAN dengan rumus, dropdown, dan baris kosong siap isi (seperti contoh klinik). */
  function buildSheet(visits, settings, now) {
    var sorted = visits.slice().sort(function (a, b) { return new Date(a.visitAt) - new Date(b.visitAt); });
    var n = COLS.length, last = X.colName(n), lastRow = lastRowFor(sorted.length);
    var rows = head(TITLE, SUBTITLE, n);
    rows[2] = { cells: [
      { v: 'Legenda:', s: { font: { b: 1, sz: 9 }, align: { v: 'center' } } },
      { v: 'Input', s: { font: { sz: 10 }, fill: INPUT_FILL, border: INPUT_LINE, align: { v: 'center' } } },
      { v: 'Otomatis', s: { font: { sz: 10, color: '334155' }, fill: AUTO_FILL, border: AUTO_LINE, align: { v: 'center' } } },
      { v: 'Contoh baris: 03/08/2026 | NIK | A.S. | HC PA | Karyawan | Gastroenteritis akut (GEA) | Cefadroxil 500 mg /Lostacef | 6 ...',
        s: { font: { i: 1, sz: 9, color: '475569' }, align: { v: 'top', wrap: 1 } } }
    ] };
    rows[4] = { height: 40, cells: COLS.map(function (c) { return { v: c.h, s: style(c, true) }; }) };
    var sts = COLS.map(function (c) { return style(c, false); });
    for (var r = FIRST; r <= lastRow; r++) {
      var vals = r - FIRST < sorted.length ? cachedRow(buildRow(sorted[r - FIRST], settings, r - FIRST + 1)) : null;
      rows[r - 1] = { cells: COLS.map(function (c, ci) {
        var val = vals ? vals[ci] : '';
        if (c.auto) return formulaCell(ci, r, lastRow, val, sts[ci]);
        return { v: val, s: sts[ci] };
      }) };
    }
    var rg = function (c) { return c + FIRST + ':' + c + lastRow; };
    return {
      name: 'INPUT_KUNJUNGAN', rowHeight: 14.5,
      cols: COLS.map(function (c) { return { width: c.w }; }),
      rows: rows,
      merges: ['A1:' + last + '1', 'A2:' + last + '2', 'D3:L3'],
      validations: [
        { type: 'list', sqref: rg('G'), f1: 'DEPT_LIST', errorStyle: 'information', error: 'Departemen baru: tambahkan juga di MASTER_MAP agar kelompok kerja terbaca.' },
        { type: 'list', sqref: 'AH' + FIRST + ':AI' + lastRow, f1: 'L_YN' },
        { type: 'list', sqref: rg('H'), f1: 'L_STATUS' },
        { type: 'list', sqref: 'M' + FIRST + ':Q' + lastRow, f1: 'OB_DD', errorStyle: 'warning', error: 'Obat belum ada di MASTER_OBAT.' },
        { type: 'list', sqref: rg('J'), f1: 'DX_DD', errorStyle: 'warning', error: 'Diagnosis belum ada di MASTER_DIAGNOSA. Tambahkan dulu agar terhitung di dashboard.' },
        { type: 'date', sqref: rg('B'), f1: '43831', f2: '49674', errorTitle: 'Tanggal', error: 'Isi tanggal valid (dd/mm/yyyy).' }
      ]
    };
  }

  /** Lembar acuan (master) yang dipakai rumus: MASTER_DIAGNOSA, MASTER_OBAT, MASTER_MAP, INPUT_HEALTH_CORNER + nama terdefinisi. */
  function buildMasters(visits, settings) {
    var MONTHS = MONTH_ID;
    var ps = /^(\d{4})-(\d{2})-(\d{2})$/.exec((settings && settings.periodStart) || '');
    var start = ps ? new Date(+ps[1], +ps[2] - 1, 1) : new Date(2026, 3, 1);
    var tick = function (title, sub, widths, headers, rowsData, align) {
      var rows = head(title, sub, widths.length);
      var hr = [];
      headers.forEach(function (h, i) { hr[i] = h ? { v: h, s: HEAD_ST } : null; });
      rows[3] = { height: 30, cells: hr };
      return { rows: rows, widths: widths, data: rowsData, align: align };
    };

    /* diagnosis: daftar baku + tambahan sendiri */
    var dx = M.DX.slice();
    var dxLast = Math.max(154, 4 + dx.length);
    var dxSheet = { name: 'MASTER_DIAGNOSA', cols: [38, 9, 24, 4, 10, 10].map(function (w) { return { width: w }; }), rowHeight: 14.5,
      rows: head('MASTER_DIAGNOSA — daftar acuan diagnosis', 'Dropdown "Diagnosis (pilih)" dan kolom kelompok penyakit / ICD-10 membaca daftar ini.', 6), merges: ['A1:F1', 'A2:F2'] };
    dxSheet.rows[3] = { height: 30, cells: [{ v: 'Diagnosis', s: HEAD_ST }, { v: 'ICD-10', s: HEAD_ST }, { v: 'Kelompok penyakit', s: HEAD_ST }, null,
      { v: 'ISPA non-pneu (1/0)', s: HEAD_ST }, { v: 'Diare (1/0)', s: HEAD_ST }] };
    dx.forEach(function (r, i) {
      dxSheet.rows[4 + i] = { cells: [{ v: r[0], s: CELL_ST }, { v: r[2], s: CELL_C }, { v: r[1], s: CELL_ST }, null, { v: r[3], s: CELL_C }, { v: r[4], s: CELL_C }] };
    });

    /* obat: daftar baku + obat yang dipakai di kunjungan tetapi belum ada di daftar baku */
    var drugs = M.DRUG_MASTER.map(function (r) { return r.slice(); }), seen = {};
    drugs.forEach(function (r) { seen[M.norm(r[0])] = 1; });
    visits.forEach(function (v) {
      medsOf(v).slice(0, 5).forEach(function (m) {
        var key = M.norm(m.name);
        if (!key || seen[key]) return;
        seen[key] = 1;
        var f = M.drugFlag1(m.name);
        drugs.push([m.name, f.ab, f.ster, f.nsaid, f.sed, f.hcc]);
      });
    });
    var obLast = Math.max(64, 4 + drugs.length);
    var obSheet = { name: 'MASTER_OBAT', cols: [30, 4, 4, 4, 4, 4, 4, 4, 10, 10, 10, 10, 4, 12].map(function (w) { return { width: w }; }), rowHeight: 14.5,
      rows: head('MASTER_OBAT — daftar acuan obat', 'Tandai 1 pada kelas obatnya. Obat baru: tambahkan di baris kosong paling bawah daftar.', 14), merges: ['A1:N1', 'A2:N2'] };
    var oh = [];
    oh[0] = { v: 'Nama obat', s: HEAD_ST };
    oh[8] = { v: 'Anti-biotik', s: HEAD_ST }; oh[9] = { v: 'Steroid', s: HEAD_ST }; oh[10] = { v: 'NSAID', s: HEAD_ST };
    oh[11] = { v: 'Sedatif', s: HEAD_ST }; oh[13] = { v: 'Perhatian HT/DM', s: HEAD_ST };
    obSheet.rows[3] = { height: 30, cells: oh };
    drugs.forEach(function (r, i) {
      var c = []; c[0] = { v: r[0], s: CELL_ST };
      c[8] = { v: r[1], s: CELL_C }; c[9] = { v: r[2], s: CELL_C }; c[10] = { v: r[3], s: CELL_C }; c[11] = { v: r[4], s: CELL_C }; c[13] = { v: r[5], s: CELL_C };
      obSheet.rows[4 + i] = { cells: c };
    });

    /* peta departemen, bulan, daftar pilihan */
    var depts = Object.keys(M.DEPT).sort(function (a, b) { return a.toLowerCase() < b.toLowerCase() ? -1 : 1; });
    var mapLast = Math.max(155, 5 + depts.length);
    var mapSheet = { name: 'MASTER_MAP', cols: [3, 14, 12, 3, 3, 3, 30, 16, 3, 3, 3, 3, 3, 3, 3, 3, 3, 26, 10].map(function (w) { return { width: w }; }), rowHeight: 14.5,
      rows: head('MASTER_MAP — peta departemen & daftar pilihan', 'Departemen baru: tambahkan di bawah daftar, lalu isi Office / Lapangan.', 19), merges: ['A1:S1', 'A2:S2'] };
    var put = function (r, ci, cell) { (mapSheet.rows[r - 1] = mapSheet.rows[r - 1] || { cells: [] }).cells[ci - 1] = cell; };
    put(4, 2, { v: 'Awal periode', s: { font: { b: 1, sz: 10 }, align: { v: 'center' } } });
    put(4, 3, { v: start, s: Object.assign({ numFmt: 'date', align: { v: 'center', h: 'center' } }, CELL_ST) });
    put(7, 3, { v: 'Bulan', s: HEAD_ST });
    for (var i = 0; i < 12; i++) {
      var m0 = new Date(start.getFullYear(), start.getMonth() + i, 1);
      put(8 + i, 3, { v: MONTHS[m0.getMonth()] + '-' + String(m0.getFullYear()).slice(2), s: CELL_C });
    }
    put(5, 7, { v: 'Departemen', s: HEAD_ST }); put(5, 8, { v: 'Kelompok kerja', s: HEAD_ST });
    depts.forEach(function (d, k) { put(6 + k, 7, { v: d, s: CELL_ST }); put(6 + k, 8, { v: M.DEPT[d], s: CELL_C }); });
    put(5, 18, { v: 'Status pasien', s: HEAD_ST }); put(5, 19, { v: 'Ya/Tidak', s: HEAD_ST });
    M.STATUS.forEach(function (st, k) { put(6 + k, 18, { v: st, s: CELL_ST }); });
    put(6, 19, { v: 'Ya', s: CELL_C }); put(7, 19, { v: 'Tidak', s: CELL_C });

    /* peserta Health Corner: NIK dari Pengaturan */
    var hc = parseList(settings && settings.hcNiks), hcLast = Math.max(156, 6 + hc.length);
    var hcSheet = { name: 'INPUT_HEALTH_CORNER', cols: [{ width: 3 }, { width: 16 }], rowHeight: 14.5,
      rows: head('INPUT_HEALTH_CORNER — NIK peserta Health Corner', 'Isi NIK (kolom B, mulai baris 7). Kolom "Peserta HC" di INPUT_KUNJUNGAN membaca daftar ini.', 2), merges: ['A1:B1', 'A2:B2'] };
    hcSheet.rows[5] = { height: 20, cells: [null, { v: 'NIK', s: HEAD_ST }] };
    hc.forEach(function (nik, k) { hcSheet.rows[6 + k] = { cells: [null, { v: nik, s: CELL_ST }] }; });

    var names = [
      ['DEPT_LIST', 'MASTER_MAP!$G$6:$G$' + mapLast], ['DEPT_MAP', 'MASTER_MAP!$G$6:$H$' + mapLast],
      ['DX_DD', 'OFFSET(MASTER_DIAGNOSA!$A$5,0,0,MAX(1,COUNTA(MASTER_DIAGNOSA!$A$5:$A$' + dxLast + ')),1)'],
      ['DX_DIARE', 'MASTER_DIAGNOSA!$F$5:$F$' + dxLast], ['DX_GRP', 'MASTER_DIAGNOSA!$C$5:$C$' + dxLast],
      ['DX_ICD', 'MASTER_DIAGNOSA!$B$5:$B$' + dxLast], ['DX_ISPA', 'MASTER_DIAGNOSA!$E$5:$E$' + dxLast],
      ['DX_LIST', 'MASTER_DIAGNOSA!$A$5:$A$' + dxLast], ['HC_NIK', 'INPUT_HEALTH_CORNER!$B$7:$B$' + hcLast],
      ['L_STATUS', 'MASTER_MAP!$R$6:$R$10'], ['L_YN', 'MASTER_MAP!$S$6:$S$7'], ['MONTH_SHORT', 'MASTER_MAP!$C$8:$C$19'],
      ['OB_AB', 'MASTER_OBAT!$I$5:$I$' + obLast],
      ['OB_DD', 'OFFSET(MASTER_OBAT!$A$5,0,0,MAX(1,COUNTA(MASTER_OBAT!$A$5:$A$' + obLast + ')),1)'],
      ['OB_HCC', 'MASTER_OBAT!$N$5:$N$' + obLast], ['OB_LIST', 'MASTER_OBAT!$A$5:$A$' + obLast],
      ['OB_NSAID', 'MASTER_OBAT!$K$5:$K$' + obLast], ['OB_SED', 'MASTER_OBAT!$L$5:$L$' + obLast],
      ['OB_STER', 'MASTER_OBAT!$J$5:$J$' + obLast], ['PERIOD_START', 'MASTER_MAP!$C$4']
    ].map(function (p) { return { name: p[0], ref: p[1] }; });
    return { sheets: [dxSheet, obSheet, mapSheet, hcSheet], names: names };
  }

  /** Berkas .xlsx (Uint8Array): INPUT_KUNJUNGAN berisi rumus + lembar acuan, tanpa tautan luar. */
  function toXlsx(visits, settings, now) {
    var m = buildMasters(visits, settings);
    return X.build([buildSheet(visits, settings, now)].concat(m.sheets), { names: m.names, recalc: true });
  }

  return {
    COLS: COLS, HEADERS: COLS.map(function (c) { return c.h; }), initials: initials, periodMonth: periodMonth,
    diagnosisOf: diagnosisOf, medsOf: medsOf, buildRow: buildRow, buildSheet: buildSheet, buildMasters: buildMasters, cachedRow: cachedRow, toXlsx: toXlsx
  };
});
