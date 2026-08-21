import {
  calculateCart,
  formatOrderText,
  sanitizeCart,
  updateQuantity,
} from "./cart.mjs";

export const products = [
  {
    id: "ai-book",
    category: "new",
    name: "小广 AI 小课堂",
    spec: "B5 · 72p 学术合刊",
    price: 25,
    image: "./assets/book.webp",
    alt: "小广 AI 小课堂新刊封面",
    badge: "新刊",
  },
  {
    id: "eye-mask",
    category: "new",
    name: "筱泽广眼罩",
    spec: "226 × 121 mm · 附蓝色收纳袋",
    price: 25,
    image: "./assets/eye-mask.webp",
    alt: "筱泽广困倦眼神造型眼罩",
    badge: "新品",
  },
  {
    id: "rabbit-stand",
    category: "new",
    name: "兔兔小广大立牌",
    spec: "约 108 × 152 mm",
    price: 25,
    image: "./assets/rabbit-stand.webp",
    alt: "抱着趴趴广的兔耳少女亚克力立牌",
    badge: "新品",
  },
  {
    id: "ride-stand",
    category: "hiro",
    name: "摇摇车立牌",
    spec: "约 75 × 59 mm",
    price: 12,
    image: "./assets/ride-stand.webp",
    alt: "现代舞造型摇摇车立牌",
  },
  {
    id: "whisper-stand",
    category: "hiro",
    name: "悄悄话立牌",
    spec: "约 75 × 59 mm",
    price: 15,
    image: "./assets/whisper-stand.webp",
    alt: "两位角色坐在一起的悄悄话立牌",
  },
  {
    id: "hiro-shikishi",
    category: "hiro",
    name: "触感膜色纸",
    spec: "流沙银边 · 14 × 14 cm",
    price: 15,
    image: "./assets/hiro-shikishi.webp",
    alt: "两款筱泽广与藤田琴音色纸",
  },
  {
    id: "pvc-card",
    category: "hiro",
    name: "PVC 透卡",
    spec: "86 × 54 mm · 彩白透卡",
    price: 8,
    image: "./assets/pvc-card.webp",
    alt: "两款角色 PVC 透明卡片",
  },
  {
    id: "badge",
    category: "hiro",
    name: "双闪吧唧",
    spec: "58 × 58 mm",
    price: 12,
    image: "./assets/badge.webp",
    alt: "两款圆形双闪徽章",
  },
  {
    id: "qq-window-stand",
    category: "hiro",
    name: "QQ 人彩窗立牌",
    spec: "75 × 59 mm · CNC",
    price: 18,
    image: "./assets/qq-window-stand.webp",
    alt: "五款 QQ 人彩窗亚克力立牌",
  },
  {
    id: "spring-stand",
    category: "hiro",
    name: "摇摇乐立牌",
    spec: "65 × 46 mm · 可粘贴",
    price: 15,
    image: "./assets/spring-stand.webp",
    alt: "四款带弹簧底座的摇摇乐立牌",
  },
  {
    id: "ktn-shikishi",
    category: "ktn",
    name: "琴音马卡龙中色纸",
    spec: "14 × 14 cm · 细闪",
    price: 15,
    image: "./assets/ktn-shikishi.webp",
    alt: "马卡龙主题藤田琴音细闪色纸",
    badge: "联动",
  },
  {
    id: "ktn-badge",
    category: "ktn",
    name: "琴音马卡龙徽章",
    spec: "亮膜徽章",
    price: 8,
    image: "./assets/ktn-badge.webp",
    alt: "马卡龙主题藤田琴音亮膜徽章",
    badge: "联动",
  },
];

const categories = [
  { id: "new", kicker: "TODAY'S SPECIAL", title: "本次新品", note: "本次摊宣的新面孔" },
  { id: "hiro", kicker: "HIRO SELECTION", title: "小广制品", note: "纸品、透卡与会摇晃的 QQ 人" },
  { id: "ktn", kicker: "GUEST SHELF", title: "KTN 联动", note: "長山香奈老师的马卡龙小甜品" },
];

