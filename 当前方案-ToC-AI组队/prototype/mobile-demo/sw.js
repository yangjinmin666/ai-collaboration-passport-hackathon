const CACHE_NAME = "cospan-shell-v14";
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./join.html",
  "./styles.css",
  "./app.js",
  "./api-client.js",
  "./manifest.webmanifest",
  "./assets/cospan-icon.svg",
  "./assets/event-entry-qr.svg",
  "./assets/splash.css",
  "./assets/default-memoji-grid.jpg",
  "./offline.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/c/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => (
        (await caches.match(url.pathname.endsWith("/join.html") ? "./join.html" : "./index.html"))
          || caches.match("./offline.html")
      )),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      return response;
    })),
  );
});
