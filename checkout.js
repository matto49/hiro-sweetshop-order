import { calculateCart, sanitizeCart, updateQuantity } from "./cart.mjs";
import { products } from "./catalog.mjs";

const API_BASE = "https://api.matto.top/hiro-order";
const storageKey = "hiro-sweetshop-cart-v1";
const requestKey = "hiro-sweetshop-order-request-v1";
const checkoutItems = document.querySelector("#checkout-items");
const checkoutGift = document.querySelector("#checkout-gift");
const checkoutBagGift = document.querySelector("#checkout-bag-gift");
const checkoutBagStatus = document.querySelector("#checkout-bag-status");
const checkoutCount = document.querySelector("#checkout-count");
const checkoutTotal = document.querySelector("#checkout-total");
const orderForm = document.querySelector("#order-form");
const submitButton = document.querySelector("#submit-order");
const orderResult = document.querySelector("#order-result");
const submitError = document.querySelector("#submit-error");
const paymentCodeNotice = document.querySelector("#payment-code-notice");

function loadCart() {
  try {
    return sanitizeCart(products, JSON.parse(localStorage.getItem(storageKey) || "{}"));
  } catch {
    return {};
  }
}

let cart = loadCart();
let submitting = false;

function saveCart() {
  localStorage.setItem(storageKey, JSON.stringify(cart));
}

function renderItems(summary) {
  if (!summary.items.length) {
    checkoutItems.innerHTML = `
      <div class="checkout-empty">
        <img src="./assets/owl.png" alt="" />
        <strong>点单票还是空的</strong>
        <p>先回商品页挑几件喜欢的制品吧。</p>
        <a href="./index.html">返回选购</a>
      </div>
    `;
    return;
  }

  checkoutItems.innerHTML = summary.items
    .map(
      (item) => `
        <article class="checkout-line" data-product-id="${item.id}">
          <img src="${item.image}" alt="${item.alt || ""}" />
          <div>
            <h3>${item.name}</h3>
            <p>${item.spec} · ${item.price} 元/件</p>
          </div>
          <div class="checkout-line-side">
            <strong>${item.subtotal} 元</strong>
            <div class="mini-stepper" aria-label="${item.name}数量">
              <button type="button" data-action="decrease" aria-label="减少一件${item.name}">−</button>
              <output>${item.quantity}</output>
              <button type="button" data-action="increase" aria-label="增加一件${item.name}">＋</button>
            </div>
          </div>
        </article>
      `,
    )
    .join("");
}

function render() {
  const summary = calculateCart(products, cart);
  renderItems(summary);
  checkoutCount.textContent = `${summary.count} 件`;
  checkoutTotal.textContent = summary.total;
  checkoutGift.hidden = summary.count === 0;
  checkoutBagGift.dataset.qualified = summary.gifts.bag ? "true" : "false";
  checkoutBagStatus.textContent = summary.gifts.bag
    ? "已获得袋子无料 ✓"
    : `还差 ${summary.gifts.bagRemaining} 元获得`;
  submitButton.disabled = summary.count === 0 || submitting;
  saveCart();
}

checkoutItems.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const line = button.closest("[data-product-id]");
  cart = updateQuantity(cart, line.dataset.productId, button.dataset.action === "increase" ? 1 : -1);
  orderResult.hidden = true;
  submitError.hidden = true;
  sessionStorage.removeItem(requestKey);
  render();
});

async function loadPaymentCodes() {
  let missingCode = false;
  await Promise.all(
    [...document.querySelectorAll(".payment-card img")].map(async (image) => {
      try {
        const response = await fetch(image.dataset.paymentSrc, { method: "HEAD", cache: "no-store" });
        if (!response.ok) throw new Error("missing payment code");
        image.src = image.dataset.paymentSrc;
      } catch {
        missingCode = true;
      }
    }),
  );
  paymentCodeNotice.hidden = !missingCode;
}

function cartFingerprint(summary, paymentMethod) {
  return JSON.stringify({
    paymentMethod,
    items: summary.items.map((item) => [item.id, item.quantity]),
  });
}

function getRequestId(fingerprint) {
  try {
    const existing = JSON.parse(sessionStorage.getItem(requestKey) || "null");
    if (existing?.fingerprint === fingerprint && existing?.requestId) return existing.requestId;
  } catch {
    // Create a fresh id below.
  }
  const requestId = crypto.randomUUID();
  sessionStorage.setItem(requestKey, JSON.stringify({ fingerprint, requestId }));
  return requestId;
}

function showError(message) {
  submitError.textContent = message;
  submitError.hidden = false;
}

orderForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const summary = calculateCart(products, cart);
  if (!summary.items.length || submitting) return;

  const paymentMethod = new FormData(orderForm).get("paymentMethod");
  if (!paymentMethod) {
    showError("请先选择支付宝或微信支付。");
    return;
  }

  const fingerprint = cartFingerprint(summary, paymentMethod);
  const requestId = getRequestId(fingerprint);
  submitting = true;
  submitError.hidden = true;
  orderResult.hidden = true;
  submitButton.disabled = true;
  submitButton.querySelector("span").textContent = "正在提交…";

  try {
    const response = await fetch(`${API_BASE}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId,
        paymentMethod,
        items: summary.items.map((item) => ({ id: item.id, quantity: item.quantity })),
        clientGiftEligibility: {
          bag: summary.gifts.bag,
          bagRemaining: summary.gifts.bagRemaining,
        },
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "订单提交失败，请稍后重试。");

    document.querySelector("#order-number").textContent = data.orderId;
    document.querySelector("#order-result-summary").textContent = `${data.count} 件 · ${data.total} 元`;
    checkoutBagGift.dataset.qualified = data.gifts.bag ? "true" : "false";
    checkoutBagStatus.textContent = data.gifts.bag
      ? "服务端确认：已获得袋子无料 ✓"
      : `服务端确认：还差 ${data.gifts.bagRemaining} 元获得`;
    orderResult.hidden = false;
    orderResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
    submitButton.querySelector("span").textContent = "订单已提交";
  } catch (error) {
    showError(error instanceof Error ? error.message : "订单提交失败，请稍后重试。");
    submitButton.querySelector("span").textContent = "重新提交";
  } finally {
    submitting = false;
    submitButton.disabled = calculateCart(products, cart).count === 0;
  }
});

render();
loadPaymentCodes();
