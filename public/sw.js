const CACHE_PREFIX = 'e-nduro-';
const SHELL_CACHE = 'e-nduro-shell-v5';
const RUNTIME_CACHE = 'e-nduro-runtime-v5';
const NAVIGATION_TIMEOUT_MS = 4_500;
const APP_SHELL = [
  '/',
  '/offline',
  '/grabar',
  '/planifica',
  '/actividades',
  '/progreso',
  '/mapa-personal',
  '/taller',
  '/favicon.ico',
  '/manifest.webmanifest',
  '/images/logo-enduro-ebiketracks.png',
];
const OFFLINE_NAVIGATION_PATHS = new Set([
  '/',
  '/offline',
  '/grabar',
  '/planifica',
  '/actividades',
  '/progreso',
  '/mapa-personal',
  '/taller',
]);
const FIELD_SHELL_PATHS = new Set(['/offline', '/grabar', '/planifica']);
const STATIC_ASSET_PATTERN = /(?:src|href)=["'](\/_next\/static\/[^"'#]+)["']/g;

async function cacheResponse(cacheName, request, response) {
  if (!response?.ok || response.type === 'opaqueredirect') return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
}

function staticAssetsFromHtml(html) {
  return [...html.matchAll(STATIC_ASSET_PATTERN)].map((match) => match[1]);
}

async function precacheEntry(cache, path, seenAssets) {
  const response = await fetch(path, { cache: 'reload' });
  if (!response.ok) throw new Error(`No se pudo precargar ${path}.`);
  await cache.put(path, response.clone());
  if (!FIELD_SHELL_PATHS.has(path)) return;

  const html = await response.text();
  const assets = staticAssetsFromHtml(html).filter((asset) => {
    if (seenAssets.has(asset)) return false;
    seenAssets.add(asset);
    return true;
  });
  await Promise.allSettled(assets.map(async (asset) => {
    const assetResponse = await fetch(asset, { cache: 'reload' });
    if (!assetResponse.ok) throw new Error(`No se pudo precargar ${asset}.`);
    await cache.put(asset, assetResponse);
  }));
}

async function precacheShell() {
  const cache = await caches.open(SHELL_CACHE);
  const seenAssets = new Set();
  await precacheEntry(cache, '/offline', seenAssets);

  await Promise.allSettled(
    APP_SHELL
      .filter((path) => path !== '/offline')
      .map((path) => precacheEntry(cache, path, seenAssets)),
  );
}

async function navigationFallback(request) {
  const exact = await caches.match(request);
  if (exact) return exact;

  const url = new URL(request.url);
  if (OFFLINE_NAVIGATION_PATHS.has(url.pathname)) {
    const shell = await caches.match(url.pathname);
    if (shell) return shell;
  }
  return caches.match('/offline');
}

async function networkFirstNavigation(request) {
  const fallbackPromise = navigationFallback(request);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NAVIGATION_TIMEOUT_MS);
  try {
    const response = await fetch(new Request(request, { signal: controller.signal }));
    if (response.ok) {
      const url = new URL(request.url);
      if (OFFLINE_NAVIGATION_PATHS.has(url.pathname)) {
        await cacheResponse(RUNTIME_CACHE, request, response);
      }
      return response;
    }
    return (await fallbackPromise) ?? response;
  } catch {
    return (await fallbackPromise) ?? new Response('Sin conexión', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function cacheFirstAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  await cacheResponse(RUNTIME_CACHE, request, response);
  return response;
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => (
            key.startsWith(CACHE_PREFIX)
            && key !== SHELL_CACHE
            && key !== RUNTIME_CACHE
          ))
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (
    url.pathname.startsWith('/_next/static/')
    || url.pathname.startsWith('/images/')
    || url.pathname.startsWith('/tracks/')
    || url.pathname === '/manifest.webmanifest'
    || url.pathname === '/favicon.ico'
  ) {
    event.respondWith(cacheFirstAsset(request));
  }
});
