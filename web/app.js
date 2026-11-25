import { event, products, productById } from "./catalog.js";
import { keysFor, migrateLegacy, otherEventLogKeys } from "./storage-keys.js";

const $ = (sel) => document.querySelector(sel);
const yuan = (n) => `¥${n}`;

// ---------- 本机存储（全部 try/catch：隐私模式或存储被清掉时照常能点单） ----------
const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
};

// 旧版的 hz-a12: 键搬到新键（只搬一次）。要在下面读取本机数据之前做。
try {
  migrateLegacy(localStorage);
} catch {
  /* 存储不可用就算了 */
}
const KEYS = keysFor(event.id);
const KEY_QR = KEYS.qr;
const KEY_STOCK = KEYS.stock; // 最近一次从服务器拿到的库存，断网时照它渲染
const KEY_LOG = KEYS.log;
const KEY_DEVICE = KEYS.device;
const KEY_TOKEN = KEYS.token;

let pendingReload = false;

const state = {
  cart: new Map(), // id -> qty
  qr: store.get(KEY_QR, {}), // { wechat: dataURL, alipay: dataURL }
  // 服务器上的库存：{ items: { id: { stock: 数量 | null, delisted } }, updatedAt, fetchedAt }
  server: store.get(KEY_STOCK, { items: {}, updatedAt: null, fetchedAt: null }),
  pending: new Map(), // 本机还没传上服务器的订单占用的数量
};

// 旧版把库存 / 售罄存在本机，现在改由服务器保存，旧数据不再使用
for (const key of ["hz-a12:stock", "hz-a12:soldout"]) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* 存储不可用就算了 */
  }
}

// ---------- 库存（以服务器为准） ----------
// 菜单按服务器返回的库存渲染。服务器在收到订单时扣库存；断网期间下的单还没传上去，
// 先在本机从服务器数字里减掉，避免超卖，联网补传后以服务器为准。
const entryOf = (id) => state.server.items?.[id] ?? { stock: null, delisted: false };
// 剩余数量；null = 不限量
function stockOf(id) {
  const { stock } = entryOf(id);
  return stock === null || stock === undefined ? null : Math.max(0, stock - (state.pending.get(id) || 0));
}
// 菜单上显示：没被手动下架，而且没卖完
const isListed = (id) => !entryOf(id).delisted && stockOf(id) !== 0;
// 还能再往篮子里加几件（不限量时返回 Infinity）
function addable(id) {
  const n = stockOf(id);
  return n === null ? Infinity : n - (state.cart.get(id) || 0);
}

function pendingQty() {
  const m = new Map();
  for (const o of readLog()) if (!o.synced && !o.rejected) for (const it of o.items) m.set(it.id, (m.get(it.id) || 0) + it.qty);
  return m;
}

// 库存或订单状态变了之后：篮子里超出的部分去掉；在架商品有变化才重排菜单（避免定时刷新时画面闪动）
let listedKey = null;
function applyStock() {
  state.pending = pendingQty();
  // 顾客正在付款时不动篮子，否则记下的订单会和顾客付的钱对不上
  if ($("#pay").hidden) {
    for (const [id, qty] of state.cart) {
      const n = stockOf(id);
      if (!isListed(id)) state.cart.delete(id);
      else if (n !== null && qty > n) state.cart.set(id, n);
    }
  }
  const key = listed().map((p) => p.id).join(",");
  if (key !== listedKey) {
    renderMenu();
    layoutMenu();
  }
  render();
  if ($("#admin").open) renderStock();
}

function setServerStock(s) {
  if (!s || typeof s.items !== "object") return;
  state.server = { items: s.items, updatedAt: s.updatedAt ?? null, fetchedAt: new Date().toISOString() };
  store.set(KEY_STOCK, state.server);
  stockError = "";
  applyStock();
}

