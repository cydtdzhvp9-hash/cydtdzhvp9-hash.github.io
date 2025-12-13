// public/sw.js

const CACHE_NAME = "chirinya-pwa-v1";

// キャッシュ対象にする拡張子
const STATIC_FILE_EXTENSIONS = [
  ".js",
  ".css",
  ".html",
  ".ico",
  ".png",
  ".svg",
  ".webmanifest",
];

// インストール時：とりあえず即時アクティベート
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// 有効化時：古いキャッシュを掃除
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// fetch 時：HTML/CSS/JSなどをキャッシュしつつ返す
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // GET 以外はそのまま
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // 自分のオリジン以外は触らない
  if (url.origin !== self.location.origin) {
    return;
  }

  // ナビゲーション（画面遷移）の場合：ネット優先＋オフライン時はキャッシュ or ルート
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, copy);
          });
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => {
            if (cached) return cached;
            return caches.match("/");
          })
        )
    );
    return;
  }

  // 静的ファイル（.js, .css, .png など）は cache-first
  const isStatic = STATIC_FILE_EXTENSIONS.some((ext) =>
    url.pathname.endsWith(ext)
  );
  if (isStatic) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(request)
          .then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, copy);
            });
            return response;
          })
          .catch(() => {
            // 画像とかの取得に失敗した場合は何も返せないのでそのまま
            return new Response("Offline", { status: 503, statusText: "Offline" });
          });
      })
    );
  }
});