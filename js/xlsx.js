/*
 * Klinik HAP - penulis berkas .xlsx minimal tanpa dependensi (bekerja offline, juga di Node).
 * Mendukung satu/lebih lembar, gaya sel (font, isi, garis, rata, format angka), sel gabungan,
 * lebar kolom, tinggi baris, dan panel beku. Dibuat untuk rekap kunjungan; bukan pustaka umum.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KlinikXlsx = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- ZIP (tanpa kompresi) ---------- */
  var CRC_TABLE = (function () {
    var t = [], c, n, k;
    for (n = 0; n < 256; n++) {
      c = n;
      for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function utf8(s) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
    return Uint8Array.from(Buffer.from(s, 'utf8'));
  }
  function le16(a, v) { a.push(v & 255, (v >>> 8) & 255); }
  function le32(a, v) { a.push(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255); }

  /** files: [{name, data: string|Uint8Array}] -> Uint8Array berkas zip. */
  function zip(files) {
    var parts = [], central = [], offset = 0;
    var dosTime = 0, dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1; // tanggal tetap agar keluaran deterministik
    files.forEach(function (f) {
      var name = utf8(f.name), data = typeof f.data === 'string' ? utf8(f.data) : f.data, crc = crc32(data);
      var h = [];
      le32(h, 0x04034b50); le16(h, 20); le16(h, 0x0800); le16(h, 0); le16(h, dosTime); le16(h, dosDate);
      le32(h, crc); le32(h, data.length); le32(h, data.length); le16(h, name.length); le16(h, 0);
      parts.push(Uint8Array.from(h), name, data);
      var c = [];
      le32(c, 0x02014b50); le16(c, 20); le16(c, 20); le16(c, 0x0800); le16(c, 0); le16(c, dosTime); le16(c, dosDate);
      le32(c, crc); le32(c, data.length); le32(c, data.length); le16(c, name.length); le16(c, 0); le16(c, 0);
      le16(c, 0); le16(c, 0); le32(c, 0); le32(c, offset);
      central.push(Uint8Array.from(c), name);
      offset += h.length + name.length + data.length;
    });
    var cdSize = central.reduce(function (n, p) { return n + p.length; }, 0);
    var end = [];
    le32(end, 0x06054b50); le16(end, 0); le16(end, 0); le16(end, files.length); le16(end, files.length);
    le32(end, cdSize); le32(end, offset); le16(end, 0);
    var all = parts.concat(central, [Uint8Array.from(end)]);
    var total = all.reduce(function (n, p) { return n + p.length; }, 0), out = new Uint8Array(total), pos = 0;
    all.forEach(function (p) { out.set(p, pos); pos += p.length; });
    return out;
  }

  /* ---------- XML ---------- */
  function esc(s) {
    return String(s)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function colName(i) { // 1 -> A
    var s = '';
    while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
    return s;
  }
  /** Tanggal lokal -> nomor seri Excel (tanpa zona waktu). */
  function serial(d) {
    return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 86400000);
  }

  /* ---------- gaya ---------- */
  function Styles() {
    this.fonts = []; this.fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
    this.borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
    this.numFmts = []; this.xfs = []; this.cache = {};
    this.get({}); // xf 0 = bawaan
  }
  function idx(list, xml) { var i = list.indexOf(xml); if (i < 0) { list.push(xml); i = list.length - 1; } return i; }
  function argb(c) { c = String(c).replace('#', '').toUpperCase(); return c.length === 6 ? 'FF' + c : c; }

  Styles.prototype.get = function (st) {
    st = st || {};
    var key = JSON.stringify(st);
    if (this.cache[key] != null) return this.cache[key];
    var f = st.font || {};
    var font = '<font>' + (f.b ? '<b/>' : '') + (f.i ? '<i/>' : '') + '<sz val="' + (f.sz || 10) + '"/>' +
      '<color rgb="' + argb(f.color || '000000') + '"/><name val="' + esc(f.name || 'Arial') + '"/><family val="2"/></font>';
    var fill = st.fill ? '<fill><patternFill patternType="solid"><fgColor rgb="' + argb(st.fill) + '"/><bgColor indexed="64"/></patternFill></fill>' : null;
    var border = null;
    if (st.border) {
      var side = function (n) { return '<' + n + ' style="thin"><color rgb="' + argb(st.border) + '"/></' + n + '>'; };
      border = '<border>' + side('left') + side('right') + side('top') + side('bottom') + '<diagonal/></border>';
    }
    var numFmtId = 0;
    if (st.numFmt === 'date') numFmtId = 14;
    else if (st.numFmt) {
      var ix = this.numFmts.indexOf(st.numFmt);
      if (ix < 0) { this.numFmts.push(st.numFmt); ix = this.numFmts.length - 1; }
      numFmtId = 164 + ix;
    }
    var a = st.align || {};
    var align = (a.h || a.v || a.wrap)
      ? '<alignment' + (a.h ? ' horizontal="' + a.h + '"' : '') + (a.v ? ' vertical="' + a.v + '"' : '') + (a.wrap ? ' wrapText="1"' : '') + '/>' : '';
    var xf = '<xf numFmtId="' + numFmtId + '" fontId="' + idx(this.fonts, font) + '" fillId="' + (fill ? idx(this.fills, fill) : 0) +
      '" borderId="' + (border ? idx(this.borders, border) : 0) + '" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"' +
      (align ? ' applyAlignment="1">' + align + '</xf>' : '/>');
    this.xfs.push(xf);
    return (this.cache[key] = this.xfs.length - 1);
  };
  Styles.prototype.xml = function () {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      (this.numFmts.length ? '<numFmts count="' + this.numFmts.length + '">' + this.numFmts.map(function (n, i) {
        return '<numFmt numFmtId="' + (164 + i) + '" formatCode="' + esc(n) + '"/>';
      }).join('') + '</numFmts>' : '') +
      '<fonts count="' + this.fonts.length + '">' + this.fonts.join('') + '</fonts>' +
      '<fills count="' + this.fills.length + '">' + this.fills.join('') + '</fills>' +
      '<borders count="' + this.borders.length + '">' + this.borders.join('') + '</borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="' + this.xfs.length + '">' + this.xfs.join('') + '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  };

  /* ---------- buku kerja ---------- */
  /**
   * sheets: [{ name, cols:[{width}], rows:[{height, cells:[{v, s, t}] }], merges:['A1:C1'], freeze:'A6' }]
   * sel: v = string | number | Date | null; s = objek gaya. Tipe angka/teks ditentukan dari v.
   */
  function build(sheets, opts) {
    opts = opts || {};
    var styles = new Styles(), sheetXml = [];
    sheets.forEach(function (sh) {
      var x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<sheetViews><sheetView workbookViewId="0"' + (sh.hideGrid ? ' showGridLines="0"' : '') + '>' +
        (sh.freeze ? freezePane(sh.freeze) : '') + '</sheetView></sheetViews><sheetFormatPr defaultRowHeight="' + (sh.rowHeight || 15) + '"/>';
      if (sh.cols && sh.cols.length) {
        x += '<cols>' + sh.cols.map(function (c, i) {
          return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + c.width + '" customWidth="1"/>';
        }).join('') + '</cols>';
      }
      x += '<sheetData>';
      sh.rows.forEach(function (row, ri) {
        if (!row) return;
        var r = ri + 1;
        x += '<row r="' + r + '"' + (row.height ? ' ht="' + row.height + '" customHeight="1"' : '') + '>';
        (row.cells || []).forEach(function (cell, ci) {
          if (!cell) return;
          var ref = colName(ci + 1) + r, s = styles.get(cell.s), v = cell.v;
          if (cell.f != null || cell.si != null) { // rumus (opsional bersama) + nilai tersimpan
            var ft = cell.si != null
              ? '<f t="shared"' + (cell.f != null ? ' ref="' + cell.ref + '"' : '') + ' si="' + cell.si + '"' + (cell.f != null ? '>' + esc(cell.f) + '</f>' : '/>')
              : '<f>' + esc(cell.f) + '</f>';
            if (typeof v === 'number' && isFinite(v)) x += '<c r="' + ref + '" s="' + s + '">' + ft + '<v>' + v + '</v></c>';
            else x += '<c r="' + ref + '" s="' + s + '" t="str">' + ft + '<v>' + esc(v == null ? '' : v) + '</v></c>';
          } else if (v == null || v === '') x += '<c r="' + ref + '" s="' + s + '"/>';
          else if (v instanceof Date) x += '<c r="' + ref + '" s="' + s + '"><v>' + serial(v) + '</v></c>';
          else if (typeof v === 'number' && isFinite(v)) x += '<c r="' + ref + '" s="' + s + '"><v>' + v + '</v></c>';
          else x += '<c r="' + ref + '" s="' + s + '" t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
        });
        x += '</row>';
      });
      x += '</sheetData>';
      if (sh.merges && sh.merges.length) x += '<mergeCells count="' + sh.merges.length + '">' + sh.merges.map(function (m) { return '<mergeCell ref="' + m + '"/>'; }).join('') + '</mergeCells>';
      if (sh.validations && sh.validations.length) {
        x += '<dataValidations count="' + sh.validations.length + '">' + sh.validations.map(function (d) {
          return '<dataValidation type="' + d.type + '"' + (d.errorStyle ? ' errorStyle="' + d.errorStyle + '"' : '') +
            ' allowBlank="1" showInputMessage="1" showErrorMessage="1"' + (d.errorTitle ? ' errorTitle="' + esc(d.errorTitle) + '"' : '') +
            (d.error ? ' error="' + esc(d.error) + '"' : '') + ' sqref="' + d.sqref + '"><formula1>' + esc(d.f1) + '</formula1>' +
            (d.f2 != null ? '<formula2>' + esc(d.f2) + '</formula2>' : '') + '</dataValidation>';
        }).join('') + '</dataValidations>';
      }
      x += '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>' +
        '<pageSetup orientation="landscape" paperSize="9" fitToHeight="0"/></worksheet>';
      sheetXml.push(x);
    });

    var files = [
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        sheets.map(function (s, i) { return '<sheet name="' + esc(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets>' +
        (opts.names && opts.names.length ? '<definedNames>' + opts.names.map(function (n) { return '<definedName name="' + esc(n.name) + '">' + esc(n.ref) + '</definedName>'; }).join('') + '</definedNames>' : '') +
        (opts.recalc ? '<calcPr calcId="191029" fullCalcOnLoad="1"/>' : '') + '</workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') +
        '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' }
    ];
    sheetXml.forEach(function (x, i) { files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: x }); });
    files.push({ name: 'xl/styles.xml', data: styles.xml() });
    return zip(files);
  }

  function freezePane(ref) {
    var m = /^([A-Z]+)(\d+)$/.exec(ref); if (!m) return '';
    var col = 0; m[1].split('').forEach(function (ch) { col = col * 26 + ch.charCodeAt(0) - 64; });
    var xs = col - 1, ys = Number(m[2]) - 1;
    return '<pane' + (xs ? ' xSplit="' + xs + '"' : '') + (ys ? ' ySplit="' + ys + '"' : '') + ' topLeftCell="' + ref +
      '" activePane="' + (xs && ys ? 'bottomRight' : (ys ? 'bottomLeft' : 'topRight')) + '" state="frozen"/>';
  }

  return { build: build, zip: zip, crc32: crc32, colName: colName, serial: serial };
});
