# 小広甜品铺出摊点单系统：整理成可复用的仓库

日期：2026-11-25

## 为什么做

小広甜品铺目前有两套点单系统：

- **IFE02 版**：2026-08-23 IFE02 F-3 用的，顾客自己扫码点单。源码就在本仓库 `matto49/hiro-sweetshop-order`（公开），GitHub Pages 还开着，后端是 ycy 上的 `hiro-order-api`，挂在 order.matto.top。
- **A12 版**：2026-10-24 杭偶O A12 和 2026-11-21 南京偶O 用的，摊主拿 iPad 点单，断网也能记账，联网后补传订单。只部署在 ycy：前端 `/var/www/hiro-a12`，后端 `/opt/hiro-a12-api/server.mjs`，systemd 服务 `hiro-a12-api`，域名 qing.matto.top。**这一版没有 git 记录，也没有测试，ycy 上那份是唯一一份。**

以后出摊都用 A12 版。现在它有三个问题：

1. 源码只有 ycy 上一份，没有版本记录。
2. 展会信息写死了。代码里有 `杭偶O`、`A12`、`hz-a12:` 存储前缀，横幅图里也直接画着「A12」和「杭州 · 杭偶O」，所以南京偶O 那场页面上还是杭偶O。
3. 杭偶O 和南京偶O 的订单混在同一个 `/var/lib/hiro-a12-api/orders.jsonl` 里，只能靠日期分开。

用户的决定：用 A12 版**替换**本仓库原来的 IFE02 内容，以后就维护这一个仓库。

## 目标

- 本仓库的 main 变成 A12 版，以后改代码、部署都从这里出。
- 换一场展会只需要新建一份展会配置，加上商品图，跑一条部署命令。页面标题、横幅上的摊位号和展会名、本机存储前缀、导出文件名都从配置读。
- 订单按场次分开存，三场历史订单各自归档。
- 后端有自动化测试。

## 不做的事

- 点单流程和界面不改，现场的用法保持原样（用户说这次只做整理）。
- 不把 IFE02 的顾客自助点单、满赠判断合进来。IFE02 版留在 git 历史里，打 tag 就能找到。
- 不做线上付款，不加顾客信息字段。

## 绝对不能出现的情况

- **收款码、订单数据、管理口令进入这个公开仓库**，包括 git 历史。
- 部署时把 ycy 上已有的订单弄丢或者覆盖掉。
- 部署后 iPad 上的离线缓存一直卡在旧版本，现场打不开新菜单。

## 约束

- 仓库是公开的。`assets/qr-*.webp`（微信、支付宝收款码）只放在 ycy 和本机被 gitignore 的目录里，部署脚本从那里拷贝。
- 前端是纯静态文件，没有构建步骤：`index.html`、`app.js`、`catalog.js`、`sw.js`、`styles.css`、`manifest.webmanifest`。iPad 是在 Safari 里「添加到主屏幕」用的，靠 Service Worker 离线工作。这些都保持不变。
- 后端是单个 Node 文件，只用标准库（`node:http`、`node:fs`），不引入依赖。ycy 上的 Node 在 `/usr/local/bin/node`。
- 后端不按商品表校验价格，价格以 iPad 传上来的为准（离线记账的设计），这一点保持。
- 默认分支保持 `main`（GitHub Pages 和现有历史都在 main 上）。开发在 worktree 分支 `feat_matto_booth_events` 上做，完成后合进 main。

## 怎么做

### 1. 先把现状原样提交

把 ycy 上的 A12 版原样拷进仓库（不含收款码），先提交一次，提交说明写「导入 ycy 上 A12 版（杭偶O / 南京偶O 实际运行的代码）」。后面的改动都在这次提交之上做，diff 才看得清。

提交之前，给 IFE02 版的最后一个提交（`Merge ordering instructions into compact header`，2026-08-22）打 tag `ife02-2026-08`。IFE02 的文件从 main 删掉，不另建 archive 目录。

### 2. 仓库结构

```
web/                     iPad 点单页（原 /var/www/hiro-a12）
  index.html app.js sw.js styles.css manifest.webmanifest
  assets/                通用素材：头像、图标、去掉摊位号的横幅
server/
  server.mjs             订单同步服务（原 /opt/hiro-a12-api/server.mjs）
  hiro-booth-api.service
  nginx-qing.conf        qing.matto.top 的 location 片段，从 ycy 现有配置抄
events/
  hz-ouo-2026-10/        杭偶O A12
    event.js             展会配置 + 商品表
    assets/              这场的商品图
  nj-ouo-2026-11/        南京偶O
    event.js
    assets/
tests/
tools/
  deploy.sh
  split-orders.mjs       一次性用的：拆分历史订单
.gitignore               .temp/、private/、node_modules/、data/
```

