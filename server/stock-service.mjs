import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { products } from "../catalog.mjs";

const productIds = new Set(products.map((product) => product.id));

export class StockInputError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "StockInputError";
    this.statusCode = statusCode;
  }
}

function snapshot(soldOutIds, updatedAt) {
  return {
    soldOut: [...soldOutIds].sort(),
    updatedAt,
  };
}

export async function createStockStore(filePath) {
  await mkdir(dirname(filePath), { recursive: true, mode: 0o750 });
  let soldOutIds = new Set();
  let updatedAt = null;

  try {
    const stored = JSON.parse(await readFile(filePath, "utf8"));
    soldOutIds = new Set(
      Array.isArray(stored?.soldOut) ? stored.soldOut.filter((id) => productIds.has(id)) : [],
    );
    updatedAt = typeof stored?.updatedAt === "string" ? stored.updatedAt : null;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  let updateQueue = Promise.resolve();
  return {
    get() {
      return snapshot(soldOutIds, updatedAt);
    },
    soldOutIds() {
      return new Set(soldOutIds);
    },
    async update(payload, now = new Date()) {
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new StockInputError("库存更新格式不正确。");
      }
      if (typeof payload.productId !== "string" || !productIds.has(payload.productId)) {
        throw new StockInputError("商品不存在。");
      }
      if (typeof payload.soldOut !== "boolean") {
        throw new StockInputError("售尽状态必须为布尔值。");
      }

      let result;
      updateQueue = updateQueue.then(async () => {
        const nextSoldOutIds = new Set(soldOutIds);
        if (payload.soldOut) nextSoldOutIds.add(payload.productId);
        else nextSoldOutIds.delete(payload.productId);
        const nextUpdatedAt = now.toISOString();
        const nextState = snapshot(nextSoldOutIds, nextUpdatedAt);
        const temporaryPath = `${filePath}.${process.pid}.tmp`;
        await writeFile(temporaryPath, `${JSON.stringify(nextState)}\n`, { mode: 0o640 });
        await rename(temporaryPath, filePath);
        soldOutIds = nextSoldOutIds;
        updatedAt = nextUpdatedAt;
        result = nextState;
      });
      await updateQueue;
      return result;
    },
  };
}
