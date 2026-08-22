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
    id: "shikishi-kotone",
    category: "hiro",
    family: "shikishi",
    character: "藤田琴音",
    name: "触感膜色纸 · 藤田琴音",
    spec: "流沙银边 · 14 × 14 cm",
    price: 15,
    image: "./assets/shikishi-kotone.webp",
    alt: "藤田琴音款触感膜色纸",
  },
  {
    id: "shikishi-hiro",
    category: "hiro",
    family: "shikishi",
    character: "筱泽广",
    name: "触感膜色纸 · 筱泽广",
    spec: "流沙银边 · 14 × 14 cm",
    price: 15,
    image: "./assets/shikishi-hiro.webp",
    alt: "筱泽广款触感膜色纸",
  },
  {
    id: "pvc-kotone",
    category: "hiro",
    family: "pvc-card",
    character: "藤田琴音",
    name: "PVC 透卡 · 藤田琴音",
    spec: "86 × 54 mm · 彩白透卡",
    price: 8,
    image: "./assets/pvc-kotone.webp",
    alt: "藤田琴音款 PVC 透明卡片",
  },
  {
    id: "pvc-hiro",
    category: "hiro",
    family: "pvc-card",
    character: "筱泽广",
    name: "PVC 透卡 · 筱泽广",
    spec: "86 × 54 mm · 彩白透卡",
    price: 8,
    image: "./assets/pvc-hiro.webp",
    alt: "筱泽广款 PVC 透明卡片",
  },
  {
    id: "badge-kotone",
    category: "hiro",
    family: "badge",
    character: "藤田琴音",
    name: "双闪吧唧 · 藤田琴音",
    spec: "58 × 58 mm",
    price: 12,
    image: "./assets/badge-kotone.webp",
    alt: "藤田琴音款圆形双闪徽章",
  },
  {
    id: "badge-hiro",
    category: "hiro",
    family: "badge",
    character: "筱泽广",
    name: "双闪吧唧 · 筱泽广",
    spec: "58 × 58 mm",
    price: 12,
    image: "./assets/badge-hiro.webp",
    alt: "筱泽广款圆形双闪徽章",
  },
  {
    id: "window-hiro",
    category: "hiro",
    family: "window-stand",
    character: "筱泽广",
    name: "QQ 人彩窗立牌 · 筱泽广",
    spec: "75 × 59 mm · CNC",
    price: 18,
    image: "./assets/window-hiro.webp",
    alt: "筱泽广款 QQ 人彩窗亚克力立牌",
  },
  {
    id: "window-china",
    category: "hiro",
    family: "window-stand",
    character: "仓本千奈",
    name: "QQ 人彩窗立牌 · 仓本千奈",
    spec: "75 × 59 mm · CNC",
    price: 18,
    image: "./assets/window-china.webp",
    alt: "仓本千奈款 QQ 人彩窗亚克力立牌",
  },
  {
    id: "window-kotone",
    category: "hiro",
    family: "window-stand",
    character: "藤田琴音",
    name: "QQ 人彩窗立牌 · 藤田琴音",
    spec: "75 × 59 mm · CNC",
    price: 18,
    image: "./assets/window-kotone.webp",
    alt: "藤田琴音款 QQ 人彩窗亚克力立牌",
  },
  {
    id: "window-misuzu",
    category: "hiro",
    family: "window-stand",
    character: "秦谷美铃",
    name: "QQ 人彩窗立牌 · 秦谷美铃",
    spec: "75 × 59 mm · CNC",
    price: 18,
    image: "./assets/window-misuzu.webp",
    alt: "秦谷美铃款 QQ 人彩窗亚克力立牌",
  },
  {
    id: "window-lilja",
    category: "hiro",
    family: "window-stand",
    character: "葛城莉莉娅",
    name: "QQ 人彩窗立牌 · 葛城莉莉娅",
    spec: "75 × 59 mm · CNC",
    price: 18,
    image: "./assets/window-lilja.webp",
    alt: "葛城莉莉娅款 QQ 人彩窗亚克力立牌",
  },
  {
    id: "spring-misuzu",
    category: "hiro",
    family: "spring-stand",
    character: "秦谷美铃",
    name: "摇摇乐立牌 · 秦谷美铃",
    spec: "65 × 46 mm · 可粘贴",
    price: 15,
    image: "./assets/spring-misuzu.webp",
    alt: "秦谷美铃款带弹簧底座的摇摇乐立牌",
  },
  {
    id: "spring-hiro",
    category: "hiro",
    family: "spring-stand",
    character: "筱泽广",
    name: "摇摇乐立牌 · 筱泽广",
    spec: "65 × 46 mm · 可粘贴",
    price: 15,
    image: "./assets/spring-hiro.webp",
    alt: "筱泽广款带弹簧底座的摇摇乐立牌",
  },
  {
    id: "spring-kotone",
    category: "hiro",
    family: "spring-stand",
    character: "藤田琴音",
    name: "摇摇乐立牌 · 藤田琴音",
    spec: "65 × 46 mm · 可粘贴",
    price: 15,
    image: "./assets/spring-kotone.webp",
    alt: "藤田琴音款带弹簧底座的摇摇乐立牌",
  },
  {
    id: "spring-lilja",
    category: "hiro",
    family: "spring-stand",
    character: "葛城莉莉娅",
    name: "摇摇乐立牌 · 葛城莉莉娅",
    spec: "65 × 46 mm · 可粘贴",
    price: 15,
    image: "./assets/spring-lilja.webp",
    alt: "葛城莉莉娅款带弹簧底座的摇摇乐立牌",
  },
  {
    id: "ride-stand",
    category: "hiro",
    family: "ride-stand",
    character: "筱泽广",
    name: "摇摇车立牌 · 筱泽广",
    spec: "约 75 × 59 mm",
    price: 12,
    image: "./assets/ride-stand.webp",
    alt: "筱泽广现代舞造型摇摇车立牌",
  },
  {
    id: "whisper-stand",
    category: "hiro",
    family: "whisper-stand",
    character: "仓本千奈 × 筱泽广",
    name: "悄悄话立牌 · 仓本千奈 × 筱泽广",
    spec: "约 75 × 59 mm · 双人款",
    price: 15,
    image: "./assets/whisper-stand.webp",
    alt: "仓本千奈与筱泽广坐在一起的悄悄话立牌",
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
  { id: "hiro", kicker: "HIRO SELECTION", title: "小广制品", note: "同一品类可按角色分别点单" },
  { id: "ktn", kicker: "GUEST SHELF", title: "KTN 联动", note: "長山香奈老师的马卡龙小甜品" },
];