let stockError = "";
async function fetchStock() {
  if (!navigator.onLine) {
    stockError = "当前没有网络";
    return;
  }
  try {
    const res = await fetch(`${API}stock`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setServerStock(await res.json());
  } catch {
    stockError = "连不上服务器";
    if ($("#admin").open) renderStock();
  }
}

const listed = () => products.filter((p) => isListed(p.id));

function renderMenu() {
  const list = listed();
  listedKey = list.map((p) => p.id).join(",");
  $("#menu").innerHTML = list.length
    ? list.map(renderCard).join("")
    : `<p class="menu-empty">今天的商品都卖完啦，谢谢大家！</p>`;
  for (const img of document.querySelectorAll(".card-img img")) {
    if (img.complete && img.naturalWidth) matchBackdrop(img);
    else img.addEventListener("load", () => matchBackdrop(img), { once: true });
  }
}

// 商品图完整显示（不裁切）；图片四周的留白填成这张图自己左上角的底色，看起来像铺满
function matchBackdrop(img) {
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 2, 2, 1, 1, 0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    img.parentElement.style.backgroundColor = `rgb(${r} ${g} ${b})`;
  } catch {
    /* 取色失败就保留默认底色 */
  }
}

function renderCard(p) {
  return `
    <article class="card${p.shop === "consign" ? " is-consign" : ""}" data-id="${p.id}">
      <button class="card-hit" type="button" data-add="${p.id}" aria-label="把 ${p.fullName} 放进篮子">
        <span class="card-img"><img src="${p.image}" alt="" draggable="false"></span>
        <span class="card-meta">
          <span class="card-name">${p.name}</span>
          ${p.spec ? `<span class="card-spec">${p.spec}</span>` : ""}
          <span class="price-badge">${p.price}</span>
        </span>
      </button>
      <output class="qty-badge" data-qty="${p.id}">0</output>
      <button class="card-minus" type="button" data-sub="${p.id}" aria-label="${p.fullName} 减一">−</button>
      <span class="stock-left" data-left="${p.id}" hidden></span>
    </article>`;
}

// 一屏铺满：在可用区域里试不同列数，选让商品图最大的排法；
// 图小于 MIN_IMG 时（手机等小屏）退回可滚动的网格。
const GAP = 12;
const MIN_IMG = 80;
function layoutMenu() {
  const menu = $("#menu");
  const cs = getComputedStyle(menu);
  const W = menu.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const H = menu.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const meta = Math.max(...[...menu.querySelectorAll(".card-meta")].map((m) => m.offsetHeight), 44);
  const n = Math.max(1, listed().length);
  let best = { side: 0 };
  for (let cols = 2; cols <= 8; cols++) {
    const rows = Math.ceil(n / cols);
    const w = (W - (cols - 1) * GAP) / cols;
    const h = (H - (rows - 1) * GAP) / rows;
    const side = Math.min(w, h - meta);
    if (side > best.side) best = { cols, rows, side };
  }
  const fit = best.side >= MIN_IMG;
  const cols = fit ? best.cols : Math.max(2, Math.floor((W + GAP) / (160 + GAP)));
  const cardW = (W - (cols - 1) * GAP) / cols;
  // 卡片宽 - 左右留白和边框，放下 7 个字
  menu.style.setProperty("--name-size", `${Math.min(18, Math.max(12.5, (cardW - 22) / 7.1)).toFixed(1)}px`);
  menu.classList.toggle("is-fit", fit);
  menu.style.setProperty("--cols", cols);
  menu.style.setProperty("--rows", fit ? best.rows : "auto");
}

// 剩余不超过这个数时，卡片上提示「仅剩 N」
const LOW_STOCK = 3;

function syncCards() {
  for (const card of document.querySelectorAll(".card")) {
    const id = card.dataset.id;
    const qty = state.cart.get(id) || 0;
    card.classList.toggle("in-cart", qty > 0);
    const left = addable(id);
    card.classList.toggle("is-maxed", left <= 0);
    const tag = card.querySelector(`[data-left="${id}"]`);
    tag.hidden = left > LOW_STOCK;
    tag.textContent = left > 0 ? `仅剩 ${left}` : "没有更多了";
    card.querySelector(`[data-qty="${id}"]`).textContent = qty;
  }
}

// ---------- 篮子 ----------
function add(id, delta) {
  if (delta > 0 && (!isListed(id) || addable(id) <= 0)) return;
  const next = (state.cart.get(id) || 0) + delta;
  if (next <= 0) state.cart.delete(id);
  else state.cart.set(id, Math.min(next, 99));
  render();
  if (delta > 0) bump(id);
}

function bump(id) {
  const card = document.querySelector(`.card[data-id="${id}"]`);
  if (!card) return;
  card.classList.remove("bump");
  void card.offsetWidth;
  card.classList.add("bump");
}

