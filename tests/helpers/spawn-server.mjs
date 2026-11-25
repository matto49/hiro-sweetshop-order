// 起一个真实的订单服务子进程，测试结束后关掉。
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

const SERVER = fileURLToPath(new URL("../../server/server.mjs", import.meta.url));

async function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

// 启动成功返回 { base, stop }；进程提前退出时返回 { exitCode, stderr }
export async function spawnServer(env) {
  const port = await freePort();
  const child = spawn(process.execPath, [SERVER], {
    env: { PATH: process.env.PATH, HOST: "127.0.0.1", PORT: String(port), ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (d) => (stderr += d));
  const result = await new Promise((resolve) => {
    child.once("exit", (code) => resolve({ exitCode: code, stderr }));
    child.stdout.on("data", (d) => {
      if (String(d).includes("listening")) resolve(null);
    });
  });
  if (result) return result;
  return {
    base: `http://127.0.0.1:${port}`,
    stop: () =>
      new Promise((resolve) => {
        child.once("exit", resolve);
        child.kill();
      }),
  };
}

export function order(id, items = [{ id: "book", name: "新刊", shop: "小広甜品铺", price: 30, qty: 1 }]) {
  return {
    id,
    t: "2026-11-21T02:00:00.000Z",
    device: "设备-TEST",
    total: items.reduce((s, it) => s + it.price * it.qty, 0),
    items,
  };
}

export async function postOrder(base, o) {
  const res = await fetch(`${base}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(o),
  });
  return { status: res.status, body: await res.json() };
}
