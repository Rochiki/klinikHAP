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

  var MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus',
    'September', 'Oktober', 'November', 'Desember'];
  var DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  var DEFAULT_SIGNATURE = {
    name: 'Eny Rohmatul Fitri', title: 'Perawat Perusahaan', company: 'PT Hexindo Adiperkasa Tbk'
  };

  var RECOMMENDATIONS = {
    FIT: { label: 'Kembali Bekerja (Fit to Work)', short: 'Fit to Work' },
    SICK: { label: 'Istirahat Sakit / Sick Leave', short: 'Istirahat Sakit' },
    REFER: { label: 'Rujukan Lanjutan', short: 'Rujukan Lanjutan' }
  };

  /* ---------- tanggal & waktu ---------- */
  function pad(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { return '' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()); }
  function fmtDateShort(d) { return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function fmtDate(d) { return DAYS[d.getDay()] + ', ' + fmtDateShort(d); }
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

  function restText(r) {
    if (!r) return '';
    var span = r.days === 1 ? fmtDateShort(r.start) : fmtDateShort(r.start) + ' s.d. ' + fmtDateShort(r.end);
    return r.days + ' hari (' + span + ')';
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
  function buildEmails(v, settings) {
    settings = settings || {};
    var clinic = settings.clinicName || 'Klinik HAP';
    var visitAt = new Date(v.visitAt);
    var outAt = v.checkOutAt ? new Date(v.checkOutAt) : null;
    var rec = RECOMMENDATIONS[v.recommendation] || { label: '-', short: '-' };
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
    w.push('Kepada Yth.');
    w.push('Bapak/Ibu ' + bareName(v.name));
    w.push(v.dept);
    w.push('');
    w.push('Terima kasih telah berkunjung ke ' + clinic + '. Berikut ringkasan kunjungan Anda:');
    w.push('');
    w.push('Tanggal kunjungan: ' + fmtDate(visitAt));
    w.push('Jam masuk - keluar: ' + timeRange);
    w.push('Dokter pemeriksa: ' + (v.doctor || '-'));
    w.push('');
    w.push(row('Keluhan / diagnosa', v.complaint));
    w.push(list('Obat yang diresepkan', bullets(v.medications), 'Tidak ada obat yang diresepkan'));
    w.push('');
    w.push('Rekomendasi medis: ' + rec.label);
    if (range) w.push('Durasi istirahat: ' + restText(range));
    if (v.recommendation === 'REFER' && v.referralTo) w.push('Tujuan rujukan: ' + v.referralTo);
    w.push('');
    if (hasSurat) {
      w.push('Surat Keterangan Sakit dengan No. ' + v.suratNo +
        ' telah diserahkan langsung kepada Anda di klinik. Mohon disimpan dan ' +
        'diserahkan kepada atasan/HRD sesuai ketentuan perusahaan.');
      w.push('');
    }
    if (v.recommendation === 'FIT') {
      w.push('Anda dinyatakan layak kembali bekerja. Bila keluhan muncul kembali atau memburuk, segera kembali ke klinik.');
    } else if (v.recommendation === 'SICK') {
      w.push('Mohon beristirahat sesuai anjuran dokter. Bila keluhan tidak membaik atau memburuk, segera kembali ke klinik.');
    } else if (v.recommendation === 'REFER') {
      w.push('Mohon segera menindaklanjuti rujukan ke fasilitas kesehatan lanjutan dan membawa surat yang telah diberikan.');
    }
    w.push('');
    signature.forEach(function (l) { w.push(l); });
    w.push('');
    w.push('--');
    w.push(FEEDBACK_LINE);

    /* --- Email 2: atasan / HRD (tanpa diagnosis & obat) --- */
    var b = [];
    b.push('Kepada Yth.');
    b.push('Bapak/Ibu ' + (bareName(v.supervisorName) || 'Atasan / HRD'));
    b.push('');
    b.push('Berikut informasi kunjungan karyawan ke ' + clinic + ':');
    b.push('');
    b.push('Nama: ' + v.name);
    b.push('NIK: ' + v.nik);
    b.push('Departemen: ' + v.dept);
    b.push('');
    b.push('Tanggal kunjungan: ' + fmtDate(visitAt));
    b.push('Jam masuk - keluar: ' + timeRange);
    b.push('');
    b.push('Status rekomendasi kerja: ' + rec.label);
    if (range) b.push('Durasi istirahat: ' + restText(range));
    b.push('');
    if (hasSurat) {
      b.push('Surat Keterangan Sakit dengan No. ' + v.suratNo +
        ' telah diserahkan langsung kepada karyawan yang bersangkutan di klinik. Mohon karyawan dapat menunjukkan surat tersebut sesuai ketentuan perusahaan.');
      b.push('');
    } else if (v.recommendation === 'FIT') {
      b.push('Karyawan dinyatakan layak kembali bekerja. Tidak ada surat keterangan sakit yang diterbitkan.');
      b.push('');
    }
    if (v.recommendation === 'REFER') {
      b.push('Karyawan direkomendasikan menjalani pemeriksaan lanjutan di fasilitas kesehatan rujukan.');
      b.push('');
    }
    b.push('Informasi ini hanya memuat status kerja. Rincian medis bersifat rahasia dan tidak disampaikan melalui email ini.');
    b.push('');
    signature.forEach(function (l) { b.push(l); });
    b.push('');
    b.push('--');
    b.push(FEEDBACK_LINE);

    var hrd = splitEmails(v.hrdEmail);
    return {
      worker: {
        to: v.workerEmail || '',
        cc: cc.join(', '),
        subject: 'Ringkasan Kunjungan ' + clinic + ' - ' + fmtDateShort(visitAt) + (hasSurat ? ' (No. ' + v.suratNo + ')' : ''),
        body: w.join('\n')
      },
      boss: {
        to: v.supervisorEmail || '',
        cc: hrd.concat(cc).join(', '),
        subject: 'Informasi Kunjungan Klinik: ' + v.name + ' (' + v.nik + ') - ' + rec.short,
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
    FEEDBACK_LINE: FEEDBACK_LINE, DEFAULT_SIGNATURE: DEFAULT_SIGNATURE,
    RECOMMENDATIONS: RECOMMENDATIONS,
    pad: pad, ymd: ymd, fmtDate: fmtDate, fmtDateShort: fmtDateShort, fmtTime: fmtTime,
    parseYmd: parseYmd, restRange: restRange, restText: restText,
    buildSuratNo: buildSuratNo, isEmail: isEmail, splitEmails: splitEmails,
    buildEmails: buildEmails, toHtml: toHtml, mailtoUrl: mailtoUrl, toEml: toEml
  };
});
