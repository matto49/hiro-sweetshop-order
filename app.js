import {
  calculateCart,
  sanitizeCart,
  updateQuantity,
} from "./cart.mjs";
import { fetchStock, removeSoldOutFromCart } from "./stock.mjs";

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
    price: 20,
    image: "./assets/eye-mask.webp",
    alt: "筱泽广困倦眼神造型眼罩",
    badge: "新品",
  },
  {
    id: "rabbit-stand",
    category: "new",
    name: "兔兔小广大立牌",
    spec: "约 108 × 152 mm",
    price: 30,
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
    category: "new",
    character: "筱泽广",
    name: "摇摇车立牌 · 筱泽广",
    spec: "约 75 × 59 mm",
    price: 12,
    image: "./assets/ride-stand.webp",
    alt: "筱泽广现代舞造型摇摇车立牌",
    badge: "新品",
  },
  {
    id: "whisper-stand",
    category: "new",
    character: "仓本千奈 × 筱泽广",
    name: "悄悄话立牌 · 仓本千奈 × 筱泽广",
    spec: "约 75 × 59 mm · 双人款",
    price: 15,
    image: "./assets/whisper-stand.webp",
    alt: "仓本千奈与筱泽广坐在一起的悄悄话立牌",
    badge: "新品",
  },
  {
    id: "ktn-shikishi",
    category: "hiro",
    family: "shikishi",
    character: "藤田琴音",
    name: "琴音马卡龙中色纸",
    spec: "14 × 14 cm · 细闪",
    price: 15,
    image: "./assets/ktn-shikishi.webp",
    alt: "马卡龙主题藤田琴音细闪色纸",
  },
  {
    id: "ktn-badge",
    category: "hiro",
    family: "badge",
    character: "藤田琴音",
    name: "琴音马卡龙徽章",
    spec: "亮膜徽章",
    price: 8,
    image: "./assets/ktn-badge.webp",
    alt: "马卡龙主题藤田琴音亮膜徽章",
  },
];

const categories = [
  { id: "new", kicker: "TODAY'S SPECIAL", title: "本次新品", note: "本次摊宣的新面孔" },
  { id: "hiro", kicker: "HIRO SELECTION", title: "小广制品", note: "同一品类可按角色分别点单" },
];

const productFamilies = [
  { id: "spring-stand", title: "摇摇乐立牌", note: "65 × 46 mm · 可粘贴" },
  { id: "shikishi", title: "触感膜色纸", note: "流沙银边 · 14 × 14 cm" },
  { id: "pvc-card", title: "PVC 透卡", note: "86 × 54 mm · 彩白透卡" },
  { id: "badge", title: "双闪吧唧", note: "58 × 58 mm" },
  { id: "window-stand", title: "QQ 人彩窗立牌", note: "75 × 59 mm · CNC" },
];

const storageKey = "hiro-sweetshop-cart-v1";
const catalog = document.querySelector("#catalog");
const openCartButton = document.querySelector("#open-cart");
const stockNotice = document.querySelector("#stock-notice");

function loadCart() {
  try {
    return sanitizeCart(products, JSON.parse(localStorage.getItem(storageKey) || "{}"));
  } catch {
    return {};
  }
}

let cart = loadCart();
let soldOutIds = new Set();
let stockReady = false;
let stockNoticeTimer;

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
      <span class="sold-out-badge" hidden>售尽</span>
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

function render() {
  const summary = calculateCart(products, cart);
  document.querySelectorAll(".product-card").forEach((card) => {
    const quantity = cart[card.dataset.productId] || 0;
    const soldOut = soldOutIds.has(card.dataset.productId);
    const output = card.querySelector("output");
    const decreaseButton = card.querySelector('[data-action="decrease"]');
    const increaseButton = card.querySelector('[data-action="increase"]');
    const soldOutBadge = card.querySelector(".sold-out-badge");
    output.value = quantity;
    output.textContent = quantity;
    decreaseButton.disabled = quantity === 0;
    increaseButton.disabled = !stockReady || soldOut;
    soldOutBadge.hidden = !soldOut;
    card.dataset.soldOut = soldOut ? "true" : "false";
    card.dataset.selected = quantity > 0 ? "true" : "false";
  });

  document.querySelector("#cart-count").textContent = summary.count
    ? `已选 ${summary.count} 件制品`
    : "还没有选择制品";
  document.querySelector("#cart-total").textContent = summary.total;
  document.querySelector("#cart-badge").textContent = summary.count;
  document.querySelector("#cart-badge").hidden = summary.count === 0;
  const bagGiftCard = document.querySelector(".bag-gift-card");
  const bagGiftStatus = document.querySelector("#bag-gift-status");
  bagGiftCard.dataset.qualified = summary.gifts.bag ? "true" : "false";
  bagGiftStatus.textContent = summary.gifts.bag
    ? "已获得袋子无料 ✓"
    : `还差 ${summary.gifts.bagRemaining} 元获得`;
  document.querySelector("#cart-bar").dataset.empty = summary.count === 0 ? "true" : "false";
  openCartButton.disabled = summary.count === 0 || !stockReady;
  saveCart();
}

function changeQuantity(productId, delta) {
  if (!stockReady || (delta > 0 && soldOutIds.has(productId))) return;
  cart = updateQuantity(cart, productId, delta);
  render();
}

function showStockNotice(text, persistent = false) {
  window.clearTimeout(stockNoticeTimer);
  stockNotice.textContent = text;
  stockNotice.dataset.visible = "true";
  if (!persistent) {
    stockNoticeTimer = window.setTimeout(() => {
      stockNotice.dataset.visible = "false";
    }, 3200);
  }
}

async function syncStock() {
  try {
    const state = await fetchStock();
    soldOutIds = new Set(state.soldOut);
    const nextCart = removeSoldOutFromCart(cart, soldOutIds);
    const removedCount = Object.keys(cart).length - Object.keys(nextCart).length;
    cart = nextCart;
    stockReady = true;
    render();
    if (removedCount > 0) showStockNotice("售尽商品已从点单中移除。");
    else stockNotice.dataset.visible = "false";
  } catch {
    stockReady = false;
    render();
    showStockNotice("库存状态暂时无法同步，请刷新重试。", true);
  }
}

catalog.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const card = button.closest(".product-card");
  changeQuantity(card.dataset.productId, button.dataset.action === "increase" ? 1 : -1);
});

openCartButton.addEventListener("click", () => {
  window.location.href = "./checkout.html";
});

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
syncStock();