`private/`（被 gitignore）放收款码，部署时拷到 ycy 的 `web/assets/`。ycy 上已经有一份，第一次部署可以直接用 ycy 上的。

### 3. 展会配置 `events/<场次>/event.js`

在现在的 `catalog.js` 外面加一层展会信息：

```js
export const event = {
  id: "nj-ouo-2026-11",        // 也用作本机存储前缀和服务器数据目录名
  name: "南京偶O",
  city: "南京",
  booth: "5",
  date: "2026-11-21",
};
export const shops = [ /* 和现在 catalog.js 的结构一样 */ ];
```

- 部署时把要用的那场 `event.js` 拷成 `web/catalog.js`，商品图拷进 `web/assets/`。`sw.js` 的 `FILES` 缓存清单按这场的商品图生成。
- 两场历史配置怎么来（我的判断）：ycy 上现在的 `catalog.js` 是 11-21 南京偶O 当天的版本，原样作为 `nj-ouo-2026-11`。杭偶O 当时的商品表没有留底，复制同一份，再用 10-24 订单里实际出现的商品 id、名称和价格核对，对不上的地方以订单为准。`event.js` 开头写一行注释说明这份是事后补的。
- `app.js` 里写死的地方都改成从 `event` 读：
  - 存储前缀分两类（我的判断）：
    - 跟着这台 iPad 走的：设备编号、管理口令、摊主上传的收款码，用固定前缀 `booth:`，换场次不丢。
    - 跟着场次走的：本机订单记录、库存缓存，用 `${event.id}:`。
  - 旧键迁移：新版第一次启动时，如果发现 `hz-a12:*`，就把设备编号、口令、收款码搬到 `booth:`。本机订单记录 `hz-a12:log` 原样搬到 `hz-ouo-2026-10:log`（杭偶O 和南京偶O 两天的记录都在这里，没关系，服务端按订单号去重）。还没上传的单照常补传。迁移完写一个标记，以后不再搬，旧键保留不删。
  - 换场次时，如果本机还有上一场没传完的单，摊主设置页顶部显示「上一场还有 N 单没上传」，并提供「补传」按钮，补传到当前服务器（服务端按订单号去重，订单自带时间，事后按时间也能分清）。
  - CSV 文件名：`A12-杭偶O-…` 改成 `${booth}-${name}-…`。
  - `<title>`、manifest 名称。
- 横幅：做一张去掉摊位号徽章和展会名的 `banner-sweet.webp`。徽章那块用同色条纹补上：右边第 8 条蓝条纹和左边第 2 条一样，可以直接复制。摊位号和展会名改成 HTML 叠在横幅右侧，样式照原图（白色八角星里是蓝色粗体摊位号，下面一行小字写城市和展会名）。
- `sw.js` 的 `VERSION` 改成 `${event.id}-v<n>`，部署脚本每次自动加一，保证 iPad 能拿到新版本。

### 4. 订单按场次存

- 服务器的数据目录改成 `/var/lib/hiro-booth-api/events/<event.id>/`，里面放 `orders.jsonl` 和 `stock.json`。
- 用哪一场由服务端环境变量 `EVENT_ID` 决定。部署脚本切换场次时，写 `/etc/hiro-booth-api/event.env` 然后重启服务。前端不用传场次。
- 现在的 `/api/admin/archive`（清空订单、留一份备份）保留。
- 历史数据迁移，在 ycy 上用 `tools/split-orders.mjs` 跑一次：
  - `/var/lib/hiro-a12-api/orders.jsonl` 里北京时间 10-24 的订单进 `hz-ouo-2026-10`，11-21 的进 `nj-ouo-2026-11`。10-24 凌晨 01:43 那一单看着像测试单，也放进杭偶O，不删。
  - 按订单自带的下单时间 `t` 换算成北京时间来分，不用 `receivedAt`。遇到不属于这两天的订单，脚本报错停下，不能悄悄丢掉。核对过：文件里一共 102 单，全部落在这两天。
  - `orders.jsonl.2026-10-24T01-59-01-689Z.bak` 里是杭偶O 开摊前的 3 单测试（北京时间 10-24 09:00–09:58，开摊前已经归档过），原样拷进 `hz-ouo-2026-10/`，不并进订单。
  - `stock.json` 当前是空的（没设库存），拷进 `nj-ouo-2026-11/`。新场次的库存从空白开始。
  - `/var/lib/hiro-order-api/orders.jsonl`（IFE02，13 单）原样拷进 `events/ife02-2026-08/`。
  - 注意 `hiro-a12-api` 用的是 DynamicUser，真实目录在 `/var/lib/private/hiro-a12-api/`。新服务同样用 `StateDirectory=hiro-booth-api`，迁移后检查目录属主。
  - 原文件不动，迁移只复制。迁移完核对：每场的单数和金额合计与迁移前一致（杭偶O 80 单 3964 元，南京偶O 22 单 669 元，IFE02 13 单 719 元）。

