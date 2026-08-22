import { randomBytes } from "node:crypto";

import { calculateCart, clampQuantity } from "../cart.mjs";
import { products } from "../catalog.mjs";

const paymentMethods = new Set(["alipay", "wechat"]);
const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const productIds = new Set(products.map((product) => product.id));

export class OrderInputError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "OrderInputError";
    this.statusCode = statusCode;
  }
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new OrderInputError("订单里没有计价商品。");
  }
  if (items.length > products.length) {
    throw new OrderInputError("订单商品种类超过限制。");
  }

  const cart = {};
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new OrderInputError("订单商品格式不正确。");
    }
    if (typeof item.id !== "string" || !productIds.has(item.id)) {
      throw new OrderInputError("订单包含不存在的商品。");
    }
    if (!Number.isInteger(item.quantity) || clampQuantity(item.quantity) !== item.quantity || item.quantity < 1) {
      throw new OrderInputError("商品数量必须是 1 到 99 的整数。");
    }
    if (cart[item.id]) throw new OrderInputError("同一商品不能重复提交。");
    cart[item.id] = item.quantity;
  }
  return cart;
}

function normalizeClientGiftEligibility(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    bag: value.bag === true,
    bagRemaining: Number.isFinite(value.bagRemaining) ? Math.max(0, Math.trunc(value.bagRemaining)) : null,
  };
}

function createOrderId(now) {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  return `HRO-${date}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export function createOrderRecord(payload, now = new Date()) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new OrderInputError("请求格式不正确。");
  }
  if (typeof payload.requestId !== "string" || !requestIdPattern.test(payload.requestId)) {
    throw new OrderInputError("订单请求编号格式不正确。");
  }
  if (!paymentMethods.has(payload.paymentMethod)) {
    throw new OrderInputError("请选择支付宝或微信支付。");
  }

  const cart = normalizeItems(payload.items);
  const summary = calculateCart(products, cart);
  const clientGiftEligibility = normalizeClientGiftEligibility(payload.clientGiftEligibility);

  return {
    orderId: createOrderId(now),
    requestId: payload.requestId,
    createdAt: now.toISOString(),
    paymentMethod: payload.paymentMethod,
    status: "submitted",
    count: summary.count,
    total: summary.total,
    items: summary.items.map(({ id, name, price, quantity, subtotal }) => ({
      id,
      name,
      price,
      quantity,
      subtotal,
    })),
    gifts: summary.gifts,
    clientGiftEligibility,
    giftEligibilityMatched:
      clientGiftEligibility === null ||
      (clientGiftEligibility.bag === summary.gifts.bag &&
        clientGiftEligibility.bagRemaining === summary.gifts.bagRemaining),
  };
}

export function publicOrder(record, idempotent = false) {
  return {
    orderId: record.orderId,
    createdAt: record.createdAt,
    paymentMethod: record.paymentMethod,
    status: record.status,
    count: record.count,
    total: record.total,
    items: record.items,
    gifts: record.gifts,
    giftEligibilityMatched: record.giftEligibilityMatched,
    idempotent,
  };
}
