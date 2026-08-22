import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateCart,
  calculateGiftEligibility,
  clampQuantity,
  formatOrderText,
  sanitizeCart,
  setQuantity,
  updateQuantity,
} from "../cart.mjs";

const products = [
  { id: "book", name: "新刊", price: 25 },
  { id: "badge-kotone", name: "双闪吧唧 · 藤田琴音", price: 12 },
  { id: "badge-hiro", name: "双闪吧唧 · 筱泽广", price: 12 },
];

test("quantity is always an integer between zero and 99", () => {
  assert.equal(clampQuantity(-2), 0);
  assert.equal(clampQuantity("3"), 3);
  assert.equal(clampQuantity(120), 99);
  assert.equal(clampQuantity("not-a-number"), 0);
});

test("updating quantity adds and removes cart keys", () => {
  let cart = updateQuantity({}, "book", 1);
  assert.deepEqual(cart, { book: 1 });
  cart = updateQuantity(cart, "book", -1);
  assert.deepEqual(cart, {});
  assert.deepEqual(setQuantity({}, "badge-kotone", 4), { "badge-kotone": 4 });
});

test("cart totals count quantities and price correctly", () => {
  const summary = calculateCart(products, { book: 2, "badge-kotone": 3 });
  assert.equal(summary.count, 5);
  assert.equal(summary.total, 86);
  assert.deepEqual(summary.items.map((item) => item.subtotal), [50, 36]);
});

test("stored cart discards unknown and invalid products", () => {
  assert.deepEqual(sanitizeCart(products, { book: 2, "badge-kotone": -1, unknown: 6 }), { book: 2 });
  assert.deepEqual(sanitizeCart(products, null), {});
});

test("order text contains every line item, total and no-payment note", () => {
  const text = formatOrderText(calculateCart(products, { book: 2, "badge-kotone": 1 }));
  assert.match(text, /新刊 × 2  50元/);
  assert.match(text, /双闪吧唧 · 藤田琴音 × 1  12元/);
  assert.match(text, /共 3 件｜合计 62 元/);
  assert.match(text, /不含支付信息/);
});

test("different character variants stay as separate order lines", () => {
  const summary = calculateCart(products, { "badge-kotone": 1, "badge-hiro": 2 });
  assert.deepEqual(summary.items.map((item) => item.name), [
    "双闪吧唧 · 藤田琴音",
    "双闪吧唧 · 筱泽广",
  ]);
  assert.equal(summary.total, 36);
  const text = formatOrderText(summary);
  assert.match(text, /藤田琴音 × 1/);
  assert.match(text, /筱泽广 × 2/);
});

test("bag gift qualification includes exactly 20 yuan", () => {
  assert.deepEqual(calculateGiftEligibility(19), {
    ktnCard: true,
    bag: false,
    bagRemaining: 1,
  });
  assert.deepEqual(calculateGiftEligibility(20), {
    ktnCard: true,
    bag: true,
    bagRemaining: 0,
  });
  const summary = calculateCart(products, { book: 1 });
  assert.equal(summary.gifts.bag, true);
  assert.match(formatOrderText(summary), /小広甜品铺袋子无料/);
  assert.match(formatOrderText(summary), /已获得/);
});
