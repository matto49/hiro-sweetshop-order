export const STOCK_API_BASE = "https://api.matto.top/hiro-order";

export function normalizeStockState(value) {
  const soldOut = Array.isArray(value?.soldOut)
    ? [...new Set(value.soldOut.filter((id) => typeof id === "string"))]
    : [];
  return {
    soldOut,
    updatedAt: typeof value?.updatedAt === "string" ? value.updatedAt : null,
  };
}

export async function fetchStock(fetchImpl = fetch) {
  const response = await fetchImpl(`${STOCK_API_BASE}/api/stock`, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "库存状态暂时无法同步。");
  return normalizeStockState(data);
}

export function removeSoldOutFromCart(cart, soldOut) {
  const soldOutIds = soldOut instanceof Set ? soldOut : new Set(soldOut);
  return Object.fromEntries(Object.entries(cart).filter(([id]) => !soldOutIds.has(id)));
}
