/*
 * Klinik HAP - penyimpanan lokal (localStorage). Semua data tinggal di browser laptop ini.
 * create(storage) dipakai langsung di Node untuk pengujian; di browser tersedia window.KlinikStore.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(null, root);
  else root.KlinikStore = factory(root, root);
})(typeof self !== 'undefined' ? self : this, function (win) {
  'use strict';

  var PREFIX = 'klinikhap.';

  var DEFAULT_SETTINGS = {
    clinicName: 'Klinik HAP',
    nurseName: '',
    doctors: [],
    defaultDoctor: '',
    suratPrefix: 'SK/KLL',
    ccAlways: '',
    departments: ['HRGA', 'QSHE', 'Finance & Accounting', 'Procurement', 'Sales & Marketing',
      'Parts', 'Service', 'Warehouse & Logistics', 'IT', 'Legal', 'Operations']
  };

  function memoryStorage() {
    var m = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
      setItem: function (k, v) { m[k] = String(v); },
      removeItem: function (k) { delete m[k]; },
      key: function (i) { return Object.keys(m)[i] || null; },
      get length() { return Object.keys(m).length; }
    };
  }

  function uid() {
    try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* lanjut */ }
    return 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function create(storage, persistent) {
    var isPersistent = persistent !== false;

    function read(key, fallback) {
      try {
        var raw = storage.getItem(PREFIX + key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) { return fallback; }
    }
    function write(key, value) { storage.setItem(PREFIX + key, JSON.stringify(value)); }

    /* ---- pengaturan ---- */
    function getSettings() {
      var s = Object.assign({}, DEFAULT_SETTINGS, read('settings', {}));
      s.doctors = Array.isArray(s.doctors) ? s.doctors : [];
      s.departments = Array.isArray(s.departments) ? s.departments : DEFAULT_SETTINGS.departments.slice();
      return s;
    }
    function saveSettings(patch) {
      var s = Object.assign(getSettings(), patch);
      write('settings', s);
      return s;
    }

    /* ---- kunjungan ---- */
    function listVisits() {
      return read('visits', []).slice().sort(function (a, b) {
        return new Date(b.visitAt) - new Date(a.visitAt);
      });
    }
    function addVisit(visit) {
      var all = read('visits', []);
      visit.id = visit.id || uid();
      all.push(visit);
      write('visits', all);
      return visit;
    }
    function updateVisit(id, patch) {
      var all = read('visits', []), found = null;
      all.forEach(function (v) { if (v.id === id) { Object.assign(v, patch); found = v; } });
      if (found) write('visits', all);
      return found;
    }
    function deleteVisit(id) {
      var all = read('visits', []), next = all.filter(function (v) { return v.id !== id; });
      write('visits', next);
      return all.length - next.length;
    }

    /* ---- nomor urut surat per prefix + tanggal (tidak dipakai ulang walau kunjungan dihapus) ---- */
    function nextSeq(prefix, ymd) {
      var c = read('counters', {}), key = prefix + '|' + ymd;
      c[key] = (c[key] || 0) + 1;
      write('counters', c);
      return c[key];
    }

    /* ---- direktori NIK: isi otomatis kunjungan berikutnya ---- */
    function getDirectory() { return read('directory', {}); }
    function rememberWorker(v) {
      var d = getDirectory();
      d[v.nik] = {
        name: v.name, dept: v.dept, workerEmail: v.workerEmail || '',
        supervisorName: v.supervisorName || '', supervisorEmail: v.supervisorEmail || '',
        hrdEmail: v.hrdEmail || ''
      };
      write('directory', d);
    }
    function lookupWorker(nik) {
      var d = getDirectory();
      return Object.prototype.hasOwnProperty.call(d, nik) ? d[nik] : null;
    }

    /* ---- cadangan ---- */
    function exportAll() {
      return {
        app: 'klinikHAP', version: 1, exportedAt: new Date().toISOString(),
        settings: getSettings(), visits: read('visits', []),
        counters: read('counters', {}), directory: getDirectory()
      };
    }
    /** Gabungkan cadangan ke data saat ini (kunjungan dengan id sama dilewati). */
    function importAll(obj) {
      if (!obj || obj.app !== 'klinikHAP' || !Array.isArray(obj.visits)) {
        throw new Error('Berkas bukan cadangan klinikHAP yang valid.');
      }
      var current = read('visits', []), ids = {};
      current.forEach(function (v) { ids[v.id] = true; });
      var added = 0, skipped = 0;
      obj.visits.forEach(function (v) {
        var ok = v && typeof v.id === 'string' && typeof v.nik === 'string' &&
          typeof v.name === 'string' && !isNaN(new Date(v.visitAt));
        if (!ok || ids[v.id]) { skipped++; return; }
        current.push(v); ids[v.id] = true; added++;
      });
      write('visits', current);
      var c = read('counters', {});
      Object.keys(obj.counters || {}).forEach(function (k) {
        var n = Number(obj.counters[k]);
        if (n > (c[k] || 0)) c[k] = n;
      });
      write('counters', c);
      var d = getDirectory();
      Object.keys(obj.directory || {}).forEach(function (k) { if (!d[k]) d[k] = obj.directory[k]; });
      write('directory', d);
      return { added: added, skipped: skipped };
    }
    function clearAll() {
      ['settings', 'visits', 'counters', 'directory'].forEach(function (k) { storage.removeItem(PREFIX + k); });
    }
    function approxBytes() {
      var n = 0;
      ['settings', 'visits', 'counters', 'directory'].forEach(function (k) {
        var raw = storage.getItem(PREFIX + k);
        if (raw) n += raw.length * 2;
      });
      return n;
    }

    return {
      isPersistent: isPersistent,
      DEFAULT_SETTINGS: DEFAULT_SETTINGS,
      getSettings: getSettings, saveSettings: saveSettings,
      listVisits: listVisits, addVisit: addVisit, updateVisit: updateVisit, deleteVisit: deleteVisit,
      nextSeq: nextSeq, rememberWorker: rememberWorker, lookupWorker: lookupWorker,
      exportAll: exportAll, importAll: importAll, clearAll: clearAll, approxBytes: approxBytes
    };
  }

  if (win) {
    var storage = null;
    try {
      storage = win.localStorage;
      storage.setItem('__klinikhap_test', '1');
      storage.removeItem('__klinikhap_test');
    } catch (e) { storage = null; }
    var api = storage ? create(storage, true) : create(memoryStorage(), false);
    api.create = create;
    api.memoryStorage = memoryStorage;
    return api;
  }
  return { create: create, memoryStorage: memoryStorage, DEFAULT_SETTINGS: DEFAULT_SETTINGS };
});
