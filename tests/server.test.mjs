import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createOrderServer } from "../server/server.mjs";

test("order API persists one idempotent server-priced order", async (t) => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "hiro-order-api-"));
  const dataFile = join(tempDirectory, "orders.jsonl");
  const stockFile = join(tempDirectory, "stock.json");
  const server = await createOrderServer({
    dataFile,
    stockFile,
    adminToken: "test-admin-token",
    allowedOrigins: ["https://matto49.github.io"],
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(tempDirectory, { recursive: true, force: true });
  });

  const { port } = server.address();
  const payload = {
    requestId: "f93bbc2c-1745-4af5-8a59-e57d9eed3dca",
    items: [{ id: "pvc-hiro", quantity: 1 }, { id: "badge-hiro", quantity: 1 }],
    clientGiftEligibility: { bag: true, bagRemaining: 0 },
  };
  const submit = () =>
    fetch(`http://127.0.0.1:${port}/api/orders`, {
      method: "POST",
      headers: { Origin: "https://matto49.github.io", "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

  const stockBefore = await fetch(`http://127.0.0.1:${port}/api/stock`, {
    headers: { Origin: "https://matto49.github.io" },
  });
  assert.equal(stockBefore.status, 200);
  assert.deepEqual((await stockBefore.json()).soldOut, []);

  const unauthorized = await fetch(`http://127.0.0.1:${port}/api/admin/stock`, {
    method: "PATCH",
    headers: { Origin: "https://matto49.github.io", "Content-Type": "application/json" },
    body: JSON.stringify({ productId: "pvc-hiro", soldOut: true }),
  });
  assert.equal(unauthorized.status, 401);

  const markSoldOut = await fetch(`http://127.0.0.1:${port}/api/admin/stock`, {
    method: "PATCH",
    headers: {
      Origin: "https://matto49.github.io",
      Authorization: "Bearer test-admin-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ productId: "pvc-hiro", soldOut: true }),
  });
  assert.equal(markSoldOut.status, 200);
  assert.deepEqual((await markSoldOut.json()).soldOut, ["pvc-hiro"]);

  const soldOutOrder = await submit();
  assert.equal(soldOutOrder.status, 409);
  assert.match((await soldOutOrder.json()).message, /PVC 透卡/);

  const restore = await fetch(`http://127.0.0.1:${port}/api/admin/stock`, {
    method: "PATCH",
    headers: {
      Origin: "https://matto49.github.io",
      Authorization: "Bearer test-admin-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ productId: "pvc-hiro", soldOut: false }),
  });
  assert.equal(restore.status, 200);

  const first = await submit();
  assert.equal(first.status, 201);
  assert.equal(first.headers.get("access-control-allow-origin"), "https://matto49.github.io");
  const firstBody = await first.json();
  assert.equal(firstBody.total, 20);
  assert.equal(firstBody.gifts.bag, true);
  assert.equal(firstBody.idempotent, false);

  const second = await submit();
  assert.equal(second.status, 200);
  const secondBody = await second.json();
  assert.equal(secondBody.orderId, firstBody.orderId);
  assert.equal(secondBody.idempotent, true);

  const lines = (await readFile(dataFile, "utf8")).trim().split("\n");
  assert.equal(lines.length, 1);
});
