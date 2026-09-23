// Bump this whenever the caching strategy changes: the activate handler deletes
// every cache whose name doesn't match, so a new name is what purges stale
// content from browsers that already installed an older worker.
const CACHE_NAME = "dhanbook-cache-v2";

// The offline shell. Deliberately tiny — everything else is cached on demand.
const STATIC_ASSETS = ["/", "/manifest.json", "/favicon.ico"];

// Install Event - cache core layout shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // Don't let one missing file abort the whole install.
      .then((cache) => Promise.allSettled(STATIC_ASSETS.map((a) => cache.add(a))))
      .then(() => self.skipWaiting())
  );
});

// Activate Event - clean up obsolete cache versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.map((name) => (name === CACHE_NAME ? null : caches.delete(name))))
      )
      .then(() => self.clients.claim())
  );
});

/** Next.js build output is content-hashed, so a given URL's bytes never change. */
function isImmutableAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Never cache writes.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cross-origin requests are passed straight through and NEVER stored. This
  // covers Firebase Auth and Firestore: those responses carry the user's
  // financial data and identity tokens, and Cache Storage is unencrypted disk.
  // The app configures Firestore with an in-memory cache for exactly this
  // reason (see config/firebase.ts) — the worker must not undo that.
  if (url.origin !== self.location.origin) return;

  // HTML navigations: network-first. Cache-first here is what makes a fresh
  // deploy invisible — the browser keeps rendering the previously cached page
  // and never learns the app was updated. The cache is only a fallback so the
  // app still opens offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match("/")))
    );
    return;
  }

  // Hashed build assets are safe to serve from cache: a new deploy produces new
  // URLs, so this can never pin an old bundle.
  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response && response.status === 200) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  // Everything else same-origin (icons, images, manifest): serve from cache for
  // speed, but refresh it in the background so an update lands on the next load
  // instead of never.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
