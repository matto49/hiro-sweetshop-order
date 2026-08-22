# 小広甜品铺点单页

IFE02 F-3 现场点单网页。商品页支持数量调整、实时合计与本地保存；独立结账页展示支付宝/微信收款码，并通过后端重新计价、判断满 20 元袋子赠品资格、生成现场核对订单号。KTN 10cm 方卡为现场可自取无料，不计入订单赠品资格。

## 本地预览

```bash
python3 -m http.server 4173
```

打开 <http://127.0.0.1:4173>。

## 测试

```bash
node --test tests/*.test.mjs
```

## 后端接口

```bash
ORDER_DATA_DIR=./tmp/data ALLOWED_ORIGINS=http://127.0.0.1:4173 node server/server.mjs
```

- `GET /health`：健康检查。
- `POST /api/orders`：只接收商品 ID、数量、收款方式与客户端赠品判断；金额和赠品资格由服务端重新计算。
- 订单以 JSONL 追加写入 `ORDER_DATA_DIR/orders.jsonl`，不保存姓名、手机号、支付账号或 IP。

生产环境使用 `https://api.matto.top/hiro-order`，systemd 与 Nginx 配置模板位于 `server/`。

真实收款码应分别保存为 `assets/alipay-qr.png` 与 `assets/wechat-pay-qr.png`；文件缺失时结账页显示明确占位图，不会伪造二维码。

## 在线版本

GitHub Pages：<https://matto49.github.io/hiro-sweetshop-order/>
