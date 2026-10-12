import { self } from '$app/service-worker';
import { version } from '$app/env';
import { assets, immutable, prerendered } from '$app/manifest';
import { asset, resolve } from '$app/paths';

const cacheName = `volscore-${version}`;
const appShellUrl = resolve('/');
const resolveFromBase = (path: string) =>
  new URL(path.replace(/^\/+/, ''), new URL(appShellUrl, self.location.origin)).pathname;
const precacheUrls = [
  ...new Set([
    ...immutable.map(({ path }) => resolveFromBase(path)),
    ...assets.map(({ path }) => asset(path)),
    ...prerendered.map(({ path }) => resolve(path))
  ])
];
const precachePaths = new Set(
  [
    ...immutable.map(({ path }) => resolveFromBase(path)),
    ...assets.map(({ path }) => asset(path))
  ].map((path) => new URL(path, self.location.origin).pathname)
);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(cacheName).then(async (cache) => {
      await cache.addAll(precacheUrls);
      await self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (cacheNames) => {
      await Promise.all(
        cacheNames
          .filter((name) => name.startsWith('volscore-') && name !== cacheName)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);

  if (request.method !== 'GET' || requestUrl.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(cacheName);
        return (
          (await cache.match(request, { ignoreSearch: true })) ??
          (await cache.match(appShellUrl)) ??
          Response.error()
        );
      })
    );
    return;
  }

  if (precachePaths.has(requestUrl.pathname)) {
    event.respondWith(
      caches.open(cacheName).then(async (cache) => (await cache.match(request)) ?? fetch(request))
    );
  }
});