function lines() {
  return [...state.cart].map(([id, qty]) => ({ p: productById.get(id), qty }));
}

function total() {
  return lines().reduce((sum, { p, qty }) => sum + p.price * qty, 0);
}

function count() {
  return lines().reduce((sum, { qty }) => sum + qty, 0);
}

function renderCart() {
  const list = lines();
  $("#cart-list").innerHTML = list
    .map(
      ({ p, qty }) => `
      <li class="line">
        <img src="${p.image}" alt="" draggable="false">
        <span class="line-name">${p.fullName}<small>${yuan(p.price)}</small></span>
        <span class="line-step">
          <button type="button" data-sub="${p.id}" aria-label="减少">−</button>
          <b>${qty}</b>
          <button type="button" data-add="${p.id}" aria-label="增加">+</button>
        </span>
      </li>`,
    )
    .join("");
  const n = count();
  $("#cart-empty").hidden = n > 0;
  $("#cart-count").textContent = `${n} 件`;
  $("#cart-count-inline").textContent = n ? ` · ${n} 件` : "";
  $("#cart-total").textContent = yuan(total());
  $("#btn-pay").disabled = n === 0;
  $("#btn-pay").textContent = n ? `去付款 ${yuan(total())}` : "去付款";
  $("#btn-clear").hidden = n === 0;
  document.body.classList.toggle("has-items", n > 0);
}

function render() {
  syncCards();
  renderCart();
  if (pendingReload && !count() && $("#pay").hidden && $("#thanks").hidden) location.reload();
}

// ---------- 付款页 ----------
// 内置收款码；摊主设置里上传的图优先
const QR_DEFAULT = { wechat: "assets/qr-wechat.webp", alipay: "assets/qr-alipay.webp" };

function qrMarkup(kind) {
  const src = state.qr[kind] || QR_DEFAULT[kind];
  return src
    ? `<img src="${src}" alt="${kind === "wechat" ? "微信" : "支付宝"}收款码" draggable="false">`
    : `<span class="qr-missing">还没有上传<br>收款码</span>`;
}

let payTimer = 0;
function openPay() {
  if (!count()) return;
  const sum = yuan(total());
  $("#pay-amount").textContent = sum;
  $("#pay-amount-inline").textContent = sum;
  $("#pay-list").innerHTML = lines()
    .map(({ p, qty }) => `<li><span>${p.fullName}</span><span>× ${qty}</span><b>${yuan(p.price * qty)}</b></li>`)
    .join("");
  $("#qr-wechat").innerHTML = qrMarkup("wechat");
  $("#qr-alipay").innerHTML = qrMarkup("alipay");
  $("#pay").hidden = false;
  // 顾客走开忘了点：5 分钟没动静就回到首页（篮子保留）
  clearTimeout(payTimer);
  payTimer = setTimeout(closePay, 5 * 60 * 1000);
}

function closePay() {
  clearTimeout(payTimer);
  $("#pay").hidden = true;
}

function finishOrder() {
  logOrder();
  state.cart.clear();
  closePay();
  // 先按本机待上传的订单减库存，再上传；上传成功后换成服务器扣过的数字
  applyStock();
  syncOrders();
  $("#menu").scrollTo({ top: 0, behavior: "instant" });
  $("#thanks").hidden = false;
  clearTimeout(thanksTimer);
  thanksTimer = setTimeout(closeThanks, THANKS_MS);
}

// 「谢谢惠顾」卡片：自动关闭，点任意处也能提前关
const THANKS_MS = 2600;
let thanksTimer = 0;
function closeThanks() {
  clearTimeout(thanksTimer);
  $("#thanks").hidden = true;
  if (pendingReload && !count()) location.reload();
}

// ---------- 记录 ----------
// 每单先存本机（断网也不丢），再上传服务器；synced 标记是否已传上去。
// 记录格式：{ id, t, device, total, items: [{ id, name, shop, price, qty }], synced }
const SHOP_NAME = { sweet: "小広甜品铺", consign: "老広虾粥铺(寄售)" };
const API = "api/";

