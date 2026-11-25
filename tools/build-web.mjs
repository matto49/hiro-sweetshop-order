#!/usr/bin/env node
// 组装某一场的点单页：通用文件（web/）+ 这场的商品表和商品图（events/<场次>/）+ 收款码（private/，不进仓库）。
// 用法：node tools/build-web.mjs <场次> [--out dist] [--private private]
import { randomBytes } from "node:crypto";
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MARKER = ".booth-build";

const exists = (p) => stat(p).then(() => true, () => false);

async function walk(dir) {
  const out = [];
  for (const d of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, d.name);
    if (d.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

function stamp() {
  const t = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  return `${t}-${randomBytes(2).toString("hex")}`;
}

export async function buildWeb({ eventId, outDir, privateDir }) {
  const eventDir = join(ROOT, "events", eventId);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(eventId) || !(await exists(join(eventDir, "event.js")))) {
    throw new Error(`找不到场次配置：events/${eventId}/event.js`);
  }
  const { event } = await import(pathToFileURL(join(eventDir, "event.js")));
  if (event.id !== eventId) throw new Error(`events/${eventId}/event.js 里的 event.id 是 ${event.id}`);

  const out = resolve(outDir);
  // 只清空自己以前生成的目录，别的目录一律不碰
  if (await exists(out)) {
    if (!(await exists(join(out, MARKER)))) throw new Error(`${out} 已存在，但不是构建产物，不覆盖`);
    await rm(out, { recursive: true });
  }
  await mkdir(join(out, "assets"), { recursive: true });

  await cp(join(ROOT, "web"), out, { recursive: true, filter: (src) => !src.endsWith(".DS_Store") });
  await cp(join(eventDir, "event.js"), join(out, "catalog.js"));
  if (await exists(join(eventDir, "assets"))) await cp(join(eventDir, "assets"), join(out, "assets"), { recursive: true });
  if (privateDir && (await exists(privateDir))) {
    for (const f of await readdir(privateDir)) {
      if (/^qr-[\w-]+\.(webp|png|jpe?g)$/.test(f)) await cp(join(privateDir, f), join(out, "assets", f));
    }
  }

  // storage-keys.js 内联进 app.js：第一次从旧版升级时，旧版的离线缓存里没有这个文件，
  // 新 app.js 若还要单独加载它，在新缓存装好之前断网打开就会白屏。
  const keysPath = join(out, "storage-keys.js");
  const appPath = join(out, "app.js");
  const keysSrc = (await readFile(keysPath, "utf8")).replace(/^export /gm, "");
  const importLine = /^import \{[^}]*\} from "\.\/storage-keys\.js";\n/m;
  const appSrc = await readFile(appPath, "utf8");
  if (!importLine.test(appSrc)) throw new Error("web/app.js 里找不到 storage-keys.js 的 import");
  await writeFile(appPath, appSrc.replace(importLine, () => `// ---- 以下内联自 storage-keys.js ----\n${keysSrc}// ---- 内联结束 ----\n`));
  await rm(keysPath);

  const manifestPath = join(out, "manifest.webmanifest");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.name = `小広甜品铺 · ${event.booth} 点单`;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const version = `${event.id}-${stamp()}`;
  const files = (await walk(out))
    .map((f) => relative(out, f).split("\\").join("/"))
    .filter((f) => f !== "sw.js" && !f.split("/").pop().startsWith("."))
    .sort();
  const swPath = join(out, "sw.js");
  const sw = (await readFile(swPath, "utf8"))
    .replace('"__VERSION__"', JSON.stringify(version))
    .replace("__FILES__", JSON.stringify(["./", ...files], null, 2));
  await writeFile(swPath, sw);
  await writeFile(join(out, MARKER), `${version}\n`);
  return { outDir: out, version, files };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const args = process.argv.slice(2);
  const opt = (name, fallback) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : fallback;
  };
  const eventId = args[0];
  if (!eventId || eventId.startsWith("--")) {
    console.error("用法：node tools/build-web.mjs <场次> [--out dist] [--private private]");
    process.exit(2);
  }
  try {
    const r = await buildWeb({
      eventId,
      outDir: opt("--out", join(ROOT, "dist")),
      privateDir: opt("--private", join(ROOT, "private")),
    });
    console.log(`已构建 ${eventId} → ${r.outDir}（${r.files.length} 个文件，VERSION ${r.version}）`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