### 5. 服务改名和部署

- systemd 服务从 `hiro-a12-api` 改名为 `hiro-booth-api`，端口还是 19130，域名还是 qing.matto.top。旧服务停掉并 disable，unit 文件备份到 `/root/ops-backups/`。
- 管理口令搬到 `/etc/hiro-booth-api/admin.env`，内容从 `/etc/hiro-a12-api/admin.env` 复制，不打印。
- `tools/deploy.sh <场次>` 做这几件事：
  1. 本地跑测试。
  2. 组装 `web/`：通用文件、这场的 `event.js` 和商品图、收款码。
  3. rsync 到 ycy 的 `/var/www/hiro-booth/`。先传到一个新目录，再切软链，和 `/var/www/last-exit` 的做法一样，方便回滚。
  4. 拷 `server.mjs`，写 `event.env`，重启服务。
  5. 用 `curl https://qing.matto.top/api/health` 和 `/api/stock` 确认。
- nginx 的 root 从 `/var/www/hiro-a12` 改成 `/var/www/hiro-booth/current`。配置在 `/etc/nginx/sites-available/qing`，这个站点上还挂着 xbot 预览、paseo-relay 等别的东西，只动点单页和 `/api/` 这两个 location。改之前备份配置，改完先 `nginx -t` 再 reload，然后确认 qing.matto.top 上其他路径照常能用。
- 生产操作（迁移、停旧服务、改 nginx、首次部署）由实现者（Claude）在 ycy 上执行。每一步先备份，核对数字后再走下一步。目前没有正在进行的展会，随时可以切换。
- 首次部署上线南京偶O 这一场，之后下一场展会新建 `events/<新场次>/` 再部署。

### 6. 测试

用 `node --test`，不引入测试框架：

- 服务端：同一订单号重复上传只记一次；扣库存，库存不足时的行为和现在一致；不带管理口令访问 admin 接口返回 401；切换 `EVENT_ID` 后读写的是对应目录。
- 配置：每个 `events/*/event.js` 必填字段齐全，商品 id 不重复，引用的图片都存在。
- `split-orders.mjs`：拆分前后单数和金额守恒。

前端界面没有自动化测试，部署后在浏览器里打开 qing.matto.top 看一遍：横幅显示的是配置里的摊位号和展会名，菜单、付款页、长按横幅进摊主设置、导出 CSV 都能用。

## 交给实现者自己决定的

- `app.js` 里怎么拆函数，原则是改动尽量小。
- 横幅叠字的具体 CSS。
- `deploy.sh` 用 bash 还是 node 写。

## 用户定下的（2026-11-25）

- 关掉本仓库的 GitHub Pages。在 main 换成 A12 版之后再关。
- 停掉旧的 IFE02 后端 `hiro-order-api`（order.matto.top）并 disable。先把 unit 文件和 `/var/lib/private/hiro-order-api/` 备份到 `/root/ops-backups/`，原数据文件保留不删。nginx 里 order.matto.top 的配置这次不动。
- 南京偶O 的摊位号是 `5`，写进 `nj-ouo-2026-11/event.js`。杭偶O 是 `A12`。

## 用到的材料

- ycy 上的现状快照：`.temp/ycy-snapshot/`（gitignore，不提交），2026-11-25 从 ycy 拉下来的 `hiro-a12/`、`hiro-a12-api/server.mjs`、`hiro-a12-api.service`。
- 三场订单的统计口径：见 memory `hiro-sweetshop-booth`。