function deviceId() {
  let id = store.get(KEY_DEVICE, "");
  if (!id) {
    id = `设备-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    store.set(KEY_DEVICE, id);
  }
  return id;
}

function newOrderId() {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// 旧版本记录（items 为 [id, qty]、没有订单号）按当前菜单补全，之后照常上传
// key：默认是当前场次；补传上一场时传别的场次的键
function readLog(key = KEY_LOG) {
  const log = store.get(key, []);
  let changed = false;
  const out = log.map((o) => {
    if (o.id && o.items.every((it) => !Array.isArray(it))) return o;
    changed = true;
    const items = o.items
      .map((it) => (Array.isArray(it) ? { p: productById.get(it[0]), qty: it[1] } : { p: null, ...it }))
      .map(({ p, qty, ...it }) => (p ? { id: p.id, name: p.fullName, shop: SHOP_NAME[p.shop], price: p.price, qty } : { ...it, qty }))
      .filter((it) => it.id && it.name);
    return { id: o.id || newOrderId(), t: o.t, device: o.device || deviceId(), total: items.reduce((s, it) => s + it.price * it.qty, 0), items, synced: !!o.synced };
  });
  if (changed) store.set(key, out);
  return out;
}

function logOrder() {
  const log = readLog();
  log.push({
    id: newOrderId(),
    t: new Date().toISOString(),
    device: deviceId(),
    total: total(),
    items: lines().map(({ p, qty }) => ({ id: p.id, name: p.fullName, shop: SHOP_NAME[p.shop], price: p.price, qty })),
    synced: false,
  });
  store.set(KEY_LOG, log);
}

// 把上传结果写回本机记录（重新读一次，避免覆盖上传期间新下的单）
function markOrders(updates, key = KEY_LOG) {
  const log = readLog(key);
  for (const o of log) if (updates.has(o.id)) Object.assign(o, updates.get(o.id));
  store.set(key, log);
}

let syncing = false;
let lastSyncError = "";
async function syncOrders(key = KEY_LOG) {
  if (syncing || !navigator.onLine) return;
  const pending = readLog(key).filter((o) => !o.synced && !o.rejected);
  if (!pending.length) return;
  syncing = true;
  const updates = new Map();
  let latestStock = null;
  try {
    for (const { synced, rejected, ...order } of pending) {
      const res = await fetch(`${API}orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(order),
      });
      if (res.ok) {
        updates.set(order.id, { synced: true });
        const body = await res.json().catch(() => ({}));
        if (body.stock) latestStock = body.stock;
      }
      else if (res.status === 400) {
        // 数据本身有问题，重试也没用：标记出来，不再重传
        const { message } = await res.json().catch(() => ({}));
        updates.set(order.id, { rejected: message || "服务器拒收" });
      } else throw new Error(`HTTP ${res.status}`);
    }
    lastSyncError = "";
  } catch (e) {
    lastSyncError = navigator.onLine ? "服务器暂时连不上，稍后自动重试" : "当前没有网络，联网后自动上传";
  } finally {
    if (updates.size) markOrders(updates, key);
    syncing = false;
    // 标记已上传和换成服务器扣过的库存要一起做，否则这几单会被扣两次或漏扣
    if (latestStock) setServerStock(latestStock);
    else if (updates.size) fetchStock();
    if ($("#admin").open) renderStats();
  }
}

function renderStats() {
  const log = readLog();
  const per = new Map();
  for (const o of log) for (const it of o.items) per.set(it.id, (per.get(it.id) || 0) + it.qty);
  const sum = log.reduce((s, o) => s + o.total, 0);
  const rows = products
    .filter((p) => per.has(p.id))
    .map((p) => `<li><span>${p.fullName}</span><b>${per.get(p.id)}</b></li>`)
    .join("");
  const synced = log.filter((o) => o.synced).length;
  const rejected = log.filter((o) => o.rejected).length;
  const pending = log.length - synced - rejected;
  $("#admin-stats").innerHTML = `
    <p class="stats-sum"><span>${log.length} 单</span><strong>${yuan(sum)}</strong></p>
    ${rows ? `<ul class="stats-list">${rows}</ul>` : `<p class="admin-note">还没有记录。</p>`}`;
  $("#admin-sync").innerHTML = `
    <span class="sync-dot ${pending ? "is-pending" : "is-ok"}"></span>
    本机编号 <b>${deviceId()}</b> · 已上传 ${synced} 单${pending ? ` · <b>待上传 ${pending} 单</b>` : ""}${rejected ? ` · 被拒收 ${rejected} 单` : ""}
    ${pending && lastSyncError ? `<br><small>${lastSyncError}</small>` : ""}`;
  $("#btn-sync").hidden = !pending;
  renderOtherEvents();
}

