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
    var signer = (v.nurse || settings.nurseName || 'Petugas Klinik');
    var cc = splitEmails(settings.ccAlways);
    var suratLine = 'Surat Keterangan resmi dengan No. ' + v.suratNo +
      ' telah diserahkan langsung kepada yang bersangkutan di klinik.';

    /* --- Email 1: pekerja --- */
    var w = [];
    w.push('Kepada Yth.');
    w.push('Bapak/Ibu ' + v.name);
    w.push('NIK ' + v.nik + ' - ' + v.dept);
    w.push('');
    w.push('Terima kasih telah berkunjung ke ' + clinic + '. Berikut ringkasan kunjungan Anda:');
    w.push('');
    w.push('Tanggal kunjungan: ' + fmtDate(visitAt));
    w.push('Jam masuk - keluar: ' + timeRange);
    w.push('Dokter pemeriksa: ' + (v.doctor || '-'));
    w.push(row('Keluhan / diagnosa', v.complaint));
    w.push(list('Obat yang diresepkan', bullets(v.medications), 'Tidak ada obat yang diresepkan'));
    w.push('Rekomendasi medis: ' + rec.label);
    if (range) w.push('Durasi istirahat: ' + restText(range));
    if (v.recommendation === 'REFER' && v.referralTo) w.push('Tujuan rujukan: ' + v.referralTo);
    w.push('');
    w.push('Surat Keterangan resmi dengan No. ' + v.suratNo +
      ' telah diserahkan langsung kepada Anda di klinik. Mohon disimpan dan ' +
      'diserahkan kepada atasan/HRD sesuai ketentuan perusahaan bila diperlukan.');
    w.push('');
    if (v.recommendation === 'FIT') {
      w.push('Anda dinyatakan layak kembali bekerja. Bila keluhan muncul kembali atau memburuk, segera kembali ke klinik.');
    } else if (v.recommendation === 'SICK') {
      w.push('Mohon beristirahat sesuai anjuran dokter. Bila keluhan tidak membaik atau memburuk, segera kembali ke klinik.');
    } else if (v.recommendation === 'REFER') {
      w.push('Mohon segera menindaklanjuti rujukan ke fasilitas kesehatan lanjutan dan membawa surat yang telah diberikan.');
    }
    w.push('');
    w.push('Salam sehat,');
    w.push(signer);
    w.push(clinic);
    w.push('');
    w.push('--');
    w.push(FEEDBACK_LINE);

    /* --- Email 2: atasan / HRD (tanpa diagnosis & obat) --- */
    var b = [];
    b.push('Kepada Yth.');
    b.push('Bapak/Ibu ' + (v.supervisorName || 'Atasan / HRD'));
    b.push('');
    b.push('Berikut informasi kunjungan karyawan ke ' + clinic + ':');
    b.push('');
    b.push('Nama: ' + v.name);
    b.push('NIK: ' + v.nik);
    b.push('Departemen: ' + v.dept);
    b.push('Tanggal kunjungan: ' + fmtDate(visitAt));
    b.push('Jam masuk - keluar: ' + timeRange);
    b.push('Status rekomendasi kerja: ' + rec.label);
    if (range) b.push('Durasi istirahat: ' + restText(range));
    b.push('');
    b.push(suratLine + ' Mohon karyawan yang bersangkutan dapat menunjukkan surat tersebut sesuai ketentuan perusahaan.');
    b.push('');
    if (v.recommendation === 'REFER') {
      b.push('Karyawan direkomendasikan menjalani pemeriksaan lanjutan di fasilitas kesehatan rujukan.');
      b.push('');
    }
    b.push('Informasi ini hanya memuat status kerja. Rincian medis bersifat rahasia dan tidak disampaikan melalui email ini.');
    b.push('');
    b.push('Hormat kami,');
    b.push(signer);
    b.push(clinic);
    b.push('');
    b.push('--');
    b.push(FEEDBACK_LINE);

    var hrd = splitEmails(v.hrdEmail);
    return {
      worker: {
        to: v.workerEmail || '',
        cc: cc.join(', '),
        subject: 'Ringkasan Kunjungan ' + clinic + ' - ' + fmtDateShort(visitAt) + ' (No. ' + v.suratNo + ')',
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

  /** File .eml (draf; Outlook membukanya sebagai email yang siap dikirim). */
  function toEml(m) {
    var h = [];
    h.push('X-Unsent: 1');
    if (m.to) h.push('To: ' + m.to);
    if (m.cc) h.push('Cc: ' + m.cc);
    h.push('Subject: ' + encodeHeader(m.subject || ''));
    h.push('MIME-Version: 1.0');
    h.push('Content-Type: text/plain; charset=UTF-8');
    h.push('Content-Transfer-Encoding: base64');
    var body = b64(String(m.body || '').replace(/\r?\n/g, '\r\n')).replace(/(.{76})/g, '$1\r\n');
    return h.join('\r\n') + '\r\n\r\n' + body + '\r\n';
  }

  return {
    FEEDBACK_LINE: FEEDBACK_LINE,
    RECOMMENDATIONS: RECOMMENDATIONS,
    pad: pad, ymd: ymd, fmtDate: fmtDate, fmtDateShort: fmtDateShort, fmtTime: fmtTime,
    parseYmd: parseYmd, restRange: restRange, restText: restText,
    buildSuratNo: buildSuratNo, isEmail: isEmail, splitEmails: splitEmails,
    buildEmails: buildEmails, mailtoUrl: mailtoUrl, toEml: toEml
  };
});
