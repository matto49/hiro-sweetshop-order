export const MAX_QUANTITY = 99;
export const BAG_GIFT_THRESHOLD = 20;

export function clampQuantity(value) {
  const numeric = Number.parseInt(value, 10);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(MAX_QUANTITY, Math.max(0, numeric));
}

export function updateQuantity(cart, productId, delta) {
  const next = { ...cart };
  const quantity = clampQuantity((next[productId] || 0) + delta);
  if (quantity === 0) delete next[productId];
  else next[productId] = quantity;
  return next;
}

export function setQuantity(cart, productId, quantity) {
  const next = { ...cart };
  const normalized = clampQuantity(quantity);
  if (normalized === 0) delete next[productId];
  else next[productId] = normalized;
  return next;
}

export function calculateCart(products, cart) {
  const summary = products.reduce(
    (summary, product) => {
      const quantity = clampQuantity(cart[product.id] || 0);
      if (!quantity) return summary;
      const subtotal = product.price * quantity;
      summary.items.push({ ...product, quantity, subtotal });
      summary.count += quantity;
      summary.total += subtotal;
      return summary;
    },
    { items: [], count: 0, total: 0 },
  );
  summary.gifts = calculateGiftEligibility(summary.total);
  return summary;
}

export function calculateGiftEligibility(total) {
  const normalizedTotal = Number.isFinite(total) ? Math.max(0, total) : 0;
  return {
    ktnCard: normalizedTotal > 0,
    bag: normalizedTotal >= BAG_GIFT_THRESHOLD,
    bagRemaining: Math.max(0, BAG_GIFT_THRESHOLD - normalizedTotal),
  };
}

export function sanitizeCart(products, storedCart) {
  if (!storedCart || typeof storedCart !== "object" || Array.isArray(storedCart)) return {};
  const validIds = new Set(products.map((product) => product.id));
  return Object.fromEntries(
    Object.entries(storedCart)
      .filter(([id]) => validIds.has(id))
      .map(([id, quantity]) => [id, clampQuantity(quantity)])
      .filter(([, quantity]) => quantity > 0),
  );
}

export function formatOrderText(summary) {
  if (!summary.items.length) return "";
  const lines = ["小広甜品铺｜IFE02 F-3 点单", ""];
  summary.items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.name} × ${item.quantity}  ${item.subtotal}元`);
  });
  lines.push("", `共 ${summary.count} 件｜合计 ${summary.total} 元`);
  lines.push("赠品：KTN 10cm 方卡（任意消费赠，数量以现场为准）");
  lines.push(
    summary.gifts?.bag
      ? "赠品：小広甜品铺袋子无料（满 20 元赠，已获得）"
      : `袋子无料：还差 ${summary.gifts?.bagRemaining ?? BAG_GIFT_THRESHOLD} 元获得`,
  );
  lines.push("", "此清单不含支付信息，请在摊位现场确认。");
  return lines.join("\n");
}
