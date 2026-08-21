import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateCart,
  clampQuantity,
  formatOrderText,
  sanitizeCart,
  setQuantity,
  updateQuantity,
} from "../cart.mjs";

const products = [
  { id: "book", name: "新刊", price: 25 },
  { id: "badge", name: "徽章", price: 8 },
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
  assert.deepEqual(setQuantity({}, "badge", 4), { badge: 4 });
});

test("cart totals count quantities and price correctly", () => {
  const summary = calculateCart(products, { book: 2, badge: 3 });
  assert.equal(summary.count, 5);
  assert.equal(summary.total, 74);
  assert.deepEqual(summary.items.map((item) => item.subtotal), [50, 24]);
});

test("stored cart discards unknown and invalid products", () => {
  assert.deepEqual(sanitizeCart(products, { book: 2, badge: -1, unknown: 6 }), { book: 2 });
  assert.deepEqual(sanitizeCart(products, null), {});
});

test("order text contains every line item, total and no-payment note", () => {
  const text = formatOrderText(calculateCart(products, { book: 2, badge: 1 }));
  assert.match(text, /新刊 × 2  50元/);
  assert.match(text, /徽章 × 1  8元/);
  assert.match(text, /共 3 件｜合计 58 元/);
  assert.match(text, /不含支付信息/);
});
