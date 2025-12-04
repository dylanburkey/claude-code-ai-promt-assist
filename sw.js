const CACHE_NAME = "prompt-engine-v1";
const ASSETS = ["./", "./index.html", "./manifest.json", "./icon.svg"];

// Install Event: Cache files
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)),
  );
});

// Fetch Event: Serve from cache, fall back to network
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches
      .match(event.request)
      .then((response) => response || fetch(event.request)),
  );
});
