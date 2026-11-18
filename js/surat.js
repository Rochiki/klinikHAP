/*
 * Klinik HAP - Surat Keterangan Sakit (PDF) dengan kode QR dan kode verifikasi.
 * Surat TIDAK memuat diagnosis: salinan yang sama dikirim ke pekerja, atasan, dan HC.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./email.js'), require('./pdf.js'), require('./sha256.js'), require('./vendor/qrcode.js'));
  } else root.KlinikSurat = factory(root.KlinikEmail, root.KlinikPdf, root.KlinikSha256, root.qrcode);
})(typeof self !== 'undefined' ? self : this, function (E, P, SHA, qrcode) {
  'use strict';

  var ORANGE = 'F26A1B', CHARCOAL = '23272E', GREY = '5B6470';

  var T = {
    id: {
      clinic: 'PELAYANAN KESEHATAN', title: 'SURAT KETERANGAN SAKIT', no: 'Nomor',
      intro: 'Berdasarkan hasil pemeriksaan dokter perusahaan, dengan ini diterangkan bahwa:',
      name: 'Nama', nik: 'NIK', dept: 'Departemen', company: 'Perusahaan',
      sick: function (n) { return ['Dalam keadaan ', 'SAKIT', ' dan memerlukan istirahat selama ' + n + ' hari.']; },
      from: 'Terhitung mulai tanggal', to: 'Sampai dengan tanggal',
      closing: 'Demikian surat keterangan ini dibuat untuk dapat dipergunakan sebagaimana mestinya.',
      auto: 'Dokumen ini diterbitkan secara otomatis oleh sistem berdasarkan konsultasi yang dilakukan dengan dokter perusahaan, sehingga tidak memerlukan tanda tangan basah.',
      conf: 'Rincian medis bersifat rahasia dan tidak dicantumkan pada surat ini.',
      issuedBy: 'Diterbitkan atas konsultasi dengan', doctorRole: 'Dokter Perusahaan', sip: 'No. SIP',
      recorded: 'Dicatat oleh', code: 'Kode verifikasi', scan: 'Pindai kode QR untuk memeriksa keabsahan surat ini.',
      printed: 'Diterbitkan', place: 'Jakarta'
    },
    en: {
      clinic: 'HEALTH SERVICES', title: 'SICK LEAVE CERTIFICATE', no: 'Number',
      intro: 'Based on the examination by the company doctor, this is to certify that:',
      name: 'Name', nik: 'Employee ID (NIK)', dept: 'Department', company: 'Company',
      sick: function (n) { return ['Is ', 'SICK', ' and requires rest for ' + n + (n === 1 ? ' day.' : ' days.')]; },
      from: 'Starting from', to: 'Until',
      closing: 'This certificate is issued to be used as appropriate.',
      auto: 'This document was issued automatically by the system based on a consultation with the company doctor, and therefore does not require a wet signature.',
      conf: 'Medical details are confidential and are not stated in this certificate.',
      issuedBy: 'Issued following consultation with', doctorRole: 'Company Doctor', sip: 'Licence No. (SIP)',
      recorded: 'Recorded by', code: 'Verification code', scan: 'Scan the QR code to verify this certificate.',
      printed: 'Issued', place: 'Jakarta'
    }
  };

  function ascii(s) {
    return String(s || '').normalize ? String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '') : String(s || '');
  }
  function randomSecret() {
    var a = '';
    try {
      var b = new Uint8Array(16); (self.crypto || {}).getRandomValues(b);
      b.forEach(function (x) { a += ('0' + x.toString(16)).slice(-2); });
    } catch (e) { a = String(Date.now()) + Math.random().toString(16).slice(2); }
    return a;
  }

  /** Kode verifikasi 8 karakter (XXXX-XXXX) dari data surat + rahasia lokal. */
  function verifyCode(v, secret) {
    var r = E.restRange(v);
    var src = [secret || '', v.suratNo, v.nik || '', v.name || '', r ? E.ymd(r.start) : '', r ? r.days : '', v.doctor || ''].join('|');
    var h = SHA.hex(src).slice(0, 8).toUpperCase();
    return h.slice(0, 4) + '-' + h.slice(4);
  }

  var DEFAULT_VERIFY_URL = 'https://rochiki.github.io/klinikHAP/';

  /**
   * Isi QR: tautan verifikasi (bawaan: halaman klinikHAP di GitHub Pages) agar kamera ponsel membuka halaman,
   * bukan mencari teks di mesin pencari. Fragmen (#) hanya memuat data minimal: nomor, kode, dokter,
   * waktu terbit, lama istirahat. TANPA nama, NIK, atau diagnosis. Isi '-' di Pengaturan untuk QR teks biasa.
   */
  function qrPayload(v, settings, code) {
    var r = E.restRange(v);
    var base = String(settings.verifyUrl || '').trim();
    if (base !== '-') {
      base = (base || DEFAULT_VERIFY_URL).replace(/#.*$/, '');
      return base + '#v=' + encodeURIComponent(v.suratNo) + '|' + code +
        '&dr=' + encodeURIComponent(ascii(v.doctor)) +
        '&t=' + encodeURIComponent(v.visitAt ? new Date(v.visitAt).toISOString() : '') +
        '&n=' + (r ? r.days : '');
    }
    return ['HEXINDO - SURAT KETERANGAN SAKIT', 'No: ' + v.suratNo, 'Nama: ' + ascii(v.name), 'NIK: ' + (v.nik || '-'),
      'Istirahat: ' + (r ? r.days + ' hari ' + E.ymd(r.start) + '-' + E.ymd(r.end) : '-'),
      'Dokter: ' + ascii(v.doctor), 'Kode: ' + code].join('\n');
  }

  function fileName(v) { return 'Surat-Sakit-' + String(v.suratNo).replace(/[^A-Za-z0-9]+/g, '-') + '.pdf'; }

  /**
   * Bangun PDF. opts: { lang, secret, logo:{bytes,width,height}|null, now }.
   * Mengembalikan { bytes, filename, code, payload }.
   */
  function build(v, settings, opts) {
    opts = opts || {};
    settings = settings || {};
    var lang = E.normLang(opts.lang || settings.emailLang), t = T[lang];
    var range = E.restRange(v);
    if (!range || !v.suratNo) throw new Error('Surat hanya untuk istirahat sakit dengan nomor surat.');
    var code = verifyCode(v, opts.secret || settings.verifySecret);
    var payload = qrPayload(v, settings, code);
    var d = new P.Doc({ title: t.title + ' ' + v.suratNo });
    var L = 52, R = d.w - 52, cw = R - L;

    /* kop */
    var textX = L;
    if (opts.logo) {
      var lh = 38, lw = lh * opts.logo.width / opts.logo.height;
      d.image(opts.logo, L, 36, lw, lh);
      textX = L + lw + 22;
    }
    d.text(textX, 50, t.clinic, { size: 12, bold: true, color: CHARCOAL });
    d.text(textX, 63, settings.companyName || 'PT Hexindo Adiperkasa Tbk', { size: 10, bold: true, color: CHARCOAL });
    var y = 75;
    P.wrap(settings.address || '', R - textX, 8.5, false).forEach(function (ln) { d.text(textX, y, ln, { size: 8.5, color: GREY }); y += 10.5; });
    if (settings.phone) { d.text(textX, y, 'Telp. ' + settings.phone, { size: 8.5, color: GREY }); y += 10.5; }
    var rule = Math.max(y + 4, 98);
    d.line(L, rule, R, rule, { w: 2.2, color: ORANGE });
    d.line(L, rule + 3.2, R, rule + 3.2, { w: 0.6, color: CHARCOAL });

    /* judul */
    y = rule + 38;
    d.text(d.w / 2, y, t.title, { size: 14, bold: true, align: 'center', underline: true, color: CHARCOAL });
    d.text(d.w / 2, y + 17, t.no + ' : ' + v.suratNo, { size: 10.5, bold: true, align: 'center' });

    /* identitas */
    y += 52;
    d.text(L, y, t.intro, { size: 10.5 });
    y += 24;
    var rows = [[t.name, v.name], [t.nik, v.nik || '-'], [t.dept, v.dept || '-'], [t.company, settings.companyName || 'PT Hexindo Adiperkasa Tbk']];
    rows.forEach(function (r) {
      d.text(L + 18, y, r[0], { size: 10.5 }); d.text(L + 128, y, ':', { size: 10.5 });
      d.text(L + 140, y, r[1], { size: 10.5, bold: r[0] === t.name });
      y += 17;
    });

    /* isi */
    y += 12;
    var parts = t.sick(range.days), x = L;
    x += d.text(x, y, parts[0], { size: 10.5 });
    x += d.text(x, y, parts[1], { size: 10.5, bold: true });
    d.text(x, y, parts[2], { size: 10.5 });
    y += 17;
    d.text(L, y, t.from + ' ' + E.fmtDate(range.start, lang), { size: 10.5 }); y += 17;
    d.text(L, y, t.to + ' ' + E.fmtDate(range.end, lang), { size: 10.5 }); y += 28;
    d.text(L, y, t.closing, { size: 10.5 }); y += 30;

    /* catatan sistem */
    var note = t.auto + ' ' + t.conf;
    var lines = P.wrap(note, cw - 24, 9, false), bh = lines.length * 12 + 40;
    d.rect(L, y, cw, bh, { fill: 'F4F6F8', stroke: 'D5D9DF', lw: 0.6 });
    d.rect(L, y, 3.5, bh, { fill: ORANGE });
    var ny = y + 15;
    lines.forEach(function (ln) { d.text(L + 14, ny, ln, { size: 9, italic: true, color: '333B45' }); ny += 12; });
    d.text(L + 14, ny + 4, t.issuedBy + ' ' + (v.doctor || '-') + (v.doctorSip ? ' (' + t.sip + ' ' + v.doctorSip + ')' : '') + '.',
      { size: 9, bold: true, color: CHARCOAL });
    y += bh + 30;

    /* blok kanan: tempat/tanggal, QR, dokter */
    var cx = R - 78, qsize = 92;
    var issued = new Date(v.visitAt);
    d.text(cx, y, t.place + ', ' + E.fmtDateShort(issued, lang), { size: 10.5, align: 'center' });
    var qr = qrcode(0, 'M'); qr.addData(payload); qr.make();
    var qy = y + 8;
    d.rect(cx - qsize / 2 - 5, qy - 5, qsize + 10, qsize + 10, { fill: 'FFFFFF', stroke: 'D5D9DF', lw: 0.6 });
    d.qr(function (r, c) { return qr.isDark(r, c); }, qr.getModuleCount(), cx - qsize / 2, qy, qsize);
    var dy = qy + qsize + 24;
    d.text(cx, dy, v.doctor || '-', { size: 10.5, bold: true, align: 'center', underline: true });
    d.text(cx, dy + 13, t.doctorRole, { size: 9.5, align: 'center' });
    if (v.doctorSip) d.text(cx, dy + 25, t.sip + ' : ' + v.doctorSip, { size: 8.5, align: 'center', color: GREY });

    /* blok kiri: verifikasi */
    var vy = y + 14;
    d.text(L, vy, t.code, { size: 9, color: GREY });
    d.text(L, vy + 17, code, { size: 15, bold: true, color: CHARCOAL });
    P.wrap(t.scan, 200, 8.5, false).forEach(function (ln, i) { d.text(L, vy + 33 + i * 11, ln, { size: 8.5, color: GREY }); });
    if (v.nurse) d.text(L, vy + 70, t.recorded + ': ' + v.nurse + (settings.nurseTitle ? ', ' + settings.nurseTitle : ''), { size: 8.5, color: GREY });

    /* kaki */
    d.line(L, d.h - 52, R, d.h - 52, { w: 0.5, color: 'C7CCD3' });
    d.text(L, d.h - 40, t.printed + ' ' + E.fmtDate(issued, lang) + ' · ' + v.suratNo, { size: 8, color: GREY });
    d.text(R, d.h - 40, 'Klinik HAP', { size: 8, color: GREY, align: 'right' });

    return { bytes: d.build(), filename: fileName(v), code: code, payload: payload };
  }

  return { build: build, verifyCode: verifyCode, qrPayload: qrPayload, fileName: fileName, randomSecret: randomSecret, T: T };
});
