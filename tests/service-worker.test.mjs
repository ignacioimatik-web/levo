import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const ORIGIN = 'https://levo.test';

function cacheKey(input) {
  const raw = typeof input === 'string' ? input : input.url;
  const url = new URL(raw, ORIGIN);
  return `${url.pathname}${url.search}`;
}

async function serviceWorkerHarness({
  network = async (input) => new Response(`network:${cacheKey(input)}`, { status: 200 }),
} = {}) {
  const handlers = new Map();
  const stores = new Map();
  const writes = [];
  const cacheApi = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async put(input, response) {
          const key = cacheKey(input);
          writes.push({ cache: name, key });
          store.set(key, response.clone());
        },
      };
    },
    async match(input) {
      const key = cacheKey(input);
      for (const store of stores.values()) {
        const response = store.get(key);
        if (response) return response.clone();
      }
      return undefined;
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name) {
      return stores.delete(name);
    },
  };
  const self = {
    location: { origin: ORIGIN },
    clients: { claim: async () => undefined },
    skipWaiting: async () => undefined,
    addEventListener(type, handler) {
      handlers.set(type, handler);
    },
  };
  const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, {
    AbortController,
    Error,
    Promise,
    Request,
    Response,
    Set,
    URL,
    caches: cacheApi,
    clearTimeout,
    fetch: network,
    self,
    setTimeout,
  });

  async function dispatch(type, request) {
    let pending;
    handlers.get(type)({
      request,
      waitUntil(value) {
        pending = value;
      },
      respondWith(value) {
        pending = value;
      },
    });
    return pending;
  }

  return { cacheApi, dispatch, stores, writes };
}

function navigationRequest(path) {
  const request = new Request(`${ORIGIN}${path}`);
  Object.defineProperty(request, 'mode', { value: 'navigate' });
  return request;
}

test('el service worker se instala aunque falle una pantalla secundaria', async () => {
  const harness = await serviceWorkerHarness({
    network: async (input) => (
      cacheKey(input) === '/comunidad'
        ? new Response('fallo temporal', { status: 503 })
        : new Response(`shell:${cacheKey(input)}`, { status: 200 })
    ),
  });

  await harness.dispatch('install');
  assert.ok(harness.stores.get('e-nduro-shell-v4')?.has('/offline'));
  assert.ok(harness.stores.get('e-nduro-shell-v4')?.has('/grabar'));
  assert.equal(harness.stores.get('e-nduro-shell-v4')?.has('/comunidad'), false);
});

test('sin red una ruta con parámetros recupera la pantalla base de grabación', async () => {
  const harness = await serviceWorkerHarness();
  await harness.dispatch('install');
  const offlineHarness = await serviceWorkerHarness({
    network: async () => {
      throw new Error('offline');
    },
  });
  offlineHarness.stores.set('e-nduro-shell-v4', harness.stores.get('e-nduro-shell-v4'));

  const response = await offlineHarness.dispatch(
    'fetch',
    navigationRequest('/grabar?ruta=track-123'),
  );
  assert.equal(await response.text(), 'network:/grabar');
});

test('el callback OAuth nunca se guarda en la caché de navegación', async () => {
  const harness = await serviceWorkerHarness();
  await harness.dispatch('fetch', navigationRequest('/auth/callback?code=sensitive-code'));

  assert.equal(
    harness.writes.some(({ key }) => key.includes('/auth/callback') || key.includes('sensitive-code')),
    false,
  );
});
