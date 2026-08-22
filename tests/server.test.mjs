import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createOrderServer } from "../server/server.mjs";

test("order API persists one idempotent server-priced order", async (t) => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "hiro-order-api-"));
  const dataFile = join(tempDirectory, "orders.jsonl");
  const server = await createOrderServer({ dataFile, allowedOrigins: ["https://matto49.github.io"] });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(tempDirectory, { recursive: true, force: true });
  });

  const { port } = server.address();
  const payload = {
    requestId: "f93bbc2c-1745-4af5-8a59-e57d9eed3dca",
    paymentMethod: "wechat",
    items: [{ id: "pvc-hiro", quantity: 1 }, { id: "badge-hiro", quantity: 1 }],
    clientGiftEligibility: { bag: true, bagRemaining: 0 },
  };
  const submit = () =>
    fetch(`http://127.0.0.1:${port}/api/orders`, {
      method: "POST",
      headers: { Origin: "https://matto49.github.io", "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

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
