import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function readPngDimensions(path) {
  const bytes = await readFile(new URL(path, import.meta.url));
  assert.deepEqual(bytes.subarray(0, 8), pngSignature);
  return {
    bytes: bytes.length,
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

test("checkout includes production-sized Alipay and WeChat QR images", async () => {
  const alipay = await readPngDimensions("../assets/alipay-qr.png");
  const wechat = await readPngDimensions("../assets/wechat-pay-qr.png");

  assert.deepEqual({ width: alipay.width, height: alipay.height }, { width: 930, height: 1054 });
  assert.deepEqual({ width: wechat.width, height: wechat.height }, { width: 792, height: 865 });
  assert.ok(alipay.bytes > 100_000);
  assert.ok(wechat.bytes > 50_000);
});
