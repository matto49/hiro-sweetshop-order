import { createServer } from "node:http";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { OrderInputError, createOrderRecord, publicOrder } from "./order-service.mjs";

const defaultAllowedOrigins = [
  "https://matto49.github.io",
  "https://order.matto.top",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
];

function json(response, statusCode, body, extraHeaders = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    ...extraHeaders,
  });
  response.end(JSON.stringify(body));
}

function corsHeaders(origin, allowedOrigins) {
  if (!origin || !allowedOrigins.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

async function readJsonBody(request, maxBytes = 32 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new OrderInputError("请求内容过大。", 413);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new OrderInputError("请求不是有效的 JSON。");
  }
}

async function createOrderStore(filePath) {
  const byRequestId = new Map();
  await mkdir(dirname(filePath), { recursive: true, mode: 0o750 });
  try {
    const content = await readFile(filePath, "utf8");
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      try {
        const record = JSON.parse(line);
        if (record?.requestId) byRequestId.set(record.requestId, record);
      } catch {
        // Preserve service availability if a single historical line is damaged.
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  let appendQueue = Promise.resolve();
  return {
    find(requestId) {
      return byRequestId.get(requestId);
    },
    async save(record) {
      appendQueue = appendQueue.then(() => appendFile(filePath, `${JSON.stringify(record)}\n`, { mode: 0o640 }));
      await appendQueue;
      byRequestId.set(record.requestId, record);
    },
  };
}

function createRateLimiter({ limit = 30, windowMs = 60_000 } = {}) {
  const requestsByIp = new Map();
  return (ip) => {
    const now = Date.now();
    const recent = (requestsByIp.get(ip) || []).filter((timestamp) => now - timestamp < windowMs);
    recent.push(now);
    requestsByIp.set(ip, recent);
    return recent.length <= limit;
  };
}

export async function createOrderServer(options = {}) {
  const dataFile = options.dataFile || resolve(process.env.ORDER_DATA_DIR || "./data", "orders.jsonl");
  const allowedOrigins = new Set(
    options.allowedOrigins ||
      (process.env.ALLOWED_ORIGINS || defaultAllowedOrigins.join(","))
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
  );
  const store = await createOrderStore(dataFile);
  const allowRequest = createRateLimiter(options.rateLimit);

  return createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    const origin = request.headers.origin;
    const headers = corsHeaders(origin, allowedOrigins);

    if (origin && !allowedOrigins.has(origin)) {
      json(response, 403, { message: "当前页面来源不允许提交订单。" });
      return;
    }

    if (request.method === "OPTIONS" && url.pathname === "/api/orders") {
      response.writeHead(204, headers);
      response.end();
      return;
    }

    if (request.method === "GET" && url.pathname === "/health") {
      json(response, 200, { ok: true, service: "hiro-order-api" });
      return;
    }

    if (request.method !== "POST" || url.pathname !== "/api/orders") {
      json(response, 404, { message: "接口不存在。" }, headers);
      return;
    }

    const forwarded = request.headers["x-forwarded-for"];
    const clientIp = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]) || request.socket.remoteAddress || "unknown";
    if (!allowRequest(clientIp.trim())) {
      json(response, 429, { message: "提交过于频繁，请稍后再试。" }, headers);
      return;
    }

    if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
      json(response, 415, { message: "请使用 JSON 提交订单。" }, headers);
      return;
    }

    try {
      const payload = await readJsonBody(request);
      const existing = typeof payload?.requestId === "string" ? store.find(payload.requestId) : null;
      if (existing) {
        json(response, 200, publicOrder(existing, true), headers);
        return;
      }

      const record = createOrderRecord(payload);
      await store.save(record);
      json(response, 201, publicOrder(record), headers);
    } catch (error) {
      if (error instanceof OrderInputError) {
        json(response, error.statusCode, { message: error.message }, headers);
        return;
      }
      console.error(error);
      json(response, 500, { message: "服务暂时不可用，请现场联系摊主。" }, headers);
    }
  });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const host = process.env.HOST || "127.0.0.1";
  const port = Number.parseInt(process.env.PORT || "19120", 10);
  const server = await createOrderServer();
  server.listen(port, host, () => console.log(`hiro-order-api listening on http://${host}:${port}`));
}
