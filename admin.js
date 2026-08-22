import { products } from "./catalog.mjs";
import { STOCK_API_BASE, normalizeStockState } from "./stock.mjs";

const tokenKey = "hiro-sweetshop-admin-token-v1";
const authForm = document.querySelector("#admin-auth-form");
const tokenInput = document.querySelector("#admin-token");
const productsContainer = document.querySelector("#admin-products");
const updatedLabel = document.querySelector("#stock-updated");
const message = document.querySelector("#admin-message");

let token = sessionStorage.getItem(tokenKey) || "";
let stock = normalizeStockState(null);
let pendingProductId = null;
tokenInput.value = token;

function showMessage(text) {
  message.textContent = text;
  message.hidden = false;
  window.clearTimeout(showMessage.timeoutId);
  showMessage.timeoutId = window.setTimeout(() => {
    message.hidden = true;
  }, 3200);
}

function render() {
  const soldOutIds = new Set(stock.soldOut);
  productsContainer.innerHTML = products
    .map((product) => {
      const soldOut = soldOutIds.has(product.id);
      return `
        <article class="admin-product" data-product-id="${product.id}" data-sold-out="${soldOut}">
          <img src="${product.image}" alt="" />
          <div>
            <h3>${product.name}</h3>
            <p>${product.spec} · ${product.price} 元 · ${soldOut ? "已售尽" : "售卖中"}</p>
          </div>
          <button class="stock-toggle" type="button" data-sold-out="${soldOut}" ${pendingProductId === product.id ? "disabled" : ""}>
            ${soldOut ? "恢复售卖" : "标记售尽"}
          </button>
        </article>
      `;
    })
    .join("");
  updatedLabel.textContent = stock.updatedAt
    ? `最近更新：${new Date(stock.updatedAt).toLocaleString("zh-CN")}`
    : "尚未调整库存";
}

async function loadStock() {
  const response = await fetch(`${STOCK_API_BASE}/api/stock`, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "库存读取失败。");
  stock = normalizeStockState(data);
  render();
}

authForm.addEventListener("submit", (event) => {
  event.preventDefault();
  token = tokenInput.value.trim();
  sessionStorage.setItem(tokenKey, token);
  showMessage(token ? "管理口令已在当前标签页启用。" : "请输入管理口令。");
});

productsContainer.addEventListener("click", async (event) => {
  const button = event.target.closest(".stock-toggle");
  if (!button || pendingProductId) return;
  if (!token) {
    tokenInput.focus();
    showMessage("请先输入管理口令并连接。");
    return;
  }

  const card = button.closest("[data-product-id]");
  const productId = card.dataset.productId;
  const soldOut = button.dataset.soldOut !== "true";
  pendingProductId = productId;
  render();
  try {
    const response = await fetch(`${STOCK_API_BASE}/api/admin/stock`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ productId, soldOut }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "库存更新失败。");
    stock = normalizeStockState(data);
    showMessage(soldOut ? "已标记售尽。" : "已恢复售卖。" );
  } catch (error) {
    showMessage(error instanceof Error ? error.message : "库存更新失败。");
  } finally {
    pendingProductId = null;
    render();
  }
});

render();
loadStock().catch((error) => {
  updatedLabel.textContent = "库存读取失败";
  showMessage(error instanceof Error ? error.message : "库存读取失败。");
});
