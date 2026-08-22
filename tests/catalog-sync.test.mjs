import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { products } from "../catalog.mjs";

test("shared checkout/server catalog stays aligned with the product page", async () => {
  const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");
  for (const product of products) {
    const escapedId = product.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const block = appSource.match(new RegExp(`id: "${escapedId}"([\\s\\S]*?)\\n  },`));
    assert.ok(block, `missing ${product.id} in app.js`);
    assert.match(block[1], new RegExp(`price: ${product.price},`), `price mismatch for ${product.id}`);
    assert.match(block[1], new RegExp(`name: "${product.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  }
});
