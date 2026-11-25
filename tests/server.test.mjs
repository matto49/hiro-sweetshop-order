import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { order, postOrder, spawnServer } from "./helpers/spawn-server.mjs";

const TOKEN = "test-admin-token";
let root;
before(async () => {
  root = await mkdtemp(join(tmpdir(), "booth-api-"));
});
after(async () => {
  await rm(root, { recursive: true, force: true });
});

const lines = async (file) => (await readFile(file, "utf8")).split("\n").filter(Boolean);

describe("按场次存数据", () => {
  test("缺 EVENT_ID 拒绝启动", async () => {
    const r = await spawnServer({ ORDER_DATA_DIR: root, ADMIN_TOKEN: TOKEN });
    await r.stop?.();
    assert.ok(r.exitCode !== undefined && r.exitCode !== 0, "应当退出且退出码非 0");
    assert.match(r.stderr, /EVENT_ID/);
  });

  test("EVENT_ID 不合法时拒绝启动", async () => {
    const r = await spawnServer({ ORDER_DATA_DIR: root, ADMIN_TOKEN: TOKEN, EVENT_ID: "../etc" });
    await r.stop?.();
    assert.ok(r.exitCode !== undefined && r.exitCode !== 0);
  });

  test("EVENT_ID 决定数据目录，health 返回场次", async () => {
    for (const ev of ["ev-a", "ev-b"]) {
      const s = await spawnServer({ ORDER_DATA_DIR: root, ADMIN_TOKEN: TOKEN, EVENT_ID: ev });
      try {
        const health = await (await fetch(`${s.base}/api/health`)).json();
        assert.deepEqual(health, { ok: true, service: "hiro-booth-api", event: ev });
        assert.equal((await postOrder(s.base, order(`order-${ev}`))).status, 200);
      } finally {
        await s.stop();
      }
    }
    const a = await lines(join(root, "events", "ev-a", "orders.jsonl"));
    const b = await lines(join(root, "events", "ev-b", "orders.jsonl"));
    assert.deepEqual(a.map((l) => JSON.parse(l).id), ["order-ev-a"]);
    assert.deepEqual(b.map((l) => JSON.parse(l).id), ["order-ev-b"]);
  });
});

describe("订单与库存", () => {
  let s;
  before(async () => {
    s = await spawnServer({ ORDER_DATA_DIR: root, ADMIN_TOKEN: TOKEN, EVENT_ID: "ev-orders" });
  });
  after(async () => s.stop());

  const admin = (path, init = {}) =>
    fetch(`${s.base}/api/admin/${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    });

  test("同一订单号重复上传只记一次", async () => {
    const first = await postOrder(s.base, order("dup-1"));
    const second = await postOrder(s.base, order("dup-1"));
    assert.equal(first.body.duplicate, false);
    assert.equal(second.body.duplicate, true);
    const all = await lines(join(root, "events", "ev-orders", "orders.jsonl"));
    assert.equal(all.filter((l) => JSON.parse(l).id === "dup-1").length, 1);
  });

  test("下单扣库存，重复上传不重复扣", async () => {
    const set = await admin("stock", { method: "PATCH", body: JSON.stringify({ id: "eye-mask", stock: 5 }) });
    assert.equal(set.status, 200);
    const item = [{ id: "eye-mask", name: "眼罩", shop: "小広甜品铺", price: 25, qty: 2 }];
    const r1 = await postOrder(s.base, order("stock-1", item));
    await postOrder(s.base, order("stock-1", item));
    assert.equal(r1.body.stock.items["eye-mask"].stock, 3);
    const now = await (await fetch(`${s.base}/api/stock`)).json();
    assert.equal(now.items["eye-mask"].stock, 3);
  });

  test("不带管理口令访问 admin 接口返回 401", async () => {
    const res = await fetch(`${s.base}/api/admin/summary`);
    assert.equal(res.status, 401);
    const wrong = await fetch(`${s.base}/api/admin/summary`, { headers: { Authorization: "Bearer nope" } });
    assert.equal(wrong.status, 401);
  });
});
