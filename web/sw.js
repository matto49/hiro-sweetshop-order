// 离线缓存：首次联网打开后，所有页面和图片都存在 iPad 本机，展会现场断网照常使用。
// 改了文件后：iPad 联网打开会在后台更新，再打开一次即生效。删了/改名了文件时把 VERSION 加一。
const VERSION = "a12-v21";
const FILES = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "catalog.js",
  "manifest.webmanifest",
  "assets/apple-touch-icon.png",
  "assets/badge-kotone.webp",
  "assets/banner-sweet.webp",
  "assets/book.webp",
  "assets/consign-book.webp",
  "assets/consign-mug.webp",
  "assets/consign-tote.webp",
  "assets/eye-mask.webp",
  "assets/icon-512.png",
  "assets/avatar.webp",
  "assets/pvc-hiro.webp",
  "assets/pvc-kotone.webp",
  "assets/qr-alipay.webp",
  "assets/qr-wechat.webp",
  "assets/rabbit-stand.webp",
  "assets/shikishi-hiro.webp",
  "assets/shikishi-kotone.webp",
  "assets/spring-hiro.webp",
  "assets/spring-kotone.webp",
  "assets/spring-lilja.webp",
  "assets/spring-misuzu.webp",
  "assets/whisper-stand.webp",
  "assets/window-china.webp",
  "assets/window-hiro.webp",
  "assets/window-kotone.webp",
  "assets/window-lilja.webp",
  "assets/window-misuzu.webp",
];

self.addEventListener("install", (event) => {
  event.waitUntil(// cache: "reload" 绕过浏览器 HTTP 缓存，确保装进来的是服务器上的最新文件
    caches.open(VERSION).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).pathname.includes("/api/")) return;
  // 先用缓存秒开；联网时顺便在后台更新缓存，下次打开就是新版
  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const hit = await cache.match(event.request, { ignoreSearch: true });
      const update = fetch(event.request, { cache: "no-cache" })
        .then((res) => {
          if (res.ok && new URL(event.request.url).origin === location.origin) cache.put(event.request, res.clone());
          return res;
        })
        .catch(() => hit);
      if (hit) {
        event.waitUntil(update);
        return hit;
      }
      return update;
    }),
  );
});
