// 每场展会的配置：events/<场次>/event.js
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const EVENTS = fileURLToPath(new URL("../events/", import.meta.url));
const dirs = readdirSync(EVENTS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

test("至少有南京偶O 和杭偶O 两场", () => {
  assert.ok(dirs.includes("nj-ouo-2026-11"));
  assert.ok(dirs.includes("hz-ouo-2026-10"));
});

for (const dir of dirs) {
  test(`${dir}：配置齐全、商品 id 不重复、图片都在`, async () => {
    const mod = await import(pathToFileURL(join(EVENTS, dir, "event.js")));
    const { event, shops, products, productById } = mod;
    assert.equal(event.id, dir, "event.id 要和目录名一致");
    assert.match(event.id, /^[a-z0-9]+(-[a-z0-9]+)*-\d{4}-\d{2}$/, "场次 id 要以 -年-月 结尾，例如 nj-ouo-2026-11");
    for (const k of ["name", "city", "booth", "date"]) assert.ok(typeof event[k] === "string" && event[k], `缺 event.${k}`);
    assert.match(event.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(Array.isArray(shops) && shops.length > 0);
    const ids = products.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length, "商品 id 重复");
    assert.equal(productById.size, ids.length);
    for (const p of products) {
      assert.ok(Number.isInteger(p.price) && p.price >= 0, `${p.id} 价格不对`);
      assert.match(p.image, /^assets\/[\w.-]+$/, `${p.id} 图片路径要在 assets/ 下`);
      assert.ok(existsSync(join(EVENTS, dir, p.image)), `${dir}/${p.image} 不存在`);
    }
  });
}

test("杭偶O 的商品名和价格与 10-24 订单一致", async () => {
  const { productById } = await import(pathToFileURL(join(EVENTS, "hz-ouo-2026-10", "event.js")));
  // 来自 ycy 上 2026-10-24 的订单（id、名称、价格）
  const sold = {
    "badge-kotone": ["双闪吧唧", 12], book: ["新刊", 30], "consign-book": ["篠澤迷走神经", 65],
    "consign-mug": ["搪瓷杯套组", 35], "consign-tote": ["尼龙托特包", 40], "eye-mask": ["眼罩", 25],
    "pvc-hiro": ["PVC 透卡 · 筱澤广", 8], "rabbit-stand": ["兔兔小广大立牌", 30], "shikishi-kotone": ["触感膜色纸", 15],
    "spring-hiro": ["摇摇乐立牌 · 筱澤广", 15], "spring-kotone": ["摇摇乐立牌 · 藤田琴音", 15],
    "spring-lilja": ["摇摇乐立牌 · 葛城莉莉娅", 15], "spring-misuzu": ["摇摇乐立牌 · 秦谷美铃", 15],
    "whisper-stand": ["悄悄话立牌", 15], "window-china": ["QQ 人彩窗立牌 · 仓本千奈", 18],
    "window-hiro": ["QQ 人彩窗立牌 · 筱澤广", 18], "window-kotone": ["QQ 人彩窗立牌 · 藤田琴音", 18],
    "window-lilja": ["QQ 人彩窗立牌 · 葛城莉莉娅", 18], "window-misuzu": ["QQ 人彩窗立牌 · 秦谷美铃", 18],
  };
  for (const [id, [name, price]] of Object.entries(sold)) {
    const p = productById.get(id);
    assert.ok(p, `缺 ${id}`);
    assert.equal(p.fullName, name, id);
    assert.equal(p.price, price, id);
  }
});