const productFamilies = [
  { id: "shikishi", title: "触感膜色纸", note: "流沙银边 · 14 × 14 cm" },
  { id: "pvc-card", title: "PVC 透卡", note: "86 × 54 mm · 彩白透卡" },
  { id: "badge", title: "双闪吧唧", note: "58 × 58 mm" },
  { id: "window-stand", title: "QQ 人彩窗立牌", note: "75 × 59 mm · CNC" },
  { id: "spring-stand", title: "摇摇乐立牌", note: "65 × 46 mm · 可粘贴" },
  { id: "ride-stand", title: "摇摇车立牌", note: "约 75 × 59 mm" },
  { id: "whisper-stand", title: "悄悄话立牌", note: "约 75 × 59 mm · 双人款" },
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
          <h3>${product.character || product.name}</h3>
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
    const categoryProducts = products.filter((product) => product.category === category.id);
    if (category.id === "hiro") {
      grid.remove();
      productFamilies.forEach((family) => {
        const familyProducts = categoryProducts.filter((product) => product.family === family.id);
        if (!familyProducts.length) return;
        const familySection = document.createElement("section");
        familySection.className = "product-family";
        familySection.setAttribute("aria-labelledby", `family-${family.id}`);
        familySection.innerHTML = `
          <div class="family-heading">
            <div>
              <h3 id="family-${family.id}">${family.title}</h3>
              <p>${family.note}</p>
            </div>
            <span>${familyProducts.length === 1 ? "1 款" : `${familyProducts.length} 款角色`}</span>
          </div>
          <div class="product-grid variant-grid"></div>
        `;
        const familyGrid = familySection.querySelector(".variant-grid");
        familyProducts.forEach((product) => familyGrid.append(createProductCard(product)));
        section.append(familySection);
      });
    } else {
      categoryProducts.forEach((product) => grid.append(createProductCard(product)));
    }
    fragment.append(section);
  });
  catalog.replaceChildren(fragment);
  categories.forEach((category) => {
    const count = document.querySelector(`[data-category-count="${category.id}"]`);
    if (count) count.textContent = products.filter((product) => product.category === category.id).length;
  });
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
