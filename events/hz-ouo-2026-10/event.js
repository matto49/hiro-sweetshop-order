// 杭偶O（2026-10-24）现场商品。当时的商品表没有留底，这份是 2026-11-25 事后补的：
// 以南京偶O 的商品表为底，按 10-24 的订单核对过商品 id、名称和价格（见 tests/events.test.mjs）。
// 与南京偶O 的差别：色纸当时只有一款，菜单上叫「触感膜色纸」，商品 id 是 shikishi-kotone。
// group：同一 group 的款式在菜单里合并成一组，组标题显示一次名称/规格/价格。

export const event = {
  id: "hz-ouo-2026-10",
  name: "杭偶O",
  city: "杭州",
  booth: "A12",
  date: "2026-10-24",
};

export const shops = [
  {
    id: "sweet",
    name: "小広甜品铺",
    tab: "小広甜品铺",
    theme: "sweet",
    groups: [
      {
        id: "featured",
        title: "新刊与大件",
        items: [
          { id: "book", name: "新刊", spec: "B5 · 72p 学术合刊", price: 30, image: "assets/book.webp" },
          { id: "eye-mask", name: "眼罩", spec: "226 × 121 mm", price: 25, image: "assets/eye-mask.webp" },
          { id: "rabbit-stand", name: "兔兔小广大立牌", spec: "约 108 × 152 mm", price: 30, image: "assets/rabbit-stand.webp" },
          { id: "whisper-stand", name: "悄悄话立牌", spec: "约 75 × 59 mm", price: 15, image: "assets/whisper-stand.webp" },
        ],
      },
      {
        id: "paper",
        title: "触感膜色纸",
        items: [
          { id: "shikishi-kotone", name: "触感膜色纸", spec: "流沙银边 · 14 × 14 cm", price: 15, image: "assets/shikishi-kotone.webp" },
        ],
      },
      {
        id: "pvc",
        title: "PVC 透卡",
        spec: "86 × 54 mm · 彩白透卡",
        price: 8,
        variants: true,
        items: [
          { id: "pvc-hiro", name: "筱澤广", image: "assets/pvc-hiro.webp" },
          { id: "pvc-kotone", name: "藤田琴音", image: "assets/pvc-kotone.webp" },
        ],
      },
      {
        id: "badge",
        title: "双闪吧唧",
        items: [
          { id: "badge-kotone", name: "双闪吧唧", spec: "58 × 58 mm", price: 12, image: "assets/badge-kotone.webp" },
        ],
      },
      {
        id: "window",
        title: "QQ 人彩窗立牌",
        spec: "75 × 59 mm · CNC",
        price: 18,
        variants: true,
        items: [
          { id: "window-hiro", name: "筱澤广", image: "assets/window-hiro.webp" },
          { id: "window-china", name: "仓本千奈", image: "assets/window-china.webp" },
          { id: "window-kotone", name: "藤田琴音", image: "assets/window-kotone.webp" },
          { id: "window-misuzu", name: "秦谷美铃", image: "assets/window-misuzu.webp" },
          { id: "window-lilja", name: "葛城莉莉娅", image: "assets/window-lilja.webp" },
        ],
      },
      {
        id: "spring",
        title: "摇摇乐立牌",
        spec: "65 × 46 mm · 可粘贴",
        price: 15,
        variants: true,
        items: [
          { id: "spring-hiro", name: "筱澤广", image: "assets/spring-hiro.webp" },
          { id: "spring-misuzu", name: "秦谷美铃", image: "assets/spring-misuzu.webp" },
          { id: "spring-kotone", name: "藤田琴音", image: "assets/spring-kotone.webp" },
          { id: "spring-lilja", name: "葛城莉莉娅", image: "assets/spring-lilja.webp" },
        ],
      },
    ],
  },
  {
    id: "consign",
    name: "老広虾粥铺",
    theme: "sepia",
    groups: [
      {
        id: "consign-all",
        title: "寄售",
        items: [
          { id: "consign-book", name: "篠澤迷走神经", spec: "48P", price: 65, image: "assets/consign-book.webp" },
          { id: "consign-mug", name: "搪瓷杯套组", spec: "350 ml", price: 35, image: "assets/consign-mug.webp" },
          { id: "consign-tote", name: "尼龙托特包", spec: "", price: 40, image: "assets/consign-tote.webp" },
        ],
      },
    ],
  },
];

// 展开成扁平商品表：变体继承组的价格/规格，名称拼成「组名 · 款式」。
export const products = shops.flatMap((shop) =>
  shop.groups.flatMap((group) =>
    group.items.map((item) => ({
      ...item,
      shop: shop.id,
      group: group.id,
      price: item.price ?? group.price,
      spec: item.spec ?? (group.variants ? group.title : group.spec),
      fullName: group.variants ? `${group.title} · ${item.name}` : item.name,
    })),
  ),
);

export const productById = new Map(products.map((p) => [p.id, p]));