const storageKey = "hiro-sweetshop-cart-v1";
const catalog = document.querySelector("#catalog");
const cartDialog = document.querySelector("#cart-dialog");
const cartItems = document.querySelector("#cart-items");
const openCartButton = document.querySelector("#open-cart");
const closeCartButton = document.querySelector("#close-cart");
const clearCartButton = document.querySelector("#clear-cart");
const copyOrderButton = document.querySelector("#copy-order");
const toast = document.querySelector("#toast");
let clearConfirmationTimer;
let toastTimer;

function loadCart() {
  try {
    return sanitizeCart(products, JSON.parse(localStorage.getItem(storageKey) || "{}"));
  } catch {
    return {};
  }
}

let cart = loadCart();

function saveCart() {
  localStorage.setItem(storageKey, JSON.stringify(cart));
}

function createProductCard(product) {
  const article = document.createElement("article");
  article.className = "product-card";
  article.dataset.productId = product.id;
  article.innerHTML = `
    <div class="product-image-wrap">
      <img src="${product.image}" alt="${product.alt}" loading="lazy" />
      ${product.badge ? `<span class="product-badge">${product.badge}</span>` : ""}
    </div>
    <div class="product-copy">
      <div class="product-title-row">
        <div>
          <h3>${product.name}</h3>
          <p>${product.spec}</p>
        </div>
        <strong class="product-price" aria-label="${product.price} 元">${product.price}</strong>
      </div>
      <div class="quantity-control" aria-label="${product.name}数量">
        <button type="button" data-action="decrease" aria-label="减少一件${product.name}">−</button>
        <output aria-live="polite" aria-label="当前数量">0</output>
        <button type="button" data-action="increase" aria-label="增加一件${product.name}">＋</button>
      </div>
    </div>
  `;
  return article;
}

function renderCatalog() {
  const fragment = document.createDocumentFragment();
  categories.forEach((category) => {
    const section = document.createElement("section");
    section.id = category.id;
    section.className = "product-section section-anchor";
    section.setAttribute("aria-labelledby", `${category.id}-title`);
    section.innerHTML = `
      <div class="section-heading">
        <div>
          <p class="section-kicker">${category.kicker}</p>
          <h2 id="${category.id}-title">${category.title}</h2>
        </div>
        <p>${category.note}</p>
      </div>
      <div class="product-grid"></div>
    `;
    const grid = section.querySelector(".product-grid");
    products.filter((product) => product.category === category.id).forEach((product) => {
      grid.append(createProductCard(product));
    });
    fragment.append(section);
  });
  catalog.replaceChildren(fragment);
}

function renderCartItems(summary) {
  if (!summary.items.length) {
    cartItems.innerHTML = `
      <div class="empty-cart">
        <img src="./assets/owl.png" alt="" />
        <strong>点单票还是空的</strong>
        <p>先去挑几件喜欢的制品吧。</p>
      </div>
    `;
    return;
  }

  cartItems.innerHTML = summary.items
    .map(
      (item) => `
        <article class="cart-line" data-cart-product-id="${item.id}">
          <img src="${item.image}" alt="" />
          <div class="cart-line-copy">
            <h3>${item.name}</h3>
            <p>${item.price} × ${item.quantity}</p>
          </div>
          <div class="cart-line-actions">
            <strong>${item.subtotal}</strong>
            <div class="mini-stepper" aria-label="${item.name}数量">
              <button type="button" data-cart-action="decrease" aria-label="减少一件${item.name}">−</button>
              <output>${item.quantity}</output>
              <button type="button" data-cart-action="increase" aria-label="增加一件${item.name}">＋</button>
            </div>
          </div>
        </article>
      `,
    )
    .join("");
}

