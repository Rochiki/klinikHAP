/*
 * Klinik HAP - daftar acuan (master) untuk kolom otomatis pada rekap.
 * Diturunkan dari struktur contoh rekap klinik (kelompok penyakit, ICD-10, jenis obat, kelompok kerja).
 * Tidak berisi data pasien. Ubah/tambah isi daftar di sini bila ada diagnosis, obat, atau departemen baru.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KlinikMaster = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STATUS = ['Karyawan', 'Non-karyawan (tanpa NIK)', 'Outsourcing/Mitra', 'PKL/Magang', 'Tamu/Vendor'];
  var NO_NIK_STATUS = ['Non-karyawan (tanpa NIK)', 'Tamu/Vendor'];

  /* departemen -> kelompok kerja */
  var DEPT = {
    "Accounting": "Office",
    "ADT Tech Support": "Lapangan",
    "AR Collection & Admin": "Office",
    "BELL ADVISOR": "Lapangan",
    "Branch Sales Support": "Office",
    "BTS": "Lapangan",
    "CAB.Makasar": "Lapangan",
    "CAB.Pontianak": "Lapangan",
    "Carefast": "Lapangan",
    "Company Doctor": "Office",
    "Contract Management": "Office",
    "Cor Plan & SMO": "Office",
    "Corp Sec": "Office",
    "Director": "Office",
    "EXPAT": "Office",
    "Export Import": "Office",
    "Finance & Treasury": "Office",
    "GA & Assets Management": "Office",
    "General Sales Support": "Office",
    "HC PA": "Office",
    "HC Recruitment & EPM": "Office",
    "Inad": "Office",
    "Inf Tech": "Office",
    "Jakarta": "Lapangan",
    "JKT Training Center": "Lapangan",
    "KMHS": "Lapangan",
    "Legal": "Office",
    "Marketing Development": "Office",
    "Mining Sales & Wenco": "Office",
    "NUES": "Lapangan",
    "Operations and Systems": "Office",
    "Parts Inventory & System": "Office",
    "Parts Warehouse": "Lapangan",
    "PKL": "Office",
    "PresDir": "Office",
    "Procurement & Investment": "Office",
    "Project Sales Support": "Office",
    "QSHE": "Office",
    "Reseptionis": "Office",
    "Sales Adm": "Office",
    "Sales Planning": "Office",
    "Security": "Lapangan",
    "Tax": "Office",
    "Tech Support": "Lapangan",
    "Value Chain Promotion": "Office",
    "Vendor": "Office"
  };

  /* [diagnosis, kelompok penyakit, ICD-10, ISPA non-pneumonia (1/0), diare (1/0)] */
  var DX = [
    ["Abses / Furunkel", "Kulit & Alergi", "L02.9", 0, 0],
    ["Alergi / Urtikaria", "Kulit & Alergi", "T78.4", 0, 0],
    ["Artralgia", "Muskuloskeletal", "M25.5", 0, 0],
    ["Asma", "Saluran Pernapasan", "J45.9", 0, 0],
    ["Blefaritis", "Mata", "H01.0", 0, 0],
    ["Common Cold (Nasofaringitis akut)", "Saluran Pernapasan", "J00", 1, 0],
    ["Dermatitis", "Kulit & Alergi", "L30.9", 0, 0],
    ["Dismenore", "Kesehatan Reproduksi", "N94.6", 0, 0],
    ["Dispepsia", "Pencernaan", "K30", 0, 0],
    ["Faringitis akut", "Saluran Pernapasan", "J02.9", 1, 0],
    ["Febris", "Infeksi Sistemik & Menular", "R50.9", 0, 0],
    ["Flebitis", "Infeksi Sistemik & Menular", "I80.9", 0, 0],
    ["Frozen shoulder", "Muskuloskeletal", "M75.0", 0, 0],
    ["Gastritis", "Pencernaan", "K29.7", 0, 0],
    ["Gastroenteritis akut (GEA)", "Pencernaan", "A09", 0, 1],
    ["GERD", "Pencernaan", "K21.9", 0, 0],
    ["Gigitan serangga", "Kulit & Alergi", "T63.4", 0, 0],
    ["Gingivitis", "Gigi & Mulut", "K05.1", 0, 0],
    ["Herpes", "Kulit & Alergi", "B00.9", 0, 0],
    ["Hiperemesis gravidarum", "Kesehatan Reproduksi", "O21.0", 0, 0],
    ["Hipertensi", "Kardiometabolik", "I10", 0, 0],
    ["Hiperurisemia", "Kardiometabolik", "E79.0", 0, 0],
    ["Hordeolum", "Mata", "H00.0", 0, 0],
    ["Infeksi (tidak spesifik)", "Infeksi Sistemik & Menular", "B99", 0, 0],
    ["Iritasi mata", "Mata", "H57.8", 0, 0],
    ["Karies dentis", "Gigi & Mulut", "K02.9", 0, 0],
    ["Kolik abdomen", "Pencernaan", "R10.4", 0, 0],
    ["Konjungtivitis", "Mata", "H10.9", 0, 0],
    ["Konsultasi", "Lain-lain", "Z71.9", 0, 0],
    ["Laringitis", "Saluran Pernapasan", "J04.0", 1, 0],
    ["Low Back Pain (LBP)", "Muskuloskeletal", "M54.5", 0, 0],
    ["LPR (Laryngopharyngeal reflux)", "Pencernaan", "K21.9", 0, 0],
    ["Luka bakar", "Cedera / Luka", "T30.0", 0, 0],
    ["Mastitis", "Kesehatan Reproduksi", "N61", 0, 0],
    ["Migren", "Neurologi", "G43.9", 0, 0],
    ["Myalgia", "Muskuloskeletal", "M79.1", 0, 0],
    ["Myotrauma / Kontusio", "Cedera / Luka", "T14.0", 0, 0],
    ["Nyeri lutut", "Muskuloskeletal", "M25.56", 0, 0],
    ["Osteoartritis", "Muskuloskeletal", "M19.9", 0, 0],
    ["Parotitis", "Gigi & Mulut", "K11.2", 0, 0],
    ["Pleuritis", "Saluran Pernapasan", "R09.1", 0, 0],
    ["Pulpitis", "Gigi & Mulut", "K04.0", 0, 0],
    ["Rinitis alergi", "Saluran Pernapasan", "J30.4", 1, 0],
    ["Rubella", "Infeksi Sistemik & Menular", "B06.9", 0, 0],
    ["Sefalgia", "Neurologi", "R51", 0, 0],
    ["Sinusitis", "Saluran Pernapasan", "J01.9", 1, 0],
    ["Sprain", "Cedera / Luka", "T14.3", 0, 0],
    ["Stomatitis", "Gigi & Mulut", "K12.1", 0, 0],
    ["Strain", "Cedera / Luka", "T14.3", 0, 0],
    ["Suspek campak", "Infeksi Sistemik & Menular", "B05.9", 0, 0],
    ["Suspek demam tifoid", "Infeksi Sistemik & Menular", "A01.0", 0, 0],
    ["Tonsilitis akut", "Saluran Pernapasan", "J03.9", 1, 0],
    ["Vertigo", "Neurologi", "R42", 0, 0],
    ["Vulnus (luka lecet/robek)", "Cedera / Luka", "T14.1", 0, 0]
  ];

  /* penulisan lain yang sering diketik -> nama baku di DX */
  var DX_ALIAS = {
    'common cold': 'Common Cold (Nasofaringitis akut)', 'commond cold': 'Common Cold (Nasofaringitis akut)',
    'nasofaringitis': 'Common Cold (Nasofaringitis akut)', 'gea': 'Gastroenteritis akut (GEA)',
    'faringitis': 'Faringitis akut', 'pharingitis': 'Faringitis akut', 'pharyngitis': 'Faringitis akut',
    'tonsilitis': 'Tonsilitis akut', 'tonsillitis': 'Tonsilitis akut', 'caries dentis': 'Karies dentis',
    'susp.sinusitis': 'Sinusitis', 'suspek sinusitis': 'Sinusitis', 'hordeulum': 'Hordeolum',
    'muscle tension': 'Myalgia', 'tension headhache': 'Sefalgia', 'tension headache': 'Sefalgia',
    'cepalgia': 'Sefalgia', 'cephalgia': 'Sefalgia', 'headache': 'Sefalgia',
    'vulnus': 'Vulnus (luka lecet/robek)', 'allergie': 'Alergi / Urtikaria', 'alergi': 'Alergi / Urtikaria',
    'urtikaria': 'Alergi / Urtikaria', 'burn': 'Luka bakar', 'lpr': 'LPR (Laryngopharyngeal reflux)',
    'lbp': 'Low Back Pain (LBP)', 'low back pain': 'Low Back Pain (LBP)', 'ispa': 'Common Cold (Nasofaringitis akut)'
  };

  /* obat umum untuk saran pengisian */
  var DRUGS = [
    'Alphara', 'Ambroxol/Roverton', 'Amlodipine', 'Antacida DOEN', 'Asam mefenamat/Fargetik', 'Becom C',
    'Bioplacenton', 'Braito/Insto', 'Bufantacid', 'Buscopan/Scopma', 'Cataflam/Kaditic', 'Cefadroxil 500 mg /Lostacef',
    'Cendo Cenfresh', 'Cendo Xitrol MD', 'Cetirizine/Lerzin', 'Counterpain 5 gr', 'Erlamycetin salep mata',
    'FG Troches', 'Gentamicin salep', 'Hydrocortison salep', 'Histigo', 'Kalmethasone/Faridexon', 'Lasmalin',
    'Neoralgin', 'Neurodex/Nutralik', 'New Diatab/Akita', 'Omeperazole/Lokev', 'Ondancentrone/Odanostin',
    'Primadex/Fasriprim', 'Ranitidine/Zantifar', 'Sanmol 500 mg', 'Siladex', 'Spasminal', 'Trianta', 'Voltadex', 'Xepazym'
  ];

  /* kelas obat dikenali dari potongan nama (tidak peka huruf besar/kecil), jadi tulisan variasi tetap terbaca */
  var DRUG_RULES = [
    { k: 'ab', words: ['cefadroxil', 'lostacef', 'erlamycetin', 'erlamicetin', 'gentanicin', 'gentamicin', 'bioplacenton', 'xitrol', 'citrol', 'fg troches', 'primadex', 'fasriprim', 'amoxicillin', 'amoxicilin', 'ciprofloxacin', 'azithromycin'] },
    { k: 'ster', words: ['kalmethason', 'faridexon', 'dexamethason', 'dexametason'] },
    { k: 'nsaid', words: ['asam mefenamat', 'fargetik', 'fargetix', 'cataflam', 'kaditic', 'neoralgin', 'voltadex', 'ibuprofen', 'diclofenac', 'diklofenak'] },
    { k: 'hcc', words: ['alphara', 'asam mefenamat', 'fargetik', 'fargetix', 'cataflam', 'kaditic', 'neoralgin', 'voltadex', 'kalmethason', 'faridexon', 'ibuprofen', 'diclofenac'] },
    { k: 'sed', words: ['alphara', 'cetirizine', 'lerzin', 'diazepam', 'alprazolam'] }
  ];

  function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

  var deptIdx = {}; Object.keys(DEPT).forEach(function (k) { deptIdx[norm(k)] = DEPT[k]; });
  var dxIdx = {}; DX.forEach(function (r) { dxIdx[norm(r[0])] = r; });

  /** Kelompok kerja ('Office' / 'Lapangan') atau 'Belum dipetakan'. */
  function workGroup(dept) {
    var g = deptIdx[norm(dept)];
    return g || (dept ? 'Belum dipetakan' : '');
  }

  /** {name, group, icd, ispa, diare} atau null bila tidak dikenal. */
  function lookupDx(text) {
    var key = norm(text);
    if (!key) return null;
    var r = dxIdx[key] || dxIdx[norm(DX_ALIAS[key])];
    return r ? { name: r[0], group: r[1], icd: r[2], ispa: r[3], diare: r[4] } : null;
  }

  /** Penanda kelas obat untuk daftar nama obat: {ab, ster, nsaid, hcc, sed} bernilai 0/1. */
  function drugFlags(names) {
    var out = { ab: 0, ster: 0, nsaid: 0, hcc: 0, sed: 0 };
    (names || []).forEach(function (n) {
      var t = norm(n);
      if (!t) return;
      DRUG_RULES.forEach(function (rule) {
        if (rule.words.some(function (w) { return t.indexOf(w) >= 0; })) out[rule.k] = 1;
      });
    });
    return out;
  }

  return {
    STATUS: STATUS, NO_NIK_STATUS: NO_NIK_STATUS, DEPT: DEPT, DX: DX, DRUGS: DRUGS,
    DEPARTMENTS: Object.keys(DEPT).sort(function (a, b) { return a.toLowerCase() < b.toLowerCase() ? -1 : 1; }),
    DIAGNOSES: DX.map(function (r) { return r[0]; }),
    workGroup: workGroup, lookupDx: lookupDx, drugFlags: drugFlags, norm: norm
  };
});
