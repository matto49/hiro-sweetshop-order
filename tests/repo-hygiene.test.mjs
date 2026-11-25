// 公开仓库：收款码、订单、口令不能被 git 跟踪，也不能被随手 git add 进来
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });

test("仓库里没有收款码、订单、库存和 env 文件", () => {
  const bad = git("ls-files").split("\n").filter((f) => /(^|\/)qr-|\.jsonl$|\.bak$|(^|\/)stock\.json$|\.env$/.test(f));
  assert.deepEqual(bad, []);
});

test("这些文件放在哪个目录都会被忽略", () => {
  for (const f of [
    "web/assets/qr-wechat.webp",
    "events/nj-ouo-2026-11/assets/qr-alipay.webp",
    "events/nj-ouo-2026-11/orders.jsonl",
    "events/nj-ouo-2026-11/orders.jsonl.2026-10-24T01-59-01-689Z.bak",
    "events/nj-ouo-2026-11/stock.json",
    "server/admin.env",
    "server/event.env",
  ]) {
    assert.doesNotThrow(() => git("check-ignore", "-q", "--no-index", f), `${f} 没被忽略`);
  }
});
