// 小広甜品铺出摊点单的订单同步服务：iPad 离线记账，联网后把订单补传到这里。
// 订单按场次分目录：ORDER_DATA_DIR/events/<EVENT_ID>/，EVENT_ID 必填。
// 订单按行追加到 JSONL；同一订单号重复上传只记一次。
// 库存与上下架存在 stock.json：点单页按 GET /api/stock 渲染菜单，收到新订单时在这里扣减。
// 汇总 / CSV / 清空 / 改库存需要 Bearer 管理口令（ADMIN_TOKEN）。
import { timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 19130);
const EVENT_ID = process.env.EVENT_ID || "";
if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(EVENT_ID)) {
  console.error(`EVENT_ID 未设置或不合法（只能用小写字母、数字和连字符）：${JSON.stringify(EVENT_ID)}`);
  process.exit(1);
}
const DATA_DIR = resolve(process.env.ORDER_DATA_DIR || "./data", "events", EVENT_ID);
const DATA_FILE = resolve(DATA_DIR, "orders.jsonl");
const STOCK_FILE = resolve(DATA_DIR, "stock.json");
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || "https://qing.matto.top,http://localhost:4180,http://127.0.0.1:4180")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

class InputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function send(res, status, body, headers = {}) {
  const isText = typeof body === "string";
  res.writeHead(status, {
    "Content-Type": isText ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  res.end(isText ? body : JSON.stringify(body));
}

function isAdmin(req) {
  if (!ADMIN_TOKEN) return false;
  const auth = req.headers.authorization || "";
  const supplied = Buffer.from(auth.startsWith("Bearer ") ? auth.slice(7) : "");
  const expected = Buffer.from(ADMIN_TOKEN);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

async function readJson(req, maxBytes = 16 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new InputError("请求内容过大。", 413);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new InputError("请求不是有效的 JSON。");
  }
}

const isInt = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
const isStr = (s, max) => typeof s === "string" && s.length > 0 && s.length <= max;

// 只收结构正确、金额自洽的订单；价格以下单那台设备上的菜单为准
function validateOrder(o) {
  if (!o || typeof o !== "object") throw new InputError("订单格式不正确。");
  if (!isStr(o.id, 64) || !/^[\w-]+$/.test(o.id)) throw new InputError("订单号不正确。");
  if (!isStr(o.t, 40) || Number.isNaN(Date.parse(o.t))) throw new InputError("下单时间不正确。");
  if (!isStr(o.device, 40)) throw new InputError("设备编号不正确。");
  if (!Array.isArray(o.items) || o.items.length < 1 || o.items.length > 60) throw new InputError("订单商品不正确。");
  const items = o.items.map((it) => {
    if (!it || !isStr(it.id, 64) || !isStr(it.name, 80) || !isInt(it.price, 0, 100000) || !isInt(it.qty, 1, 999)) {
      throw new InputError("订单商品不正确。");
    }
    return { id: it.id, name: it.name, shop: isStr(it.shop, 40) ? it.shop : "", price: it.price, qty: it.qty };
  });
  const sum = items.reduce((s, it) => s + it.price * it.qty, 0);
  if (!isInt(o.total, 0, 10_000_000) || o.total !== sum) throw new InputError("订单金额对不上。");
  return { id: o.id, t: new Date(o.t).toISOString(), device: o.device, total: sum, items };
}

async function createStore(file) {
  await mkdir(DATA_DIR, { recursive: true, mode: 0o750 });
  let orders = [];
  let ids = new Set();
  try {
    for (const line of (await readFile(file, "utf8")).split("\n")) {
      if (!line.trim()) continue;
      try {
        const rec = JSON.parse(line);
        if (rec?.id && !ids.has(rec.id)) {
          ids.add(rec.id);
          orders.push(rec);
        }
      } catch {
        // 单行损坏不影响服务
      }
    }
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  let queue = Promise.resolve();
  return {
    has: (id) => ids.has(id),
    all: () => orders,
    async add(rec) {
      if (ids.has(rec.id)) return false;
      ids.add(rec.id);
      orders.push(rec);
      queue = queue.then(() => appendFile(file, `${JSON.stringify(rec)}\n`, { mode: 0o640 }));
      await queue;
      return true;
    },
    // 清空 = 把当前文件改名归档，不真正删除
    async archive() {
      await queue;
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      try {
        await rename(file, `${file}.${stamp}.bak`);
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
      const n = orders.length;
      orders = [];
      ids = new Set();
      return n;
    },
  };
}

const MAX_STOCK = 9999;
const isProductId = (id) => isStr(id, 64) && /^[\w-]+$/.test(id);

// 改库存的请求：{ id, stock?: 数量 | null(不限量), delta?: ±数量, delisted?: 是否手动下架 }
function validateStockChange(b) {
  if (!b || typeof b !== "object" || !isProductId(b.id)) throw new InputError("商品不正确。");
  const change = {};
  if ("stock" in b) {
    if (b.stock !== null && !isInt(b.stock, 0, MAX_STOCK)) throw new InputError(`库存要填 0～${MAX_STOCK} 的整数，或留空表示不限量。`);
    change.stock = b.stock;
  }
  if ("delta" in b) {
    if (!isInt(b.delta, -MAX_STOCK, MAX_STOCK) || b.delta === 0) throw new InputError("库存增减不正确。");
    change.delta = b.delta;
  }
  if ("delisted" in b) {
    if (typeof b.delisted !== "boolean") throw new InputError("上下架状态不正确。");
    change.delisted = b.delisted;
  }
  if (!Object.keys(change).length) throw new InputError("没有要修改的内容。");
  return { id: b.id, change };
}

// 库存：{ items: { 商品id: { stock: 数量 | null, delisted: bool } }, updatedAt }
// 没写的商品 = 不限量、在架。写文件先写临时文件再改名，断电也不会留下半个文件。
async function createStockStore(file) {
  let state = { items: {}, updatedAt: null };
  try {
    const raw = JSON.parse(await readFile(file, "utf8"));
    if (raw && typeof raw.items === "object") state = { items: raw.items, updatedAt: raw.updatedAt ?? null };
  } catch (e) {
    // 文件坏了不能当成空库存启动，否则下次保存会把它覆盖掉
    if (e.code !== "ENOENT") throw e;
  }
  let queue = Promise.resolve();
  const save = () => {
    state.updatedAt = new Date().toISOString();
    const text = JSON.stringify(state, null, 2);
    queue = queue.then(async () => {
      await writeFile(`${file}.tmp`, text, { mode: 0o640 });
      await rename(`${file}.tmp`, file);
    });
    return queue;
  };
  const snapshot = () => structuredClone(state);
  return {
    snapshot,
    async update(id, { stock, delta, delisted }) {
      const e = { stock: null, delisted: false, ...state.items[id] };
      if (stock !== undefined) e.stock = stock;
      // 不限量时 +N 从 N 开始，-N 不变
      if (delta !== undefined) e.stock = e.stock === null ? (delta > 0 ? delta : null) : Math.min(MAX_STOCK, Math.max(0, e.stock + delta));
      if (delisted !== undefined) e.delisted = delisted;
      if (e.stock === null && !e.delisted) delete state.items[id];
      else {
        if (!state.items[id] && Object.keys(state.items).length >= 500) throw new InputError("商品太多了。");
        state.items[id] = e;
      }
      await save();
      return snapshot();
    },
    // 新订单入库后扣库存；扣到 0 为止
    async deduct(items) {
      let changed = false;
      for (const it of items) {
        const e = state.items[it.id];
        if (e && e.stock !== null) {
          e.stock = Math.max(0, e.stock - it.qty);
          changed = true;
        }
      }
      if (changed) await save();
    },
  };
}

function summarize(orders) {
  const products = new Map();
  const devices = new Map();
  let total = 0;
  for (const o of orders) {
    total += o.total;
    const d = devices.get(o.device) || { device: o.device, orders: 0, total: 0 };
    d.orders += 1;
    d.total += o.total;
    devices.set(o.device, d);
    for (const it of o.items) {
      const p = products.get(it.id) || { id: it.id, name: it.name, shop: it.shop, qty: 0, amount: 0 };
      p.qty += it.qty;
      p.amount += it.price * it.qty;
      products.set(it.id, p);
    }
  }
  return {
    orders: orders.length,
    total,
    devices: [...devices.values()],
    products: [...products.values()].sort((a, b) => b.qty - a.qty),
    last: orders.at(-1)?.receivedAt ?? null,
  };
}

function toCsv(orders) {
  const esc = (s) => `"${String(s).replaceAll('"', '""')}"`;
  const rows = [["下单时间", "设备", "订单号", "店铺", "商品", "单价", "数量", "小计"]];
  for (const o of orders) {
    const time = new Date(o.t).toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" });
    for (const it of o.items) rows.push([time, o.device, o.id, it.shop, it.name, it.price, it.qty, it.price * it.qty]);
  }
  return "﻿" + rows.map((r) => r.map(esc).join(",")).join("\n");
}

function rateLimiter(limit = 120, windowMs = 60_000) {
  const hits = new Map();
  return (ip) => {
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(ip, recent);
    return recent.length <= limit;
  };
}

const store = await createStore(DATA_FILE);
const stock = await createStockStore(STOCK_FILE);
const allow = rateLimiter();

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) return send(res, 403, { message: "来源不允许。" });

  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  if (!allow(ip)) return send(res, 429, { message: "请求过于频繁，请稍后再试。" });

  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      return send(res, 200, { ok: true, service: "hiro-booth-api", event: EVENT_ID });
    }

    if (req.method === "POST" && url.pathname === "/api/orders") {
      if (!req.headers["content-type"]?.startsWith("application/json")) throw new InputError("请使用 JSON。", 415);
      const order = validateOrder(await readJson(req));
      const created = await store.add({ ...order, receivedAt: new Date().toISOString() });
      // 同一订单重复上传只扣一次库存
      if (created) await stock.deduct(order.items);
      return send(res, 200, { ok: true, id: order.id, duplicate: !created, stock: stock.snapshot() });
    }

    if (req.method === "GET" && url.pathname === "/api/stock") {
      return send(res, 200, stock.snapshot());
    }

    if (url.pathname.startsWith("/api/admin/")) {
      if (!ADMIN_TOKEN) return send(res, 503, { message: "服务器还没配置管理口令。" });
      if (!isAdmin(req)) return send(res, 401, { message: "管理口令不正确。" });
      if (req.method === "GET" && url.pathname === "/api/admin/summary") return send(res, 200, summarize(store.all()));
      if (req.method === "GET" && url.pathname === "/api/admin/orders.csv") return send(res, 200, toCsv(store.all()));
      if (req.method === "PATCH" && url.pathname === "/api/admin/stock") {
        if (!req.headers["content-type"]?.startsWith("application/json")) throw new InputError("请使用 JSON。", 415);
        const { id, change } = validateStockChange(await readJson(req));
        return send(res, 200, await stock.update(id, change));
      }
      if (req.method === "POST" && url.pathname === "/api/admin/archive") {
        return send(res, 200, { ok: true, archived: await store.archive() });
      }
    }

    return send(res, 404, { message: "接口不存在。" });
  } catch (e) {
    if (e instanceof InputError) return send(res, e.status, { message: e.message });
    console.error(e);
    return send(res, 500, { message: "服务器出错了。" });
  }
});

server.listen(PORT, HOST, () => console.log(`hiro-booth-api (${EVENT_ID}) listening on ${HOST}:${PORT}`));