// 换了场次后，本机上一场还有没传上去的单：提示并提供补传
function otherPending() {
  return otherEventLogKeys(localStorage, event.id)
    .map((key) => ({ key, n: readLog(key).filter((o) => !o.synced && !o.rejected).length }))
    .filter((x) => x.n);
}

function renderOtherEvents() {
  const n = otherPending().reduce((s, x) => s + x.n, 0);
  $("#admin-other").hidden = !n;
  $("#admin-other-text").textContent = n ? `上一场还有 ${n} 单没上传` : "";
}

async function syncOtherEvents() {
  for (const { key } of otherPending()) await syncOrders(key);
  renderStats();
}

function downloadCsv(csv, name) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function exportCsv() {
  const esc = (s) => `"${String(s).replaceAll('"', '""')}"`;
  const rows = [["时间", "店铺", "商品", "单价", "数量", "小计", "已上传"]];
  for (const o of readLog()) {
    const time = new Date(o.t).toLocaleString("zh-CN", { hour12: false });
    for (const it of o.items) rows.push([time, it.shop, it.name, it.price, it.qty, it.price * it.qty, o.synced ? "是" : "否"]);
  }
  downloadCsv("﻿" + rows.map((r) => r.map(esc).join(",")).join("\n"), `${event.booth}-${event.name}-本机记录-${new Date().toISOString().slice(0, 10)}.csv`);
}

