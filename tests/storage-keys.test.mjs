import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { LEGACY_EVENT_ID, keysFor, migrateLegacy, otherEventLogKeys } from "../web/storage-keys.js";

// 和浏览器 localStorage 接口一致的内存版
function memoryStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}

describe("keysFor", () => {
  test("设备、口令、收款码跟 iPad 走，订单记录和库存缓存跟场次走", () => {
    assert.deepEqual(keysFor("nj-ouo-2026-11"), {
      device: "booth:device",
      token: "booth:admin-token",
      qr: "booth:qr",
      log: "nj-ouo-2026-11:log",
      stock: "nj-ouo-2026-11:stock-server",
    });
  });
});

describe("migrateLegacy", () => {
  const legacy = {
    "hz-a12:device": '"设备-L5I8"',
    "hz-a12:admin-token": '"tok"',
    "hz-a12:qr": '{"wechat":"data:x"}',
    "hz-a12:log": '[{"id":"o1","synced":false}]',
    "hz-a12:stock-server": '{"items":{}}',
  };

  test("旧键搬到新键，旧键保留", () => {
    const s = memoryStorage(legacy);
    assert.equal(migrateLegacy(s), true);
    const d = s.dump();
    assert.equal(d["booth:device"], legacy["hz-a12:device"]);
    assert.equal(d["booth:admin-token"], legacy["hz-a12:admin-token"]);
    assert.equal(d["booth:qr"], legacy["hz-a12:qr"]);
    assert.equal(d[`${LEGACY_EVENT_ID}:log`], legacy["hz-a12:log"]);
    for (const k of Object.keys(legacy)) assert.equal(d[k], legacy[k], `旧键 ${k} 不能删`);
    assert.equal(LEGACY_EVENT_ID, "hz-ouo-2026-10");
  });

  test("只迁移一次", () => {
    const s = memoryStorage(legacy);
    migrateLegacy(s);
    s.setItem(`${LEGACY_EVENT_ID}:log`, "[]");
    assert.equal(migrateLegacy(s), false);
    assert.equal(s.getItem(`${LEGACY_EVENT_ID}:log`), "[]");
  });

  test("新键已经有值时不覆盖", () => {
    const s = memoryStorage({ ...legacy, "booth:device": '"设备-NEW1"' });
    migrateLegacy(s);
    assert.equal(s.getItem("booth:device"), '"设备-NEW1"');
    assert.equal(s.getItem("booth:admin-token"), '"tok"');
  });

  test("没有旧数据时什么也不写", () => {
    const s = memoryStorage({});
    assert.equal(migrateLegacy(s), false);
    assert.deepEqual(s.dump(), {});
  });

  test("存储不可用时不抛错", () => {
    const broken = { get length() { throw new Error("denied"); }, getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); }, key() { throw new Error("denied"); } };
    assert.equal(migrateLegacy(broken), false);
    assert.deepEqual(otherEventLogKeys(broken, "x"), []);
  });
});

describe("otherEventLogKeys", () => {
  test("只返回别的场次的订单记录键", () => {
    const s = memoryStorage({
      "hz-ouo-2026-10:log": "[]",
      "nj-ouo-2026-11:log": "[]",
      "nj-ouo-2026-11:stock-server": "{}",
      "booth:device": '"d"',
      "hz-a12:log": "[]",
    });
    assert.deepEqual(otherEventLogKeys(s, "nj-ouo-2026-11"), ["hz-ouo-2026-10:log"]);
  });
});
