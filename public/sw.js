const CACHE_PREFIX = "muchi-shell";
const CACHE_VERSION = "v3-editorial";
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline";

const APP_SHELL = [
  "/",
  "/chapters",
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/favicon.png",
];
const STATIC_DESTINATIONS = new Set([
  "font",
  "image",
  "script",
  "style",
  "worker",
]);

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isCacheableResponse(response) {
  return response.ok && response.type === "basic";
}

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);

  await Promise.allSettled(
    APP_SHELL.map(async (path) => {
      const url = new URL(path, self.location.origin);
      const response = await fetch(
        new Request(url, { cache: "reload", credentials: "same-origin" }),
      );

      if (isSameOrigin(url) && isCacheableResponse(response)) {
        await cache.put(url.href, response);
      }
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName.startsWith(`${CACHE_PREFIX}-`) &&
                cacheName !== CACHE_NAME,
            )
            .map((cacheName) => caches.delete(cacheName)),
        ),
      ),
      self.clients.claim(),
    ]),
  );
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);

    if (isCacheableResponse(response)) {
      await cache.put(request, response.clone());
    }

    return response;
  } catch {
    return (
      (await cache.match(request)) ??
      (await cache.match(OFFLINE_URL)) ??
      new Response("오프라인 상태입니다.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  const networkResponse = fetch(request)
    .then(async (response) => {
      if (isCacheableResponse(response)) {
        await cache.put(request, response.clone());
      }

      return response;
    })
    .catch(() => cachedResponse);

  if (cachedResponse) {
    event.waitUntil(networkResponse.then(() => undefined));
    return cachedResponse;
  }

  return (
    (await networkResponse) ??
    new Response("자산을 불러올 수 없습니다.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // iTunes, mzstatic artwork, preview audio, and every other third-party
  // resource must always stay on the network path and out of Cache Storage.
  if (!isSameOrigin(url) || request.destination === "audio") {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (STATIC_DESTINATIONS.has(request.destination)) {
    event.respondWith(staleWhileRevalidate(request, event));
  }
});
