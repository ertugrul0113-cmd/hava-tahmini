// Önce ağ, olmazsa önbellek: yeni sürüm telefona kendiliğinden gelir.
const ONBELLEK = 'hava-tahmini-v1';
const DOSYALAR = ['./', 'index.html', 'style.css', 'app.js', 'katmanlar.js', 'olcek.js', 'izgara.js', 'veri.js', 'harita-cizim.js', 'tahmin.js',
  'grafik.js', 'birim.js', 'hava-kodu.js', 'uyari.js', 'manifest.webmanifest', 'ikon-180.png', 'ikon-192.png', 'ikon-512.png',
  'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(ONBELLEK).then(c => c.addAll(DOSYALAR)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== ONBELLEK).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // harita, hava verisi doğrudan ağdan
  e.respondWith(
    fetch(e.request.url, { cache: 'no-cache' }).then(r => {
      const kopya = r.clone();
      caches.open(ONBELLEK).then(c => c.put(e.request, kopya));
      return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
