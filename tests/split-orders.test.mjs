import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { RULES, splitOrders } from "../tools/split-orders.mjs";

const CLI = fileURLToPath(new URL("../tools/split-orders.mjs", import.meta.url));
const rec = (id, t, total) => JSON.stringify({ id, t, device: "设备-X", total, items: [], receivedAt: t });

const sample = [
  rec("a", "2026-10-23T17:43:43.426Z", 30), // 北京时间 10-24 01:43
  rec("b", "2026-10-24T02:10:00.000Z", 55),
  rec("c", "2026-11-21T05:55:31.209Z", 15),
];

test("按北京时间日期分到场次，单数和金额守恒", () => {
  const out = splitOrders(sample, RULES);
  assert.deepEqual(Object.keys(out).sort(), ["hz-ouo-2026-10", "nj-ouo-2026-11"]);
  assert.deepEqual(out["hz-ouo-2026-10"].map((l) => JSON.parse(l).id), ["a", "b"]);
  assert.deepEqual(out["nj-ouo-2026-11"].map((l) => JSON.parse(l).id), ["c"]);
  const sum = (ls) => ls.reduce((s, l) => s + JSON.parse(l).total, 0);
  assert.equal(sum(Object.values(out).flat()), sum(sample));
});

test("原始行原样保留，不重新序列化", () => {
  const out = splitOrders(sample, RULES);
  assert.equal(out["nj-ouo-2026-11"][0], sample[2]);
});

test("遇到不属于任何场次的日期就报错", () => {
  assert.throws(() => splitOrders([...sample, rec("d", "2026-12-01T03:00:00.000Z", 1)], RULES), /2026-12-01/);
});

test("空行跳过，坏行报错", () => {
  assert.equal(splitOrders(["", ...sample, "  "], RULES)["nj-ouo-2026-11"].length, 1);
  assert.throws(() => splitOrders(["{not json"], RULES), /第 1 行/);
});

let tmp;
before(async () => {
  tmp = await mkdtemp(join(tmpdir(), "booth-split-"));
});
after(async () => rm(tmp, { recursive: true, force: true }));

test("命令行：写出每场的 orders.jsonl", () => {
  const src = join(tmp, "orders.jsonl");
  writeFileSync(src, sample.join("\n") + "\n");
  const outRoot = join(tmp, "events");
  const stdout = execFileSync(process.execPath, [CLI, src, outRoot], { encoding: "utf8" });
  assert.match(stdout, /hz-ouo-2026-10\s+2 单\s+85 元/);
  assert.equal(readFileSync(join(outRoot, "nj-ouo-2026-11", "orders.jsonl"), "utf8"), sample[2] + "\n");
});

test("命令行：有未知日期时一个文件都不写", () => {
  const src = join(tmp, "bad.jsonl");
  writeFileSync(src, [...sample, rec("d", "2026-12-01T03:00:00.000Z", 1)].join("\n"));
  const outRoot = join(tmp, "bad-out");
  assert.throws(() => execFileSync(process.execPath, [CLI, src, outRoot], { stdio: "pipe" }));
  assert.ok(!existsSync(outRoot));
});

test("命令行：目标文件已存在时不覆盖", () => {
  const src = join(tmp, "orders2.jsonl");
  writeFileSync(src, sample.join("\n"));
  const outRoot = join(tmp, "exists");
  mkdirSync(join(outRoot, "nj-ouo-2026-11"), { recursive: true });
  writeFileSync(join(outRoot, "nj-ouo-2026-11", "orders.jsonl"), "keep\n");
  assert.throws(() => execFileSync(process.execPath, [CLI, src, outRoot], { stdio: "pipe" }));
  assert.equal(readFileSync(join(outRoot, "nj-ouo-2026-11", "orders.jsonl"), "utf8"), "keep\n");
  assert.ok(!existsSync(join(outRoot, "hz-ouo-2026-10", "orders.jsonl")));
});
