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

  var STATUS = ['Karyawan', 'Outsourcing/Mitra', 'PKL/Magang', 'Tamu/Vendor', 'Non-karyawan (tanpa NIK)'];
  var NO_NIK_STATUS = ['Non-karyawan (tanpa NIK)', 'Tamu/Vendor'];

  /* departemen -> kelompok kerja */
  var DEPT = {
    "Accounting": "Office",
    "ADT Departmen": "Lapangan",
    "ADT Tech Support": "Lapangan",
    "AR Collection & Admin": "Office",
    "BELL ADVISOR": "Lapangan",
    "Branch Sales Support": "Office",
    "BTS": "Lapangan",
    "Cab.Jakarta": "Lapangan",
    "CAB.Makasar": "Lapangan",
    "CAB.Pontianak": "Lapangan",
    "Carefast": "Lapangan",
    "Commercial Contract": "Office",
    "Company Doctor": "Office",
    "Contract Management": "Office",
    "Cor Plan & SMO": "Office",
    "Corp Sec": "Office",
    "Corporate Planning": "Office",
    "Credit Analysis": "Office",
    "Director": "Office",
    "EXPAT": "Office",
    "Export Import": "Office",
    "Finance & Treasury": "Office",
    "GA & Assets Management": "Office",
    "General Affairs": "Office",
    "General Sales Support": "Office",
    "HC PA": "Office",
    "HC Personnel Admin": "Office",
    "HC Recruitment & EPM": "Office",
    "HC Training & Career Dev.": "Office",
    "Inad": "Office",
    "Inf Tech": "Office",
    "Information Technology": "Office",
    "Internal Audit": "Office",
    "Jakarta": "Lapangan",
    "JKT Training Center": "Lapangan",
    "KMHS": "Lapangan",
    "Legal": "Office",
    "Marketing Development": "Office",
    "Mining Sales & Wenco": "Office",
    "Mining Sales Unit": "Office",
    "NUES": "Lapangan",
    "OFFICE PSS": "Office",
    "Operations and Systems": "Office",
    "Parts Inventory & System": "Office",
    "Parts Inventory System": "Office",
    "Parts Warehouse": "Lapangan",
    "PKL": "Office",
    "PresDir": "Office",
    "Procurement & Invesment": "Office",
    "Procurement & Investment": "Office",
    "Product support admin": "Office",
    "Project Sales Support": "Office",
    "PS Project Operation": "Office",
    "QSHE": "Office",
    "Reseptionis": "Office",
    "Safety Health Environment": "Office",
    "Sales Adm": "Office",
    "Sales Admin": "Office",
    "Sales Planning": "Office",
    "Security": "Lapangan",
    "Tax": "Office",
    "Tech Support": "Lapangan",
    "Technical Support": "Lapangan",
    "Training & Development": "Office",
    "Value Chain Promotion": "Office",
    "Vendor": "Office"
  };

  /* [diagnosis, kelompok penyakit, ICD-10, ISPA non-pneumonia (1/0), diare (1/0)] */
  var DX = [
    ["Common Cold (Nasofaringitis akut)", "Saluran Pernapasan", "J00", 1, 0],
    ["Faringitis akut", "Saluran Pernapasan", "J02.9", 1, 0],
    ["Tonsilitis akut", "Saluran Pernapasan", "J03.9", 1, 0],
    ["Tonsilofaringitis", "Saluran Pernapasan", "J06.8", 1, 0],
    ["Laringitis", "Saluran Pernapasan", "J04.0", 1, 0],
    ["Sinusitis", "Saluran Pernapasan", "J01.9", 1, 0],
    ["Rinitis alergi", "Saluran Pernapasan", "J30.4", 1, 0],
    ["Bronkitis akut", "Saluran Pernapasan", "J20.9", 0, 0],
    ["Asma", "Saluran Pernapasan", "J45.9", 0, 0],
    ["Pleuritis", "Saluran Pernapasan", "R09.1", 0, 0],
    ["GERD", "Pencernaan", "K21.9", 0, 0],
    ["Dispepsia", "Pencernaan", "K30", 0, 0],
    ["Gastritis", "Pencernaan", "K29.7", 0, 0],
    ["Gastroenteritis akut (GEA)", "Pencernaan", "A09", 0, 1],
    ["Kolik abdomen", "Pencernaan", "R10.4", 0, 0],
    ["Konstipasi", "Pencernaan", "K59.0", 0, 0],
    ["Hemoroid", "Pencernaan", "K64.9", 0, 0],
    ["Mual / Vomitus", "Pencernaan", "R11", 0, 0],
    ["Sefalgia", "Neurologi", "R51", 0, 0],
    ["Migren", "Neurologi", "G43.9", 0, 0],
    ["Vertigo", "Neurologi", "R42", 0, 0],
    ["Myalgia", "Muskuloskeletal", "M79.1", 0, 0],
    ["Low Back Pain (LBP)", "Muskuloskeletal", "M54.5", 0, 0],
    ["Artralgia", "Muskuloskeletal", "M25.5", 0, 0],
    ["Osteoartritis", "Muskuloskeletal", "M19.9", 0, 0],
    ["Frozen shoulder", "Muskuloskeletal", "M75.0", 0, 0],
    ["Nyeri lutut", "Muskuloskeletal", "M25.56", 0, 0],
    ["Myospasme", "Muskuloskeletal", "M62.8", 0, 0],
    ["Tendinitis", "Muskuloskeletal", "M77.9", 0, 0],
    ["Iritasi mata", "Mata", "H57.8", 0, 0],
    ["Konjungtivitis", "Mata", "H10.9", 0, 0],
    ["Blefaritis", "Mata", "H01.0", 0, 0],
    ["Hordeolum", "Mata", "H00.0", 0, 0],
    ["Corpus alienum mata", "Cedera / Luka", "T15.9", 0, 0],
    ["Karies dentis", "Gigi &amp; Mulut", "K02.9", 0, 0],
    ["Gingivitis", "Gigi &amp; Mulut", "K05.1", 0, 0],
    ["Pulpitis", "Gigi &amp; Mulut", "K04.0", 0, 0],
    ["Stomatitis", "Gigi &amp; Mulut", "K12.1", 0, 0],
    ["Dermatitis", "Kulit &amp; Alergi", "L30.9", 0, 0],
    ["Herpes", "Kulit &amp; Alergi", "B00.9", 0, 0],
    ["Gigitan serangga", "Kulit &amp; Alergi", "T63.4", 0, 0],
    ["Abses / Furunkel", "Kulit &amp; Alergi", "L02.9", 0, 0],
    ["Alergi / Urtikaria", "Kulit &amp; Alergi", "T78.4", 0, 0],
    ["Skabies", "Kulit &amp; Alergi", "B86", 0, 0],
    ["Tinea", "Kulit &amp; Alergi", "B35.9", 0, 0],
    ["Vulnus (luka lecet/robek)", "Cedera / Luka", "T14.1", 0, 0],
    ["Myotrauma / Kontusio", "Cedera / Luka", "T14.0", 0, 0],
    ["Sprain", "Cedera / Luka", "T14.3", 0, 0],
    ["Strain", "Cedera / Luka", "T14.3", 0, 0],
    ["Luka bakar", "Cedera / Luka", "T30.0", 0, 0],
    ["Hipertensi", "Kardiometabolik", "I10", 0, 0],
    ["Hipotensi", "Kardiometabolik", "I95.9", 0, 0],
    ["Hiperurisemia", "Kardiometabolik", "E79.0", 0, 0],
    ["Diabetes melitus", "Kardiometabolik", "E11.9", 0, 0],
    ["Dislipidemia", "Kardiometabolik", "E78.5", 0, 0],
    ["Nyeri dada", "Kardiometabolik", "R07.4", 0, 0],
    ["Febris", "Infeksi Sistemik &amp; Menular", "R50.9", 0, 0],
    ["Rubella", "Infeksi Sistemik &amp; Menular", "B06.9", 0, 0],
    ["Suspek campak", "Infeksi Sistemik &amp; Menular", "B05.9", 0, 0],
    ["Suspek demam tifoid", "Infeksi Sistemik &amp; Menular", "A01.0", 0, 0],
    ["Varisela", "Infeksi Sistemik &amp; Menular", "B01.9", 0, 0],
    ["Infeksi (tidak spesifik)", "Infeksi Sistemik &amp; Menular", "B99", 0, 0],
    ["Flebitis", "Infeksi Sistemik &amp; Menular", "I80.9", 0, 0],
    ["Infeksi saluran kemih", "Infeksi Sistemik &amp; Menular", "N39.0", 0, 0],
    ["Dismenore", "Kesehatan Reproduksi", "N94.6", 0, 0],
    ["Mastitis", "Kesehatan Reproduksi", "N61", 0, 0],
    ["Hiperemesis gravidarum", "Kesehatan Reproduksi", "O21.0", 0, 0],
    ["Konsultasi", "Lain-lain", "Z71.9", 0, 0],
    ["Kontrol / Health Monitoring", "Lain-lain", "Z09", 0, 0],
    ["Fatigue", "Lain-lain", "R53", 0, 0],
    ["Sinkop", "Lain-lain", "R55", 0, 0],
    ["LPR (Laryngopharyngeal reflux)", "Pencernaan", "K21.9", 0, 0],
    ["Parotitis", "Gigi & Mulut", "K11.2", 0, 0]
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

  /* daftar obat baku [nama, anti-biotik, steroid, NSAID, sedatif, perhatian HT/DM] - sama dengan MASTER_OBAT contoh */
  var DRUG_MASTER = [
    ["Alphara", 0, 0, 0, 1, 1],
    ["Amlodipine", 0, 0, 0, 0, 0],
    ["Asam Mefenamat/Fargetik", 0, 0, 1, 0, 1],
    ["Antacida Doen", 0, 0, 0, 0, 0],
    ["Aspilet", 0, 0, 0, 0, 0],
    ["Bioplacenton", 1, 0, 0, 0, 0],
    ["Buscopan/Scopma", 0, 0, 0, 0, 0],
    ["Bufantacid", 0, 0, 0, 0, 0],
    ["Lasmalin", 0, 0, 0, 0, 0],
    ["Braito/insto", 0, 0, 0, 0, 0],
    ["Becom C", 0, 0, 0, 0, 0],
    ["Cataflam/Kaditic", 0, 0, 1, 0, 1],
    ["Cefadroxil 500 mg /Lostacef", 1, 0, 0, 0, 0],
    ["Cendo Xitrol MD", 1, 0, 0, 0, 0],
    ["Cendo Cenfresh", 0, 0, 0, 0, 0],
    ["Cetirizine/Lerzin", 0, 0, 0, 1, 0],
    ["Counterpain 5 gr", 0, 0, 0, 0, 0],
    ["Ambroxol/Roverton", 0, 0, 0, 0, 0],
    ["Erlamycetin salep Mata", 1, 0, 0, 0, 0],
    ["FG Troches", 1, 0, 0, 0, 0],
    ["Gentanicin salep", 1, 0, 0, 0, 0],
    ["Hydrocortison salep", 0, 0, 0, 0, 0],
    ["Kalmethasone/Faridexon", 0, 1, 0, 0, 1],
    ["Xepazym", 0, 0, 0, 0, 0],
    ["Histigo", 0, 0, 0, 0, 0],
    ["Neoralgin", 0, 0, 1, 0, 1],
    ["New Diatab/AKITA", 0, 0, 0, 0, 0],
    ["Neurodex/Nutralik", 0, 0, 0, 0, 0],
    ["Omeperazole/Lokev", 0, 0, 0, 0, 0],
    ["Ondancentrone/Odanostin", 0, 0, 0, 0, 0],
    ["Primadex/Fasriprim", 1, 0, 0, 0, 0],
    ["Ranitidine/Zantifar", 0, 0, 0, 0, 0],
    ["Sanmol 500 mg", 0, 0, 0, 0, 0],
    ["Spasminal", 0, 0, 0, 0, 0],
    ["Tensicap 12.5 mg", 0, 0, 0, 0, 0],
    ["Trianta", 0, 0, 0, 0, 0],
    ["Voltadex", 0, 0, 1, 0, 1]
  ];

  /* obat untuk saran pengisian (nama persis seperti di master) */
  var DRUGS = DRUG_MASTER.map(function (r) { return r[0]; });

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

  var drugIdx = {}; DRUG_MASTER.forEach(function (r) { drugIdx[norm(r[0])] = r; });

  /** Penanda kelas satu nama obat: dari daftar baku bila namanya sama persis, selain itu dari potongan nama. */
  function drugFlag1(name) {
    var t = norm(name), out = { ab: 0, ster: 0, nsaid: 0, hcc: 0, sed: 0 };
    if (!t) return out;
    var r = drugIdx[t];
    if (r) { out.ab = r[1]; out.ster = r[2]; out.nsaid = r[3]; out.sed = r[4]; out.hcc = r[5]; return out; }
    DRUG_RULES.forEach(function (rule) {
      if (rule.words.some(function (w) { return t.indexOf(w) >= 0; })) out[rule.k] = 1;
    });
    return out;
  }

  /** Penanda kelas obat untuk daftar nama obat: {ab, ster, nsaid, hcc, sed} bernilai 0/1. */
  function drugFlags(names) {
    var out = { ab: 0, ster: 0, nsaid: 0, hcc: 0, sed: 0 };
    (names || []).forEach(function (n) {
      var f = drugFlag1(n);
      Object.keys(out).forEach(function (k) { if (f[k]) out[k] = 1; });
    });
    return out;
  }

  return {
    STATUS: STATUS, NO_NIK_STATUS: NO_NIK_STATUS, DEPT: DEPT, DX: DX, DRUGS: DRUGS, DRUG_MASTER: DRUG_MASTER, DX_ALIAS: DX_ALIAS,
    DEPARTMENTS: Object.keys(DEPT).sort(function (a, b) { return a.toLowerCase() < b.toLowerCase() ? -1 : 1; }),
    DIAGNOSES: DX.map(function (r) { return r[0]; }),
    workGroup: workGroup, lookupDx: lookupDx, drugFlags: drugFlags, drugFlag1: drugFlag1, isMasterDrug: function (n) { return !!drugIdx[norm(n)]; }, norm: norm
  };
});
