/* Service Worker — 九州慶生自駕之旅
   離線可用：快取 App 殼層；天氣等跨網域請求走網路
   改版時把 CACHE 版本號 +1 即可讓使用者更新 */
const CACHE = "kyushu-trip-v1";

/* 相對於 sw.js 所在位置的 App 殼層檔案（GitHub Pages 子路徑也適用） */
const ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/data.js",
  "./js/app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => {}) // 個別檔案失敗不擋安裝
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // 跨網域（天氣 API、Google Maps 導航等）一律走網路，不快取
  if (url.origin !== self.location.origin) return;

  // 導航請求：優先網路，失敗時回快取的首頁（離線也能開）
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).catch(() => caches.match("./index.html").then((r) => r || caches.match("./")))
    );
    return;
  }

  // 同網域靜態資源：快取優先，順便背景更新
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
