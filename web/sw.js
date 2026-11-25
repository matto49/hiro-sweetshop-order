// 离线缓存：首次联网打开后，所有页面和图片都存在 iPad 本机，展会现场断网照常使用。
// 改了文件后：iPad 联网打开会在后台更新，再打开一次即生效。
// 下面两行由 tools/build-web.mjs 在构建时生成：VERSION 每次构建都变，FILES 是这场实际输出的全部文件。
const VERSION = "__VERSION__";
const FILES = __FILES__;

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
