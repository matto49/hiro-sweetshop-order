#!/usr/bin/env bash
# 把某一场的点单页和订单服务部署到 ycy。
# 用法：tools/deploy.sh <场次>          例如 tools/deploy.sh nj-ouo-2026-11
# 环境变量：DEPLOY_HOST（默认 ycy，~/.ssh/config 里的别名）
#
# 做的事：跑测试 → 补齐收款码 → 构建 → 传到 releases/<时间> → 切 current 软链
#        → 更新服务端代码和 unit → 写 EVENT_ID → 重启 → 核对线上场次。
# 任何一步失败就停下；current 只在新版本完整上传后才切换。
set -euo pipefail

EVENT_ID="${1:-}"
HOST="${DEPLOY_HOST:-ycy}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_ROOT=/var/www/hiro-booth
API_DIR=/opt/hiro-booth-api
ETC_DIR=/etc/hiro-booth-api
URL=https://qing.matto.top/hiro-a12

if [[ -z "$EVENT_ID" || ! -f "$ROOT/events/$EVENT_ID/event.js" ]]; then
  echo "用法：tools/deploy.sh <场次>，场次是 events/ 下的目录名：" >&2
  ls "$ROOT/events" >&2
  exit 2
fi

cd "$ROOT"
echo "==> 跑测试"
npm test --silent >/dev/null

echo "==> 收款码（private/，不进仓库）"
mkdir -p private
if ! ls private/qr-*.webp >/dev/null 2>&1; then
  # 本机没有就从线上现在用的那份拿
  ssh "$HOST" "ls $WEB_ROOT/current/assets/qr-*.webp 2>/dev/null || ls /var/www/hiro-a12/assets/qr-*.webp 2>/dev/null" \
    | while read -r f; do scp -q "$HOST:$f" private/; done
fi
ls private/qr-*.webp >/dev/null 2>&1 || { echo "没有收款码：把 qr-wechat.webp、qr-alipay.webp 放进 private/" >&2; exit 1; }

echo "==> 构建 $EVENT_ID"
BUILD="$ROOT/.temp/deploy-build"
mkdir -p "$ROOT/.temp"
node tools/build-web.mjs "$EVENT_ID" --out "$BUILD" --private private

RELEASE="$(date -u +%Y%m%dT%H%M%SZ)-$EVENT_ID"
echo "==> 上传到 $HOST:$WEB_ROOT/releases/$RELEASE"
ssh "$HOST" "mkdir -p $WEB_ROOT/releases"
rsync -a --delete "$BUILD/" "$HOST:$WEB_ROOT/releases/$RELEASE/"

echo "==> 更新服务端"
ssh "$HOST" "mkdir -p $API_DIR $ETC_DIR"
scp -q server/server.mjs "$HOST:$API_DIR/server.mjs"
scp -q server/hiro-booth-api.service "$HOST:/etc/systemd/system/hiro-booth-api.service"
ssh "$HOST" bash -s -- "$EVENT_ID" "$WEB_ROOT" "$RELEASE" "$ETC_DIR" <<'REMOTE'
set -euo pipefail
EVENT_ID="$1"; WEB_ROOT="$2"; RELEASE="$3"; ETC_DIR="$4"
test -s "$ETC_DIR/admin.env" || { echo "缺 $ETC_DIR/admin.env（ADMIN_TOKEN=...）" >&2; exit 1; }
printf 'EVENT_ID=%s\n' "$EVENT_ID" > "$ETC_DIR/event.env"
systemctl daemon-reload
systemctl enable --quiet hiro-booth-api
systemctl restart hiro-booth-api
# 在本机直接核对服务起来了、场次对了（restart 在端口被占时也会返回 0，所以要查）
ok=""
for _ in 1 2 3 4 5 6 7 8 9 10; do
  sleep 1
  if systemctl is-active --quiet hiro-booth-api \
    && curl -fsS http://127.0.0.1:19130/api/health 2>/dev/null | grep -q "\"event\":\"$EVENT_ID\""; then ok=1; break; fi
done
if [[ -z "$ok" ]]; then
  echo "hiro-booth-api 没有以场次 $EVENT_ID 起来：" >&2
  journalctl -u hiro-booth-api -n 20 --no-pager >&2
  exit 1
fi
grep -q "id: \"$EVENT_ID\"" "$WEB_ROOT/releases/$RELEASE/catalog.js" || { echo "上传的 catalog.js 不是 $EVENT_ID" >&2; exit 1; }
# 服务正常后再原子切换页面：先建临时软链再改名覆盖
ln -sfn "$WEB_ROOT/releases/$RELEASE" "$WEB_ROOT/current.tmp"
mv -T "$WEB_ROOT/current.tmp" "$WEB_ROOT/current"
# 只留最近 5 次部署
ls -1d "$WEB_ROOT"/releases/*/ | sort | head -n -5 | xargs -r rm -rf
REMOTE

echo "==> 公网核对"
# 第一次部署时 nginx 还没指过来，这里不通过属正常；以后每次都应该通过
warn() { echo "提醒：$*（第一次部署、nginx 还没改时可以忽略）" >&2; }
health="$(curl -fsS "$URL/api/health" || true)"
[[ "$health" == *"\"event\":\"$EVENT_ID\""* ]] || warn "公网 $URL/api/health 返回的不是 $EVENT_ID：$health"
curl -fsS "$URL/catalog.js" 2>/dev/null | grep "id: \"$EVENT_ID\"" >/dev/null || warn "公网 $URL/catalog.js 不是 $EVENT_ID"
echo "完成：$URL/  场次 $EVENT_ID（$RELEASE）"