function render() {
  const summary = calculateCart(products, cart);
  document.querySelectorAll(".product-card").forEach((card) => {
    const quantity = cart[card.dataset.productId] || 0;
    const output = card.querySelector("output");
    const decreaseButton = card.querySelector('[data-action="decrease"]');
    output.value = quantity;
    output.textContent = quantity;
    decreaseButton.disabled = quantity === 0;
    card.dataset.selected = quantity > 0 ? "true" : "false";
  });

  document.querySelector("#cart-count").textContent = summary.count
    ? `已选 ${summary.count} 件制品`
    : "还没有选择制品";
  document.querySelector("#cart-total").textContent = summary.total;
  document.querySelector("#dialog-count").textContent = summary.count;
  document.querySelector("#dialog-total").textContent = summary.total;
  document.querySelector("#cart-badge").textContent = summary.count;
  document.querySelector("#cart-badge").hidden = summary.count === 0;
  document.querySelector("#cart-gift").hidden = summary.count === 0;
  document.querySelector("#cart-bar").dataset.empty = summary.count === 0 ? "true" : "false";
  openCartButton.disabled = summary.count === 0;
  copyOrderButton.disabled = summary.count === 0;
  clearCartButton.disabled = summary.count === 0;
  renderCartItems(summary);
  saveCart();
}

function changeQuantity(productId, delta) {
  cart = updateQuantity(cart, productId, delta);
  render();
}

catalog.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const card = button.closest(".product-card");
  changeQuantity(card.dataset.productId, button.dataset.action === "increase" ? 1 : -1);
});

cartItems.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-cart-action]");
  if (!button) return;
  const line = button.closest("[data-cart-product-id]");
  changeQuantity(line.dataset.cartProductId, button.dataset.cartAction === "increase" ? 1 : -1);
});

openCartButton.addEventListener("click", () => {
  render();
  cartDialog.showModal();
  document.body.classList.add("dialog-open");
});

function closeCart() {
  cartDialog.close();
  document.body.classList.remove("dialog-open");
}

closeCartButton.addEventListener("click", closeCart);
cartDialog.addEventListener("click", (event) => {
  if (event.target === cartDialog) closeCart();
});
cartDialog.addEventListener("close", () => document.body.classList.remove("dialog-open"));

clearCartButton.addEventListener("click", () => {
  if (clearCartButton.dataset.confirm !== "true") {
    clearCartButton.dataset.confirm = "true";
    clearCartButton.textContent = "再点一次清空";
    clearConfirmationTimer = window.setTimeout(() => {
      clearCartButton.dataset.confirm = "false";
      clearCartButton.textContent = "清空";
    }, 3000);
    return;
  }

  window.clearTimeout(clearConfirmationTimer);
  cart = {};
  clearCartButton.dataset.confirm = "false";
  clearCartButton.textContent = "清空";
  render();
  closeCart();
  showToast("点单票已清空");
});

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

copyOrderButton.addEventListener("click", async () => {
  const summary = calculateCart(products, cart);
  if (!summary.items.length) return;
  try {
    await copyText(formatOrderText(summary));
    copyOrderButton.textContent = "已复制 ✓";
    showToast("点单清单已复制，可以发给摊主或现场出示");
    window.setTimeout(() => (copyOrderButton.textContent = "复制点单清单"), 1800);
  } catch {
    showToast("复制失败，请截图保存点单票");
  }
});

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.dataset.visible = "true";
  toastTimer = window.setTimeout(() => {
    toast.dataset.visible = "false";
  }, 2600);
}

renderCatalog();

const navLinks = [...document.querySelectorAll("[data-category-link]")];
const observedSections = [...document.querySelectorAll(".section-anchor")];
const observer = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    navLinks.forEach((link) => {
      const active = link.dataset.categoryLink === visible.target.id;
      link.dataset.active = active ? "true" : "false";
      if (active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  },
  { rootMargin: "-18% 0px -68%", threshold: [0, 0.1, 0.3] },
);
observedSections.forEach((section) => observer.observe(section));

// The catalog must exist before the first render updates its steppers.
render();
