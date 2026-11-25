import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { after, before, test } from "node:test";
import { pathToFileURL } from "node:url";
import { buildWeb } from "../tools/build-web.mjs";

let tmp;
before(async () => {
  tmp = await mkdtemp(join(tmpdir(), "booth-build-"));
});
after(async () => rm(tmp, { recursive: true, force: true }));

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)],
  );
}

const swFiles = (out) => {
  const sw = readFileSync(join(out, "sw.js"), "utf8");
  const files = JSON.parse(sw.match(/const FILES = (\[[\s\S]*?\]);/)[1]);
  const version = sw.match(/const VERSION = "([^"]+)";/)[1];
  return { files, version };
};

test("构建南京偶O：catalog.js 是这场的配置，manifest 带摊位号", async () => {
  const out = join(tmp, "nj");
  await buildWeb({ eventId: "nj-ouo-2026-11", outDir: out });
  const { event } = await import(pathToFileURL(join(out, "catalog.js")));
  assert.equal(event.id, "nj-ouo-2026-11");
  assert.ok(existsSync(join(out, "storage-keys.js")));
  assert.ok(existsSync(join(out, "assets", "eye-mask.webp")));
  const manifest = JSON.parse(readFileSync(join(out, "manifest.webmanifest"), "utf8"));
  assert.equal(manifest.name, "小広甜品铺 · 5 点单");
});

test("sw.js 的缓存清单正好覆盖输出的文件", async () => {
  const out = join(tmp, "sw");
  await buildWeb({ eventId: "nj-ouo-2026-11", outDir: out });
  const { files, version } = swFiles(out);
  const onDisk = walk(out).map((f) => relative(out, f)).filter((f) => f !== "sw.js" && !f.startsWith("."));
  assert.deepEqual([...files].filter((f) => f !== "./").sort(), onDisk.sort());
  assert.ok(files.includes("./"));
  assert.match(version, /^nj-ouo-2026-11-/);
});

test("每次构建 VERSION 都不同", async () => {
  const a = join(tmp, "v1");
  const b = join(tmp, "v2");
  await buildWeb({ eventId: "nj-ouo-2026-11", outDir: a });
  await buildWeb({ eventId: "nj-ouo-2026-11", outDir: b });
  assert.notEqual(swFiles(a).version, swFiles(b).version);
});

test("没有 private 目录时不含收款码；有就拷进 assets", async () => {
  const plain = join(tmp, "noqr");
  await buildWeb({ eventId: "nj-ouo-2026-11", outDir: plain });
  assert.ok(!walk(plain).some((f) => f.includes("qr-")));

  const priv = join(tmp, "private");
  mkdirSync(priv);
  writeFileSync(join(priv, "qr-wechat.webp"), "fake");
  const withQr = join(tmp, "qr");
  await buildWeb({ eventId: "nj-ouo-2026-11", outDir: withQr, privateDir: priv });
  assert.ok(existsSync(join(withQr, "assets", "qr-wechat.webp")));
  assert.ok(swFiles(withQr).files.includes("assets/qr-wechat.webp"));
});

test("输出目录已存在但不是构建产物时拒绝覆盖", async () => {
  const other = join(tmp, "someone-else");
  mkdirSync(other);
  writeFileSync(join(other, "keep.txt"), "x");
  await assert.rejects(buildWeb({ eventId: "nj-ouo-2026-11", outDir: other }), /不是构建产物/);
  assert.ok(existsSync(join(other, "keep.txt")));
});

test("同一目录可以重复构建", async () => {
  const out = join(tmp, "again");
  await buildWeb({ eventId: "nj-ouo-2026-11", outDir: out });
  await buildWeb({ eventId: "hz-ouo-2026-10", outDir: out });
  const { event } = await import(pathToFileURL(join(out, "catalog.js")) + "?2");
  assert.equal(event.id, "hz-ouo-2026-10");
  assert.ok(!existsSync(join(out, "assets", "shikishi-hiro.webp")), "上一场的图要清掉");
});

test("场次不存在时报错", async () => {
  await assert.rejects(buildWeb({ eventId: "no-such-event", outDir: join(tmp, "x") }), /no-such-event/);
});
