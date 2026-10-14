/* StreetPlay service worker.
 *
 * Goal: the crew app (/studio) opens and runs with no network.
 * - Build assets (/_next/static) are immutable: cache-first.
 * - Page navigations: network-first, fall back to the cached page, then /offline.
 * - API calls and RSC requests are never cached; payouts are queued in
 *   IndexedDB by the app (src/lib/offline/outbox.ts), not here.
 *
 * Bump VERSION when this file's caching rules change.
 */
const VERSION = "v3";
const STATIC_CACHE = `sp-static-${VERSION}`;
const PAGE_CACHE = `sp-pages-${VERSION}`;

// /studio needs a session, so it is cached on first signed-in visit, not here.
const PRECACHE = [
  "/offline",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// Sent by signOut() so the next person on this phone can't open cached pages.
self.addEventListener("message", (event) => {
  if (event.data?.type === "clear-pages") {
    event.waitUntil(
      caches.delete(PAGE_CACHE).then(() => caches.open(PAGE_CACHE)).then((c) => c.addAll(PRECACHE)),
    );
  }
});

// "We'll ping you when @tobi.streets starts a game" (src/lib/server/push.ts).
self.addEventListener("push", (event) => {
  let data = { title: "StreetPlay", body: "A game is starting.", url: "/" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    /* plain text or empty push */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url },
      vibrate: [80, 40, 80],
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => w.url.startsWith(url));
      return open ? open.focus() : self.clients.openWindow(url);
    }),
  );
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PAGE_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith("sp-") && k !== STATIC_CACHE && k !== PAGE_CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (request.headers.get("RSC") === "1") return; // handled by Next's useOffline retry

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request, url));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstPage(request, url) {
  try {
    const response = await fetch(request);
    // Only the crew app is kept for offline use. Public pages (receipts,
    // viewer game) need live data and are not worth the storage.
    // Skip redirects (e.g. signed out → /login): they can't be replayed from cache.
    if (response.ok && !response.redirected && url.pathname.startsWith("/studio")) {
      const cache = await caches.open(PAGE_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (url.pathname.startsWith("/studio")) {
      const shell = await caches.match("/studio");
      if (shell) return shell;
    }
    return (await caches.match("/offline")) ?? Response.error();
  }
}
