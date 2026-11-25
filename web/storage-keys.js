// 本机存储（localStorage）的键名。
// - 跟着这台 iPad 走的：设备编号、管理口令、摊主上传的收款码，换场次不丢，用固定前缀 booth:
// - 跟着场次走的：本机订单记录、库存缓存，用 <场次 id>:
// 旧版（杭偶O / 南京偶O）全部用 hz-a12: 前缀，第一次打开新版时搬一次。

export const LEGACY_EVENT_ID = "hz-ouo-2026-10";
const MIGRATED_FLAG = "booth:migrated-hz-a12";

export function keysFor(eventId) {
  return {
    device: "booth:device",
    token: "booth:admin-token",
    qr: "booth:qr",
    log: `${eventId}:log`,
    stock: `${eventId}:stock-server`,
  };
}

// 旧键 → 新键。南京偶O 也用的是这套旧键，两场的本机记录都在 hz-a12:log 里，
// 统一归到杭偶O 名下；服务端按订单号去重，补传不会重复记账。
const LEGACY_MAP = {
  "hz-a12:device": "booth:device",
  "hz-a12:admin-token": "booth:admin-token",
  "hz-a12:qr": "booth:qr",
  "hz-a12:log": `${LEGACY_EVENT_ID}:log`,
};

// 返回是否搬了东西。旧键保留不删；新键已有值的不覆盖；搬过一次就不再搬。
export function migrateLegacy(storage) {
  try {
    if (storage.getItem(MIGRATED_FLAG)) return false;
    let moved = false;
    for (const [from, to] of Object.entries(LEGACY_MAP)) {
      const value = storage.getItem(from);
      if (value == null || storage.getItem(to) != null) continue;
      storage.setItem(to, value);
      moved = true;
    }
    const hasLegacy = Object.keys(LEGACY_MAP).some((k) => storage.getItem(k) != null);
    if (hasLegacy) storage.setItem(MIGRATED_FLAG, new Date().toISOString());
    return moved;
  } catch {
    return false;
  }
}

// 场次 id 一律是「名字-年-月」（例如 nj-ouo-2026-11）。同域还挂着别的应用，
// 只认这种形式的键，免得把别人的数据当成订单。
const EVENT_LOG_KEY = /^[a-z0-9]+(-[a-z0-9]+)*-\d{4}-\d{2}:log$/;

// 本机上其他场次的订单记录键（用来提示「上一场还有单没上传」）
export function otherEventLogKeys(storage, eventId) {
  try {
    const out = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && EVENT_LOG_KEY.test(k) && k !== `${eventId}:log`) out.push(k);
    }
    return out.sort();
  } catch {
    return [];
  }
}

// 本机订单记录：不是数组就当成空的，去掉不像订单的元素（数据被别的东西写坏时也不至于打不开页面）
export function safeLog(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((o) => o && typeof o === "object" && Array.isArray(o.items));
}
