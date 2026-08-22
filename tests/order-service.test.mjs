import test from "node:test";
import assert from "node:assert/strict";

import { OrderInputError, createOrderRecord, publicOrder } from "../server/order-service.mjs";

const basePayload = {
  requestId: "4c7c2f7a-e847-4a7e-908a-1cc431589a56",
  items: [{ id: "ai-book", quantity: 1 }],
  clientGiftEligibility: { bag: true, bagRemaining: 0 },
};

test("server calculates price and gift eligibility from product ids", () => {
  const record = createOrderRecord(
    { ...basePayload, total: 1, items: [{ id: "ktn-badge", quantity: 3 }] },
    new Date("2026-08-22T08:00:00.000Z"),
  );
  assert.equal(record.total, 24);
  assert.equal(record.count, 3);
  assert.equal(record.gifts.bag, true);
  assert.equal(record.gifts.ktnCardSelfPickup, true);
  assert.equal(record.gifts.bagRemaining, 0);
  assert.match(record.orderId, /^HRO-20260822-[A-F0-9]{8}$/);
});

test("server records client gift claim but keeps its own decision authoritative", () => {
  const record = createOrderRecord({
    ...basePayload,
    items: [{ id: "ktn-badge", quantity: 1 }],
    clientGiftEligibility: { bag: true, bagRemaining: 0 },
  });
  assert.equal(record.total, 8);
  assert.equal(record.gifts.bag, false);
  assert.equal(record.gifts.ktnCardSelfPickup, true);
  assert.equal(record.gifts.bagRemaining, 12);
  assert.equal(record.clientGiftEligibility.bag, true);
  assert.equal(record.giftEligibilityMatched, false);
  assert.equal(publicOrder(record).gifts.bag, false);
});

test("server includes the 20 yuan threshold", () => {
  const record = createOrderRecord({
    ...basePayload,
    items: [{ id: "pvc-hiro", quantity: 1 }, { id: "badge-hiro", quantity: 1 }],
  });
  assert.equal(record.total, 20);
  assert.equal(record.gifts.bag, true);
});

test("server rejects unknown products, duplicates and bad quantities", () => {
  assert.throws(
    () => createOrderRecord({ ...basePayload, items: [{ id: "unknown", quantity: 1 }] }),
    OrderInputError,
  );
  assert.throws(
    () => createOrderRecord({ ...basePayload, items: [{ id: "ai-book", quantity: 1 }, { id: "ai-book", quantity: 1 }] }),
    /不能重复/,
  );
  assert.throws(
    () => createOrderRecord({ ...basePayload, items: [{ id: "ai-book", quantity: 1.5 }] }),
    /1 到 99/,
  );
});

test("removed payment fields are ignored for stale clients", () => {
  const record = createOrderRecord({ ...basePayload, paymentMethod: "alipay" });
  assert.equal("paymentMethod" in record, false);
  assert.equal("paymentMethod" in publicOrder(record), false);
});

test("server rejects products currently marked sold out", () => {
  assert.throws(
    () => createOrderRecord(basePayload, new Date(), new Set(["ai-book"])),
    (error) => error instanceof OrderInputError && error.statusCode === 409 && /小广 AI 小课堂/.test(error.message),
  );
});
