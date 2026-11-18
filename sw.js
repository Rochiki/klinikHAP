/* Klinik HAP - service worker: aplikasi tetap bisa dibuka tanpa internet.
 * Strategi: jaringan dulu (versi terbaru langsung tampil), cache hanya bila offline/gagal. */
var CACHE = 'klinikhap-v5';
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
  e.respondWith(fetch(req, { cache: 'no-cache' }).then(function (res) {
    if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
    return res;
  }).catch(function () { return caches.match(req, { ignoreSearch: true }); }));
});
