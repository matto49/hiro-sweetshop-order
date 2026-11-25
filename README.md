# 小広甜品铺 · 出摊点单

小広甜品铺出摊时用的 iPad 点单系统。摊主在 iPad 上点单，断网也能记账，联网后订单自动补传到服务器。

- 点单页：<https://qing.matto.top/hiro-a12/>（在 iPad 的 Safari 里「添加到主屏幕」使用）
- 订单服务：ycy 上的 `hiro-booth-api`（systemd），数据在 `/var/lib/private/hiro-booth-api/events/<场次>/`

用过的场次：

| 场次 | 展会 | 摊位 | 日期 |
| --- | --- | --- | --- |
| `hz-ouo-2026-10` | 杭偶O | A12 | 2026-10-24 |
| `nj-ouo-2026-11` | 南京偶O | 5 | 2026-11-21 |

2026-08-23 IFE02 F-3 用的是另一套顾客自助扫码点单页，见 tag `ife02-2026-08`。

## 换一场展会

1. 复制上一场的目录，改名成新场次：`cp -R events/nj-ouo-2026-11 events/<新场次>`。场次名只用小写字母、数字和连字符。
2. 改 `events/<新场次>/event.js`：
   - `event`：`id`（和目录名一致）、`name`（展会名）、`city`、`booth`（摊位号）、`date`。
   - `shops`：商品、规格、价格。同一组的款式放在一个 group 里。
3. 商品图放进 `events/<新场次>/assets/`，删掉不卖的。
4. `npm test`：会检查配置字段、商品 id 不重复、图片都在。
5. 部署：`tools/deploy.sh <新场次>`。
6. iPad 联网打开一次点单页，等它后台更新完，再打开一次就是新菜单。长按顶部横幅 1.5 秒进摊主设置，底部显示「已缓存，可断网使用」就可以去现场了。

页面标题、横幅上的摊位号和展会名、导出 CSV 的文件名都从 `event.js` 读，不用改代码。

## 目录

```
web/          点单页的通用文件（页面、脚本、样式、横幅、图标）
events/       每场一个目录：event.js（展会信息 + 商品表）和 assets/（商品图）
server/       订单服务 server.mjs、systemd unit、nginx 配置片段
tools/        build-web.mjs（按场次组装点单页）、deploy.sh（部署）、split-orders.mjs（一次性迁移用）
tests/        node --test
private/      收款码图片，不进仓库（.gitignore）
```

## 本地预览

```bash
node tools/build-web.mjs nj-ouo-2026-11      # 输出到 dist/
python3 -m http.server 4180 -d dist          # 打开 http://127.0.0.1:4180/
```

本地预览不注册离线缓存，也连不上订单服务（订单会留在本机待上传）。

## 收款码、订单和口令

仓库是公开的，下面这些都不进仓库：

- 收款码：本机放在 `private/qr-wechat.webp`、`private/qr-alipay.webp`。本机没有时，`deploy.sh` 会从线上现在用的那份拷下来。摊主也可以在 iPad 的摊主设置里临时换码，只存在那台 iPad 上。
- 订单：只在服务器上。
- 管理口令：服务器的 `/etc/hiro-booth-api/admin.env`（`ADMIN_TOKEN=...`），iPad 上在摊主设置里填一次。

## 本机存储

iPad 上的 localStorage：

- `booth:device`、`booth:admin-token`、`booth:qr`：跟着 iPad 走，换场次不变。
- `<场次>:log`、`<场次>:stock-server`：本机订单记录和库存缓存，按场次分开。

旧版用的 `hz-a12:*` 键，会在第一次打开新版时搬过来（只搬一次，旧键保留）。换场次后，如果本机上一场还有没上传的单，摊主设置的「本机记录」里会提示，点「补传」传到当前服务器（服务端按订单号去重）。

## 服务器上第一次安装

`deploy.sh` 会安装和重启 `hiro-booth-api`，但下面两样要事先准备好：

- `/etc/hiro-booth-api/admin.env`：`ADMIN_TOKEN=<管理口令>`，权限 600。
- nginx：`/etc/nginx/sites-available/qing` 里放 `server/nginx-qing.conf` 的两段，`nginx -t` 通过后再 reload。

## 测试

```bash
npm test
```
