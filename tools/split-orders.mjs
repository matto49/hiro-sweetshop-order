#!/usr/bin/env node
// 一次性迁移：把旧 hiro-a12-api 的 orders.jsonl（杭偶O 和南京偶O 混在一起）按北京时间日期拆到各场次。
// 用法：node tools/split-orders.mjs <orders.jsonl> <输出根目录>
// 写到 <输出根目录>/<场次>/orders.jsonl。只要有一行不属于任何场次、或者目标文件已存在，就一个文件都不写。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// 北京时间日期 → 场次
export const RULES = {
  "2026-10-24": "hz-ouo-2026-10",
  "2026-11-21": "nj-ouo-2026-11",
};

const beijingDate = (iso) => new Date(Date.parse(iso) + 8 * 3600_000).toISOString().slice(0, 10);

// lines：原始行；返回 { 场次: 原始行[] }，行内容不改
export function splitOrders(lines, rules) {
  const out = {};
  lines.forEach((line, i) => {
    if (!line.trim()) return;
    let rec;
    try {
      rec = JSON.parse(line);
    } catch {
      throw new Error(`第 ${i + 1} 行不是有效的 JSON`);
    }
    if (Number.isNaN(Date.parse(rec?.t))) throw new Error(`第 ${i + 1} 行没有有效的下单时间 t`);
    const date = beijingDate(rec.t);
    const eventId = rules[date];
    if (!eventId) throw new Error(`第 ${i + 1} 行（订单 ${rec.id}）的日期 ${date} 不属于任何场次`);
    (out[eventId] ||= []).push(line);
  });
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const [src, outRoot] = process.argv.slice(2);
  if (!src || !outRoot) {
    console.error("用法：node tools/split-orders.mjs <orders.jsonl> <输出根目录>");
    process.exit(2);
  }
  try {
    const parts = splitOrders(readFileSync(src, "utf8").split("\n"), RULES);
    const targets = Object.keys(parts).map((id) => join(outRoot, id, "orders.jsonl"));
    const taken = targets.filter((f) => existsSync(f));
    if (taken.length) throw new Error(`目标文件已存在，不覆盖：${taken.join(", ")}`);
    let n = 0;
    let sum = 0;
    for (const [id, lines] of Object.entries(parts).sort()) {
      mkdirSync(join(outRoot, id), { recursive: true });
      writeFileSync(join(outRoot, id, "orders.jsonl"), lines.join("\n") + "\n", { flag: "wx" });
      const total = lines.reduce((s, l) => s + JSON.parse(l).total, 0);
      n += lines.length;
      sum += total;
      console.log(`${id}\t${lines.length} 单\t${total} 元`);
    }
    console.log(`合计\t${n} 单\t${sum} 元`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
