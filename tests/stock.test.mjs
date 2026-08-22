import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createStockStore, StockInputError } from "../server/stock-service.mjs";
import { normalizeStockState, removeSoldOutFromCart } from "../stock.mjs";

test("stock helpers normalize state and remove sold-out cart lines", () => {
  const state = normalizeStockState({ soldOut: ["pvc-hiro", "pvc-hiro", null], updatedAt: "2026-08-23T00:00:00.000Z" });
  assert.deepEqual(state.soldOut, ["pvc-hiro"]);
  assert.deepEqual(removeSoldOutFromCart({ "pvc-hiro": 2, "badge-hiro": 1 }, state.soldOut), { "badge-hiro": 1 });
});

test("stock store persists valid product state", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "hiro-stock-"));
  const filePath = join(directory, "stock.json");
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = await createStockStore(filePath);

  const updated = await store.update({ productId: "pvc-hiro", soldOut: true }, new Date("2026-08-23T01:00:00.000Z"));
  assert.deepEqual(updated.soldOut, ["pvc-hiro"]);
  assert.deepEqual(store.soldOutIds(), new Set(["pvc-hiro"]));
  assert.match(await readFile(filePath, "utf8"), /pvc-hiro/);

  const reloaded = await createStockStore(filePath);
  assert.deepEqual(reloaded.get(), updated);
  await assert.rejects(() => store.update({ productId: "unknown", soldOut: true }), StockInputError);
});