// ---------- 服务器汇总（需要管理口令，口令只存在这台设备上） ----------
async function adminFetch(path, options = {}) {
  const token = $("#admin-token").value.trim();
  if (!token) throw new Error("请先填写管理口令");
  store.set(KEY_TOKEN, token);
  let res;
  try {
    res = await fetch(`${API}admin/${path}`, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` } });
  } catch {
    throw new Error("连不上服务器，检查一下网络");
  }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || `服务器返回 ${res.status}`);
  return res;
}

async function showServerSummary() {
  const box = $("#server-stats");
  box.innerHTML = `<p class="admin-note">读取中…</p>`;
  try {
    const s = await (await adminFetch("summary")).json();
    const devices = s.devices.map((d) => `${d.device}：${d.orders} 单 ${yuan(d.total)}`).join("　");
    const rows = s.products.map((p) => `<li><span>${p.name}</span><b>${p.qty}</b></li>`).join("");
    box.innerHTML = `
      <p class="stats-sum"><span>服务器共 ${s.orders} 单</span><strong>${yuan(s.total)}</strong></p>
      ${devices ? `<p class="admin-note">${devices}</p>` : ""}
      ${rows ? `<ul class="stats-list">${rows}</ul>` : `<p class="admin-note">服务器上还没有订单。</p>`}`;
  } catch (e) {
    box.innerHTML = `<p class="admin-note error">${e.message}</p>`;
  }
}

async function exportServerCsv() {
  try {
    const csv = await (await adminFetch("orders.csv")).text();
    downloadCsv(csv, `${event.booth}-${event.name}-服务器订单-${new Date().toISOString().slice(0, 10)}.csv`);
  } catch (e) {
    $("#server-stats").innerHTML = `<p class="admin-note error">${e.message}</p>`;
  }
}

async function archiveServer() {
  if (!confirm("清空服务器上的订单记录吗？（服务器会留一份备份，不会真正删除）\n建议先导出服务器 CSV。")) return;
  try {
    const { archived } = await (await adminFetch("archive", { method: "POST" })).json();
    $("#server-stats").innerHTML = `<p class="admin-note">已清空，归档了 ${archived} 单。</p>`;
  } catch (e) {
    $("#server-stats").innerHTML = `<p class="admin-note error">${e.message}</p>`;
  }
}

// ---------- 摊主设置（长按顶部横幅 1.5 秒打开） ----------
function renderAdmin() {
  $("#admin-qr-wechat").innerHTML = qrMarkup("wechat");
  $("#admin-qr-alipay").innerHTML = qrMarkup("alipay");
  renderStock();
  renderStats();
  $("#admin-token").value = store.get(KEY_TOKEN, "");
  const sw = navigator.serviceWorker?.controller;
  $("#admin-offline").textContent = sw ? "✓ 已缓存，可断网使用" : "⚠︎ 尚未完成离线缓存：请联网打开一次后再断网使用";
}

function renderStock() {
  // 正在输入库存数字时不刷新，免得把输入框冲掉
  if (!document.activeElement?.matches?.("[data-stock-input]")) $("#admin-stock").innerHTML = products.map(stockRow).join("");
  const { fetchedAt } = state.server;
  const time = fetchedAt ? new Date(fetchedAt).toLocaleTimeString("zh-CN", { hour12: false }) : "";
  const pending = [...state.pending.values()].reduce((a, b) => a + b, 0);
  const error = navigator.onLine ? stockError : "当前没有网络";
  $("#stock-sync").innerHTML = `
    <span class="sync-dot ${error || !fetchedAt ? "is-pending" : "is-ok"}"></span>
    ${fetchedAt ? `库存以服务器为准 · ${time} 更新` : "还没从服务器拿到库存"}${error ? ` · <b>${error}</b>，显示的是上次拿到的数字` : ""}
    ${pending ? `<br><small>有 ${pending} 件商品的订单还没上传，已先从库存里减掉</small>` : ""}`;
}

function stockRow(p) {
  const n = stockOf(p.id);
  const off = entryOf(p.id).delisted;
  const status = off ? "已手动下架" : n === 0 ? "已售尽，菜单已隐藏" : n === null ? "不限量" : `剩 ${n} 件`;
  return `
    <div class="stock-row${off ? " is-off" : n === 0 ? " is-out" : ""}" data-stock-row="${p.id}">
      <img src="${p.image}" alt="" draggable="false">
      <span class="stock-name">${p.fullName}<small>${status}</small></span>
      <span class="stock-step">
        <button type="button" data-stock-step="-1" aria-label="${p.fullName} 库存减一">−</button>
        <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4" value="${n ?? ""}" placeholder="不限" data-stock-input aria-label="${p.fullName} 库存">
        <button type="button" data-stock-step="1" aria-label="${p.fullName} 库存加一">+</button>
      </span>
      <button type="button" class="stock-soldout" data-stock-soldout ${n === 0 ? "disabled" : ""}>${n === 0 ? "已售尽" : "售尽"}</button>
      <button type="button" class="stock-toggle" data-stock-toggle>${off ? "上架" : "下架"}</button>
    </div>`;
}

// 改库存都走服务器，成功后按服务器返回的结果重新渲染；失败就提示并恢复原样
async function updateStock(id, change) {
  const row = document.querySelector(`[data-stock-row="${id}"]`);
  row?.classList.add("is-saving");
  $("#stock-error").textContent = "";
  try {
    // 填的数字是「现在手上还有几件」：还没上传的订单到了服务器会再扣，所以这里先加回去
    if (change.stock != null) change = { ...change, stock: change.stock + (state.pending.get(id) || 0) };
    const res = await adminFetch("stock", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...change }),
    });
    setServerStock(await res.json());
  } catch (e) {
    $("#stock-error").textContent = `${productById.get(id)?.fullName ?? id}：${e.message}`;
    renderStock();
  } finally {
    document.querySelector(`[data-stock-row="${id}"]`)?.classList.remove("is-saving");
  }
}

function openAdmin() {
  renderAdmin();
  $("#admin").showModal();
}

// 收款码压缩到最长边 900px，避免撑爆 localStorage
function readQr(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 900 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function bindLongPress(el, ms, fn) {
  let timer = 0;
  const start = () => {
    clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
  const cancel = () => clearTimeout(timer);
  el.addEventListener("pointerdown", start);
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) el.addEventListener(ev, cancel);
  el.addEventListener("contextmenu", (e) => e.preventDefault());
}

// ---------- 事件 ----------
document.addEventListener("click", (e) => {
  const addBtn = e.target.closest("[data-add]");
  const subBtn = e.target.closest("[data-sub]");
  if (addBtn) return add(addBtn.dataset.add, 1);
  if (subBtn) return add(subBtn.dataset.sub, -1);

  const stockRowEl = e.target.closest("[data-stock-row]");
  if (stockRowEl && !stockRowEl.classList.contains("is-saving")) {
    const id = stockRowEl.dataset.stockRow;
    const step = e.target.closest("[data-stock-step]");
    if (step) return updateStock(id, { delta: Number(step.dataset.stockStep) });
    // 售尽：库存直接归 0，菜单上隐藏；补货时改数字
    if (e.target.closest("[data-stock-soldout]")) return updateStock(id, { stock: 0 });
    if (e.target.closest("[data-stock-toggle]")) return updateStock(id, { delisted: !entryOf(id).delisted });
  }

  const clearQr = e.target.closest("[data-qr-clear]");
  if (clearQr) {
    e.preventDefault();
    delete state.qr[clearQr.dataset.qrClear];
    store.set(KEY_QR, state.qr);
    renderAdmin();
  }
});

document.addEventListener("change", async (e) => {
  const stockInput = e.target.closest("[data-stock-input]");
  if (stockInput) {
    const id = stockInput.closest("[data-stock-row]").dataset.stockRow;
    const raw = stockInput.value.trim();
    // 清空 = 不限量；填了非数字就恢复原值
    if (raw === "") return updateStock(id, { stock: null });
    if (/^\d+$/.test(raw)) return updateStock(id, { stock: Number(raw) });
    stockInput.blur();
    return renderStock();
  }
  const input = e.target.closest("input[data-qr]");
  if (!input?.files?.[0]) return;
  try {
    state.qr[input.dataset.qr] = await readQr(input.files[0]);
    if (!store.set(KEY_QR, state.qr)) alert("保存失败：这台设备的浏览器存储不可用（可能处于无痕模式）。");
  } catch {
    alert("这张图片读不出来，换一张试试。");
  }
  input.value = "";
  renderAdmin();
});

$("#btn-pay").addEventListener("click", openPay);
$("#btn-back").addEventListener("click", closePay);
$("#btn-done").addEventListener("click", finishOrder);
$("#thanks").addEventListener("click", closeThanks);
$("#btn-clear").addEventListener("click", () => {
  state.cart.clear();
  render();
});
$("#cart-toggle").addEventListener("click", () => document.body.classList.toggle("cart-open"));
$("#btn-export").addEventListener("click", exportCsv);
$("#btn-sync").addEventListener("click", () => syncOrders());
$("#btn-sync-other").addEventListener("click", syncOtherEvents);
$("#btn-server-summary").addEventListener("click", showServerSummary);
$("#btn-server-csv").addEventListener("click", exportServerCsv);
$("#btn-server-archive").addEventListener("click", archiveServer);
$("#btn-reset-log").addEventListener("click", () => {
  const pending = readLog().filter((o) => !o.synced && !o.rejected).length;
  const warn = pending ? `\n注意：还有 ${pending} 单没上传到服务器，清空后这几单就只剩导出的 CSV 了。` : "";
  if (confirm(`清空这台设备上的销售记录吗？（服务器上的记录不受影响）${warn}`)) {
    store.set(KEY_LOG, []);
    renderStats();
  }
});
// 库存输入框里按回车：只确认数字，别把设置窗口关掉
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.matches?.("[data-stock-input]")) {
    e.preventDefault();
    e.target.blur();
  }
});
// 页面标题和横幅上的摊位号、展会名都来自这场的配置
document.title = `小広甜品铺 · ${event.booth}`;
$("#banner-booth").textContent = event.booth;
$("#banner-place").textContent = `${event.city} · ${event.name}`;
$("#banner img").alt = `小広甜品铺 · ${event.booth} · ${event.city} · ${event.name}`;

bindLongPress($("#banner"), 1500, openAdmin);

// 双指缩放 / 双击放大会打断顾客操作，统一屏蔽
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("dblclick", (e) => e.preventDefault());

applyStock();
syncOrders();
fetchStock();
addEventListener("online", () => {
  syncOrders();
  fetchStock();
});
setInterval(() => {
  syncOrders();
  fetchStock();
}, 30_000);
addEventListener("resize", layoutMenu);
document.fonts?.ready.then(layoutMenu);

// 本机预览不注册，免得调试时总拿到旧缓存
if ("serviceWorker" in navigator && !["localhost", "127.0.0.1"].includes(location.hostname)) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
  // 部署了新版（sw.js 的 VERSION 变了）：篮子空着就马上刷新，有顾客在点单就等这一单结束
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) return;
    if (!count()) location.reload();
    else pendingReload = true;
  });
}
