/*
 * Klinik HAP - penulis PDF minimal (tanpa dependensi, jalan di browser dan Node).
 * Mendukung teks (Helvetica standar, WinAnsi), garis, kotak, gambar JPEG, dan kode QR vektor.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KlinikPdf = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* lebar glyph Helvetica / Helvetica-Bold (per 1000 em) untuk kode WinAnsi 32..255 */
  var W_REG = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, 350, 278, 350, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 350, 611, 350, 350, 222, 222, 333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, 350, 500, 667, 278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333, 400, 584, 333, 333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611, 667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, 556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278, 556, 556, 556, 556, 556, 556, 556, 584, 611, 556, 556, 556, 556, 500, 556, 500];
  var W_BOLD = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584, 350, 278, 350, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, 350, 611, 350, 350, 278, 278, 500, 500, 350, 556, 1000, 333, 1000, 556, 333, 944, 350, 500, 667, 278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 333, 400, 584, 333, 333, 333, 611, 556, 278, 333, 333, 365, 556, 834, 834, 834, 611, 722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, 556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278, 611, 611, 611, 611, 611, 611, 611, 584, 611, 611, 611, 611, 611, 556, 611, 556];

  var CP1252 = { 0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
    0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92,
    0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A,
    0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F };

  function code(ch) {
    var c = ch.charCodeAt(0);
    if (c === 0x2192) return 0x3E; // panah -> '>'
    if (c < 0x80 || (c >= 0xA0 && c <= 0xFF)) return c < 32 ? 32 : c;
    return CP1252[c] || 0x3F;
  }
  function width(str, size, bold) {
    var tbl = bold ? W_BOLD : W_REG, w = 0;
    for (var i = 0; i < str.length; i++) { var c = code(str.charAt(i)); w += tbl[c - 32] != null ? tbl[c - 32] : 500; }
    return w * size / 1000;
  }
  function pdfStr(str) {
    var out = '';
    for (var i = 0; i < str.length; i++) {
      var c = code(str.charAt(i)), ch = String.fromCharCode(c);
      out += (ch === '(' || ch === ')' || ch === '\\') ? '\\' + ch : ch;
    }
    return out;
  }
  function num(n) { return (Math.round(n * 100) / 100).toString(); }
  function rgb(hex) {
    hex = String(hex || '000000').replace('#', '');
    return [0, 2, 4].map(function (i) { return num(parseInt(hex.substr(i, 2), 16) / 255); }).join(' ');
  }
  function latin1(s) { var a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 255; return a; }

  /** Pecah teks menjadi baris selebar maxW. */
  function wrap(text, maxW, size, bold) {
    var out = [];
    String(text).split(/\n/).forEach(function (para) {
      var words = para.split(/\s+/).filter(Boolean), line = '';
      if (!words.length) { out.push(''); return; }
      words.forEach(function (w) {
        var t = line ? line + ' ' + w : w;
        if (width(t, size, bold) <= maxW || !line) line = t; else { out.push(line); line = w; }
      });
      out.push(line);
    });
    return out;
  }

  function Doc(opts) {
    opts = opts || {};
    this.w = opts.width || 595.28; this.h = opts.height || 841.89;
    this.ops = []; this.images = []; this.title = opts.title || '';
  }
  /* y diukur dari atas halaman; baseline teks pada y */
  Doc.prototype.text = function (x, y, str, o) {
    o = o || {};
    var size = o.size || 10, bold = !!o.bold, s = String(str);
    var tw = width(s, size, bold);
    if (o.align === 'center') x = x - tw / 2; else if (o.align === 'right') x = x - tw;
    this.ops.push('BT /' + (o.italic ? 'F3' : (bold ? 'F2' : 'F1')) + ' ' + num(size) + ' Tf ' + rgb(o.color) + ' rg ' +
      num(x) + ' ' + num(this.h - y) + ' Td (' + pdfStr(s) + ') Tj ET');
    if (o.underline) this.line(x, y + 1.6, x + tw, y + 1.6, { w: Math.max(0.5, size / 18), color: o.color });
    return tw;
  };
  Doc.prototype.line = function (x1, y1, x2, y2, o) {
    o = o || {};
    this.ops.push(num(o.w || 0.8) + ' w ' + rgb(o.color) + ' RG ' + num(x1) + ' ' + num(this.h - y1) + ' m ' + num(x2) + ' ' + num(this.h - y2) + ' l S');
  };
  Doc.prototype.rect = function (x, y, w, h, o) {
    o = o || {};
    var op = (o.fill && o.stroke) ? 'B' : (o.fill ? 'f' : 'S');
    this.ops.push(num(o.lw || 0.8) + ' w ' + (o.fill ? rgb(o.fill) + ' rg ' : '') + (o.stroke ? rgb(o.stroke) + ' RG ' : (o.fill ? '' : '0 0 0 RG ')) +
      num(x) + ' ' + num(this.h - y - h) + ' ' + num(w) + ' ' + num(h) + ' re ' + op);
  };
  /** Gambar JPEG: {bytes, width, height} (piksel). */
  Doc.prototype.image = function (img, x, y, w, h) {
    this.images.push(img);
    this.ops.push('q ' + num(w) + ' 0 0 ' + num(h) + ' ' + num(x) + ' ' + num(this.h - y - h) + ' cm /Im' + this.images.length + ' Do Q');
  };
  /** Kode QR: isDark(r, c) dan jumlah modul; zona tenang digambar oleh pemanggil. */
  Doc.prototype.qr = function (isDark, count, x, y, size) {
    var m = size / count, ops = ['0 0 0 rg'];
    for (var r = 0; r < count; r++) {
      var c = 0;
      while (c < count) {
        if (isDark(r, c)) {
          var s = c; while (c < count && isDark(r, c)) c++;
          ops.push(num(x + s * m) + ' ' + num(this.h - y - (r + 1) * m) + ' ' + num((c - s) * m + 0.15) + ' ' + num(m + 0.15) + ' re');
        } else c++;
      }
    }
    ops.push('f');
    this.ops.push(ops.join(' '));
  };

  /** Hasilkan berkas PDF (Uint8Array). */
  Doc.prototype.build = function () {
    var objs = [], self = this;
    function add(s) { objs.push(s); return objs.length; }
    var content = this.ops.join('\n');
    var fontRes = '/F1 4 0 R /F2 5 0 R /F3 6 0 R';
    var imRes = this.images.map(function (im, i) { return '/Im' + (i + 1) + ' ' + (7 + i) + ' 0 R'; }).join(' ');
    add('<< /Type /Catalog /Pages 2 0 R >>');
    add('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + num(this.w) + ' ' + num(this.h) + '] /Resources << /Font << ' + fontRes + ' >>' +
      (imRes ? ' /XObject << ' + imRes + ' >>' : '') + ' >> /Contents ' + (7 + this.images.length) + ' 0 R >>');
    ['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique'].forEach(function (f) {
      add('<< /Type /Font /Subtype /Type1 /BaseFont /' + f + ' /Encoding /WinAnsiEncoding >>');
    });
    var chunks = [], offsets = [], pos = 0;
    function push(bytes) { chunks.push(bytes); pos += bytes.length; }
    push(latin1('%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n'));
    var info = '<< /Title (' + pdfStr(this.title) + ') /Producer (Klinik HAP) >>';
    var total = objs.length + this.images.length + 2; // + isi halaman + info
    function obj(n, head, stream) {
      offsets[n] = pos;
      push(latin1(n + ' 0 obj\n' + head));
      if (stream) { push(latin1('\nstream\n')); push(stream); push(latin1('\nendstream')); }
      push(latin1('\nendobj\n'));
    }
    objs.forEach(function (o, i) { obj(i + 1, o); });
    this.images.forEach(function (im, i) {
      obj(7 + i, '<< /Type /XObject /Subtype /Image /Width ' + im.width + ' /Height ' + im.height +
        ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + im.bytes.length + ' >>', im.bytes);
    });
    var cs = latin1(content);
    obj(7 + this.images.length, '<< /Length ' + cs.length + ' >>', cs);
    obj(total, info);
    var xref = pos, x = 'xref\n0 ' + (total + 1) + '\n0000000000 65535 f \n';
    for (var n = 1; n <= total; n++) x += String(offsets[n]).padStart(10, '0') + ' 00000 n \n';
    x += 'trailer\n<< /Size ' + (total + 1) + ' /Root 1 0 R /Info ' + total + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
    push(latin1(x));
    var out = new Uint8Array(pos), at = 0;
    chunks.forEach(function (c) { out.set(c, at); at += c.length; });
    return out;
  };

  return { Doc: Doc, width: width, wrap: wrap };
});
