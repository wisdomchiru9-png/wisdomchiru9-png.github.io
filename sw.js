const CACHE_NAME = 'Beek-Na-Lah-v4k-v1';
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
  'images/install-guide.svg'
];

const DATA_ASSETS = [
  'lyrics-data/songs-map.json',
  'all-lyrics/index.txt'
];

async function cacheUrls(cache, urls) {
  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: 'reload' });
      if (response.ok) {
        await cache.put(url, response);
      }
    } catch (err) {
      console.warn(`Failed to cache ${url}:`, err);
    }
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Cache shell and critical data
    await cacheUrls(cache, [...APP_SHELL, ...DATA_ASSETS]);

    try {
      const mapRes = await fetch('lyrics-data/songs-map.json', { cache: 'no-store' });
      if (mapRes.ok) {
        const map = await mapRes.json();
        const songUrls = Object.values(map).map((name) => encodeURI(`all-lyrics/songs/${name}`));
        // Chunk song caching to avoid blocking
        const chunkSize = 50;
        for (let i = 0; i < songUrls.length; i += chunkSize) {
          const chunk = songUrls.slice(i, i + chunkSize);
          await cacheUrls(cache, chunk);
        }

        const clients = await self.clients.matchAll();
        clients.forEach((client) => client.postMessage({ type: 'OFFLINE_READY' }));
      }
    } catch (err) {
      console.error('Pre-caching failed:', err);
    }
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
