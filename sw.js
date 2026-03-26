const CACHE_NAME = 'bek-na-lah-v6';
const APP_SHELL = [
  './',
  'index.html',
  'download.html',
  'style.css',
  'script.js',
  'firebase-config.js',
  'manifest.json',
  'icons/logo-mark.svg',
  'icons/icon-192.svg',
  'icons/icon-512.svg',
  'images/qr-download.png',
  'images/qr-apk.png',
  'images/install-guide.svg',
  'admin/index.html',
  'admin/admin.css',
  'admin/admin.js',
  'lyrics-data/lyrics.json',
  'lyrics-data/songs-map.json',
  'all-lyrics/index.txt'
];

async function cacheUrls(cache, urls) {
  for (const url of urls) {
    try {
      await cache.add(new Request(url, { cache: 'reload' }));
    } catch (err) {
      // Ignore individual failures so install can continue.
    }
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cacheUrls(cache, APP_SHELL);

    try {
      const mapRes = await fetch('lyrics-data/songs-map.json', { cache: 'no-store' });
      if (mapRes.ok) {
        const map = await mapRes.json();
        const songUrls = Object.values(map).map((name) => encodeURI(`all-lyrics/songs/${name}`));
        await cacheUrls(cache, songUrls);
      }
    } catch (err) {
      // If song list fetch fails, app shell still works.
    }

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith((async () => {
    const url = new URL(event.request.url);
    if (url.pathname.endsWith('.apk')) {
      return fetch(event.request);
    }

    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);
    if (cached) return cached;

    try {
      const response = await fetch(event.request);
      if (response && response.status === 200 && response.type === 'basic') {
        cache.put(event.request, response.clone());
      }
      return response;
    } catch (err) {
      if (event.request.mode === 'navigate') {
        return cache.match('index.html');
      }
      return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});

