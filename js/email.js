/*
 * Klinik HAP - pembuat draf email (logika murni, tanpa DOM).
 * Dipakai di browser (window.KlinikEmail) dan di Node (require) untuk pengujian.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KlinikEmail = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FEEDBACK_LINE =
    'Punya keluhan atau saran pengembangan layanan? Silakan input melalui https://s.id/klinikHAP';

  var FEEDBACK_EN =
    'Have a complaint or a suggestion to improve our services? Please submit it via https://s.id/klinikHAP';

  var LANGS = ['id', 'en'];
  function normLang(l) { return l === 'en' ? 'en' : 'id'; }

  var MONTHS = {
    id: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus',
      'September', 'Oktober', 'November', 'Desember'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
      'September', 'October', 'November', 'December']
  };
  var DAYS = {
    id: ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
    en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  };

  var DEFAULT_SIGNATURE = {
    name: 'Eny Rohmatul Fitri', title: 'Perawat Perusahaan', company: 'PT Hexindo Adiperkasa Tbk'
  };

  var RECOMMENDATIONS = {
    id: {
      FIT: { label: 'Kembali Bekerja (Fit to Work)', short: 'Fit to Work' },
      SICK: { label: 'Istirahat Sakit / Sick Leave', short: 'Istirahat Sakit' },
      REFER: { label: 'Rujukan Lanjutan', short: 'Rujukan Lanjutan' }
    },
    en: {
      FIT: { label: 'Return to Work (Fit to Work)', short: 'Fit to Work' },
      SICK: { label: 'Sick Leave', short: 'Sick Leave' },
      REFER: { label: 'Referral to Further Care', short: 'Referral' }
    }
  };

  /* Teks email per bahasa. Fungsi dipakai bila ada nilai yang disisipkan. */
  var TXT = {
    id: {
      dear: 'Kepada Yth.', mr: 'Bapak/Ibu ', bossFallback: 'Atasan / HRD',
      workerIntro: function (c) { return 'Terima kasih telah berkunjung ke ' + c + '. Berikut ringkasan kunjungan Anda:'; },
      bossIntro: function (c) { return 'Berikut informasi kunjungan karyawan ke ' + c + ':'; },
      name: 'Nama', nik: 'NIK', dept: 'Departemen',
      visitDate: 'Tanggal kunjungan', inOut: 'Jam masuk - keluar', doctor: 'Dokter pemeriksa',
      complaint: 'Keluhan / diagnosa', meds: 'Obat yang diresepkan', noMeds: 'Tidak ada obat yang diresepkan',
      rec: 'Rekomendasi medis', bossRec: 'Status rekomendasi kerja', rest: 'Durasi istirahat', referTo: 'Tujuan rujukan',
      workerSurat: function (no) {
        return 'Surat Keterangan Sakit dengan No. ' + no + ' telah diserahkan langsung kepada Anda di klinik. ' +
          'Mohon disimpan dan diserahkan kepada atasan/HRD sesuai ketentuan perusahaan.';
      },
      bossSurat: function (no) {
        return 'Surat Keterangan Sakit dengan No. ' + no + ' telah diserahkan langsung kepada karyawan yang bersangkutan di klinik. ' +
          'Mohon karyawan dapat menunjukkan surat tersebut sesuai ketentuan perusahaan.';
      },
      workerFit: 'Anda dinyatakan layak kembali bekerja. Bila keluhan muncul kembali atau memburuk, segera kembali ke klinik.',
      workerSick: 'Mohon beristirahat sesuai anjuran dokter. Bila keluhan tidak membaik atau memburuk, segera kembali ke klinik.',
      workerRefer: 'Mohon segera menindaklanjuti rujukan ke fasilitas kesehatan lanjutan dan membawa surat yang telah diberikan.',
      bossFit: 'Karyawan dinyatakan layak kembali bekerja. Tidak ada surat keterangan sakit yang diterbitkan.',
      bossRefer: 'Karyawan direkomendasikan menjalani pemeriksaan lanjutan di fasilitas kesehatan rujukan.',
      privacy: 'Informasi ini hanya memuat status kerja. Rincian medis bersifat rahasia dan tidak disampaikan melalui email ini.',
      workerSubject: function (c, d, no) { return 'Ringkasan Kunjungan ' + c + ' - ' + d + (no ? ' (No. ' + no + ')' : ''); },
      bossSubject: function (n, nik, s) { return 'Informasi Kunjungan Klinik: ' + n + ' (' + nik + ') - ' + s; },
      feedback: FEEDBACK_LINE,
      days: function (n) { return n + ' hari'; }, to: ' s.d. '
    },
    en: {
      dear: 'Dear', mr: '', bossFallback: 'Supervisor / HR',
      workerIntro: function (c) { return 'Thank you for visiting ' + c + '. Here is a summary of your visit:'; },
      bossIntro: function (c) { return 'Below is the visit information for the employee at ' + c + ':'; },
      name: 'Name', nik: 'Employee ID (NIK)', dept: 'Department',
      visitDate: 'Date of visit', inOut: 'Time in - out', doctor: 'Examining doctor',
      complaint: 'Complaint / diagnosis', meds: 'Medication prescribed', noMeds: 'No medication prescribed',
      rec: 'Medical recommendation', bossRec: 'Work status recommendation', rest: 'Rest duration', referTo: 'Referral to',
      workerSurat: function (no) {
        return 'A sick leave certificate (No. ' + no + ') has been handed to you in person at the clinic. ' +
          'Please keep it and submit it to your supervisor/HR according to company policy.';
      },
      bossSurat: function (no) {
        return 'A sick leave certificate (No. ' + no + ') has been handed to the employee in person at the clinic. ' +
          'Please ask the employee to present it according to company policy.';
      },
      workerFit: 'You have been declared fit to return to work. If your symptoms return or get worse, please come back to the clinic right away.',
      workerSick: "Please rest as advised by the doctor. If your symptoms do not improve or get worse, please come back to the clinic right away.",
      workerRefer: 'Please follow up on your referral to the further healthcare facility promptly and bring the letter you were given.',
      bossFit: 'The employee has been declared fit to return to work. No sick leave certificate was issued.',
      bossRefer: 'The employee is recommended to undergo further examination at a referral healthcare facility.',
      privacy: 'This message only covers work status. Medical details are confidential and are not shared by email.',
      workerSubject: function (c, d, no) { return c + ' Visit Summary - ' + d + (no ? ' (No. ' + no + ')' : ''); },
      bossSubject: function (n, nik, s) { return 'Clinic Visit Notice: ' + n + ' (' + nik + ') - ' + s; },
      feedback: FEEDBACK_EN,
      days: function (n) { return n + (n === 1 ? ' day' : ' days'); }, to: ' to '
    }
  };

  /* ---------- tanggal & waktu ---------- */
  function pad(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { return '' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()); }
  function fmtDateShort(d, lang) { return d.getDate() + ' ' + MONTHS[normLang(lang)][d.getMonth()] + ' ' + d.getFullYear(); }
  function fmtDate(d, lang) { return DAYS[normLang(lang)][d.getDay()] + ', ' + fmtDateShort(d, lang); }
  function fmtTime(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  function parseYmd(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }

  /** Rentang istirahat sakit; null bila bukan istirahat sakit. */
  function restRange(v) {
    var days = Math.floor(Number(v.restDays));
    if (v.recommendation !== 'SICK' || !(days >= 1)) return null;
    var vd = new Date(v.visitAt);
    var start = parseYmd(v.restStart) || new Date(vd.getFullYear(), vd.getMonth(), vd.getDate());
    var end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + days - 1);
    return { days: days, start: start, end: end };
  }

  function restText(r, lang) {
    if (!r) return '';
    var t = TXT[normLang(lang)];
    var span = r.days === 1 ? fmtDateShort(r.start, lang) : fmtDateShort(r.start, lang) + t.to + fmtDateShort(r.end, lang);
    return t.days(r.days) + ' (' + span + ')';
  }

  /* ---------- nomor surat ---------- */
  function buildSuratNo(prefix, date, seq) {
    return (prefix || 'SK/KLL') + '/' + ymd(date) + '/' + String(seq).padStart(3, '0');
  }

  /* ---------- email: validasi & utilitas ---------- */
  var EMAIL_RE = /^[^\s@,;<>()]+@[^\s@,;<>()]+\.[^\s@,;<>()]+$/;
  function isEmail(s) { return EMAIL_RE.test(String(s || '').trim()); }
  function splitEmails(s) {
    return String(s || '').split(/[,;\s]+/).map(function (x) { return x.trim(); }).filter(Boolean);
  }

  /* ---------- format teks ---------- */
  function lines(text) {
    return String(text || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
  }
  function bullets(text) {
    return lines(text).map(function (l) { return l.replace(/^(?:[-*•]|\d+[.)])\s+/, ''); });
  }
  /** "Label: nilai" untuk satu baris; blok berindentasi untuk beberapa baris. */
  /** Buang sapaan di depan nama ('Pak Budi' -> 'Budi') agar tidak jadi 'Bapak/Ibu Pak Budi'. */
  function bareName(n) {
    return String(n || '').trim().replace(/^(?:bapak\/ibu|bapak|ibu|pak|bu|mr\.?|mrs\.?|ms\.?)\s+/i, '');
  }
  function row(label, value) {
    var ls = lines(value);
    if (ls.length <= 1) return label + ': ' + (ls[0] || '-');
    return label + ':\n' + ls.map(function (l) { return '  ' + l; }).join('\n');
  }
  function list(label, items, emptyText) {
    if (!items.length) return label + ': ' + emptyText;
    return label + ':\n' + items.map(function (i) { return '  - ' + i; }).join('\n');
  }

  /* ---------- pembuat email ---------- */
  function buildEmails(v, settings, lang) {
    settings = settings || {};
    lang = normLang(lang || settings.emailLang);
    var t = TXT[lang];
    var clinic = settings.clinicName || 'Klinik HAP';
    var visitAt = new Date(v.visitAt);
    var outAt = v.checkOutAt ? new Date(v.checkOutAt) : null;
    var rec = RECOMMENDATIONS[lang][v.recommendation] || { label: '-', short: '-' };
    var range = restRange(v);
    var timeRange = fmtTime(visitAt) + (outAt ? ' - ' + fmtTime(outAt) : '');
    var signer = (v.nurse || settings.nurseName || DEFAULT_SIGNATURE.name);
    var title = settings.nurseTitle || DEFAULT_SIGNATURE.title;
    var company = settings.companyName || DEFAULT_SIGNATURE.company;
    var signature = ['Best Regards,', signer, title, company];
    var cc = splitEmails(settings.ccAlways);
    var hasSurat = v.recommendation === 'SICK' && !!v.suratNo; // surat hanya untuk istirahat sakit

    /* --- Email 1: pekerja --- */
    var w = [];
    w.push(lang === 'en' ? 'Dear ' + bareName(v.name) + ',' : t.dear);
    if (lang === 'id') w.push(t.mr + bareName(v.name));
    if (lang === 'id') w.push(v.dept);
    w.push('');
    w.push(t.workerIntro(clinic));
    w.push('');
    w.push(t.visitDate + ': ' + fmtDate(visitAt, lang));
    w.push(t.inOut + ': ' + timeRange);
    w.push(t.doctor + ': ' + (v.doctor || '-'));
    w.push('');
    w.push(row(t.complaint, v.complaint));
    w.push(list(t.meds, bullets(v.medications), t.noMeds));
    w.push('');
    w.push(t.rec + ': ' + rec.label);
    if (range) w.push(t.rest + ': ' + restText(range, lang));
    if (v.recommendation === 'REFER' && v.referralTo) w.push(t.referTo + ': ' + v.referralTo);
    w.push('');
    if (hasSurat) { w.push(t.workerSurat(v.suratNo)); w.push(''); }
    if (v.recommendation === 'FIT') w.push(t.workerFit);
    else if (v.recommendation === 'SICK') w.push(t.workerSick);
    else if (v.recommendation === 'REFER') w.push(t.workerRefer);
    w.push('');
    signature.forEach(function (l) { w.push(l); });
    w.push('');
    w.push('--');
    w.push(t.feedback);

    /* --- Email 2: atasan / HRD (tanpa diagnosis & obat) --- */
    var b = [];
    var bossName = bareName(v.supervisorName) || t.bossFallback;
    if (lang === 'en') b.push('Dear ' + bossName + ',');
    else { b.push(t.dear); b.push(t.mr + bossName); }
    b.push('');
    b.push(t.bossIntro(clinic));
    b.push('');
    b.push(t.name + ': ' + v.name);
    b.push(t.nik + ': ' + v.nik);
    b.push(t.dept + ': ' + v.dept);
    b.push('');
    b.push(t.visitDate + ': ' + fmtDate(visitAt, lang));
    b.push(t.inOut + ': ' + timeRange);
    b.push('');
    b.push(t.bossRec + ': ' + rec.label);
    if (range) b.push(t.rest + ': ' + restText(range, lang));
    b.push('');
    if (hasSurat) { b.push(t.bossSurat(v.suratNo)); b.push(''); }
    else if (v.recommendation === 'FIT') { b.push(t.bossFit); b.push(''); }
    if (v.recommendation === 'REFER') { b.push(t.bossRefer); b.push(''); }
    b.push(t.privacy);
    b.push('');
    signature.forEach(function (l) { b.push(l); });
    b.push('');
    b.push('--');
    b.push(t.feedback);

    var hrd = splitEmails(v.hrdEmail);
    return {
      worker: {
        to: v.workerEmail || '',
        cc: cc.join(', '),
        subject: t.workerSubject(clinic, fmtDateShort(visitAt, lang), hasSurat ? v.suratNo : ''),
        body: w.join('\n')
      },
      boss: {
        to: v.supervisorEmail || '',
        cc: hrd.concat(cc).join(', '),
        subject: t.bossSubject(v.name, v.nik, rec.short),
        body: b.join('\n')
      }
    };
  }

  /* ---------- HTML (agar link bisa diklik) ---------- */
  function escapeHtml(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function linkify(escaped) {
    return escaped.replace(/(https?:\/\/[^\s<]*[^\s<.,;:!?)])/g, '<a href="$1">$1</a>');
  }
  function lineHtml(line) {
    var indent = /^ */.exec(line)[0].length;
    return new Array(indent + 1).join('&nbsp;') + linkify(escapeHtml(line.slice(indent)));
  }
  /** Paragraf berisi "Label: nilai" (nilai boleh berlanjut di baris berindentasi) -> daftar baris, atau null. */
  function parseDetails(p) {
    var rows = [];
    var lines = p.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (/^\s{2,}\S/.test(line) && rows.length) { rows[rows.length - 1].lines.push(line.trim()); continue; }
      var m = /^([^:\n]{2,40}):(?:\s+(.+))?$/.exec(line);
      if (!m) return null;
      rows.push({ label: m[1], lines: m[2] ? [m[2]] : [] });
    }
    if (!rows.length) return null;
    for (var j = 0; j < rows.length; j++) if (!rows[j].lines.length) return null;
    return rows;
  }
  function valueHtml(ls) {
    var out = [], items = [];
    function flush() {
      if (items.length) {
        out.push('<ul style="' + CELL_FONT + 'margin:0;padding-left:20px">' + items.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>');
        items = [];
      }
    }
    ls.forEach(function (l) {
      var m = /^[-*\u2022]\s+(.*)$/.exec(l);
      if (m) items.push(linkify(escapeHtml(m[1])));
      else { flush(); out.push(linkify(escapeHtml(l))); }
    });
    flush();
    return out.join('<br>');
  }
  var CELL_FONT = 'font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1f2328;';
  function detailsTable(groups) {
    var trs = [];
    groups.forEach(function (rows, gi) {
      if (gi > 0) trs.push('<tr><td colspan="2" style="height:10px;line-height:10px;font-size:1px">&nbsp;</td></tr>');
      rows.forEach(function (r) {
        trs.push('<tr><td valign="top" nowrap style="' + CELL_FONT + 'padding:3px 18px 3px 0;font-weight:bold;white-space:nowrap">' +
          escapeHtml(r.label) + '</td><td valign="top" style="' + CELL_FONT + 'padding:3px 0">' + valueHtml(r.lines) + '</td></tr>');
      });
    });
    return '<table border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 14px 0">' + trs.join('') + '</table>';
  }

  /** Ubah teks email menjadi HTML: rincian berlabel menjadi tabel rapi; URL menjadi tautan yang dapat diklik. */
  function toHtml(text) {
    var paras = String(text || '').replace(/\r\n/g, '\n').split(/\n{2,}/);
    var out = [], pending = [];
    function flushTable() { if (pending.length) { out.push(detailsTable(pending)); pending = []; } }
    paras.forEach(function (p) {
      var rows = parseDetails(p);
      if (rows) { pending.push(rows); return; }
      flushTable();
      out.push('<p style="margin:0 0 14px 0;line-height:1.4">' + p.split('\n').map(lineHtml).join('<br>') + '</p>');
    });
    flushTable();
    return '<div style="font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1f2328">' + out.join('') + '</div>';
  }

  /* ---------- mailto & .eml ---------- */
  function mailtoUrl(m) {
    var q = [];
    if (m.cc) q.push('cc=' + encodeURIComponent(m.cc));
    q.push('subject=' + encodeURIComponent(m.subject || ''));
    if (m.body) q.push('body=' + encodeURIComponent(String(m.body).replace(/\r?\n/g, '\r\n')));
    return 'mailto:' + encodeURIComponent(m.to || '').replace(/%2C/gi, ',').replace(/%40/g, '@') + '?' + q.join('&');
  }

  function b64(str) {
    if (typeof Buffer !== 'undefined') return Buffer.from(str, 'utf8').toString('base64');
    var bytes = new TextEncoder().encode(str), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function encodeHeader(text) {
    if (/^[\x20-\x7e]*$/.test(text)) return text;
    var chars = Array.from(text), parts = [];
    for (var i = 0; i < chars.length; i += 15) parts.push('=?UTF-8?B?' + b64(chars.slice(i, i + 15).join('')) + '?=');
    return parts.join('\r\n ');
  }

  function wrap76(b) { return b.replace(/(.{76})/g, '$1\r\n'); }
  function crlf(t) { return String(t || '').replace(/\r?\n/g, '\r\n'); }

  /** File .eml (draf; Outlook membukanya sebagai email yang siap dikirim). Bila ada m.html: teks + HTML. */
  function toEml(m) {
    var h = [];
    h.push('X-Unsent: 1');
    if (m.to) h.push('To: ' + m.to);
    if (m.cc) h.push('Cc: ' + m.cc);
    h.push('Subject: ' + encodeHeader(m.subject || ''));
    h.push('MIME-Version: 1.0');
    if (!m.html) {
      h.push('Content-Type: text/plain; charset=UTF-8');
      h.push('Content-Transfer-Encoding: base64');
      return h.join('\r\n') + '\r\n\r\n' + wrap76(b64(crlf(m.body))) + '\r\n';
    }
    var bd = '=_klinikhap_' + Math.random().toString(36).slice(2, 12);
    h.push('Content-Type: multipart/alternative; boundary="' + bd + '"');
    function part(type, content) {
      return '--' + bd + '\r\nContent-Type: ' + type + '; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n' +
        wrap76(b64(content)) + '\r\n';
    }
    return h.join('\r\n') + '\r\n\r\n' + part('text/plain', crlf(m.body)) + part('text/html', m.html) + '--' + bd + '--\r\n';
  }

  return {
    FEEDBACK_LINE: FEEDBACK_LINE, FEEDBACK_EN: FEEDBACK_EN, LANGS: LANGS, normLang: normLang, DEFAULT_SIGNATURE: DEFAULT_SIGNATURE,
    RECOMMENDATIONS: RECOMMENDATIONS,
    pad: pad, ymd: ymd, fmtDate: fmtDate, fmtDateShort: fmtDateShort, fmtTime: fmtTime,
    parseYmd: parseYmd, restRange: restRange, restText: restText,
    buildSuratNo: buildSuratNo, isEmail: isEmail, splitEmails: splitEmails,
    buildEmails: buildEmails, toHtml: toHtml, mailtoUrl: mailtoUrl, toEml: toEml
  };
});
