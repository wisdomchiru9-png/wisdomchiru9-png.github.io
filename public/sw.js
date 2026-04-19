const CACHE_NAME = 'Beek-Na-Lah-v29';
const APP_SHELL = [
  './',
  'index.html',
  'download.html',
  'install-apk.html',
  'style.css?v=2',
  'script.js?v=18',
  'download.js',
  'manifest.json',
  'icons/logo-mark.svg?v=2',
  'icons/icon-192.svg',
  'icons/icon-512.svg',
  'images/qr-download.png',
  'images/install-guide.svg',
  'admin/index.html',
  'admin/admin.css',
  'admin/admin.js',
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

        // Notify that caching is complete
        const clients = await self.clients.matchAll();
        clients.forEach((client) => client.postMessage({ type: 'OFFLINE_READY' }));
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
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return fetch(event.request);
    }
    if (event.request.url.startsWith('chrome-extension://')) {
      return fetch(event.request);
    }
    if (url.origin !== self.location.origin) {
      return fetch(event.request);
    }
    if (url.pathname.startsWith('/admin')) {
      return fetch(event.request, { cache: 'no-store' });
    }
    if (url.pathname.endsWith('/script.js')) {
      return fetch(event.request, { cache: 'no-store' });
    }
    if (url.pathname.startsWith('/all-lyrics/audio/')) {
      return fetch(event.request, { cache: 'no-store' });
    }
    if (url.pathname.endsWith('.apk')) {
      return fetch(event.request);
    }

    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);
    if (cached) return cached;

    try {
      const response = await fetch(event.request);
      if (response && response.status === 200 && response.type === 'basic') {
        try {
          await cache.put(event.request, response.clone());
        } catch (err) {
          // Ignore cache put errors (e.g., chrome-extension requests).
        }
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
