/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { base, build, files, prerendered, version } from '$service-worker';

const worker = globalThis as unknown as ServiceWorkerGlobalScope;
const cacheName = `volscore-${version}`;
const precacheUrls = [...new Set([...build, ...files, ...prerendered])];
const precachePaths = new Set(
  [...build, ...files].map((asset) => new URL(asset, worker.location.origin).pathname)
);
const appShellUrl = `${base || ''}/`;

worker.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(cacheName).then(async (cache) => {
      await cache.addAll(precacheUrls);
      await worker.skipWaiting();
    })
  );
});

worker.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (cacheNames) => {
      await Promise.all(
        cacheNames
          .filter((name) => name.startsWith('volscore-') && name !== cacheName)
          .map((name) => caches.delete(name))
      );
      await worker.clients.claim();
    })
  );
});

worker.addEventListener('fetch', (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);

  if (request.method !== 'GET' || requestUrl.origin !== worker.location.origin) return;

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
