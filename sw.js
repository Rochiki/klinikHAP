/* Klinik HAP - service worker: aplikasi tetap bisa dibuka tanpa internet.
 * Strategi: tampilkan dari cache lalu perbarui di latar belakang (versi baru terpakai pada pembukaan berikutnya). */
var CACHE = 'klinikhap-v3';
var SHELL = ['./', 'index.html', 'manifest.webmanifest', 'css/style.css', 'img/logo.png', 'img/icon-192.png', 'img/icon-512.png',
  'js/vendor/qrcode.js', 'js/logo-data.js', 'js/email.js', 'js/master.js', 'js/sha256.js', 'js/pdf.js', 'js/surat.js', 'js/xlsx.js', 'js/recap.js', 'js/store.js', 'js/app.js'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.indexOf('/api/') >= 0) return;
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(req, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(req).then(function (res) { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(function () { return hit; });
      return hit || net;
    });
  }));
});
