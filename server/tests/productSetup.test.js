import assert from "node:assert/strict"
import test from "node:test"

import { buildCategoryProductCode } from "../controllers/inventory/product.controller.js"
import { buildUploadTarget } from "../controllers/upload.controller.js"

test("category product codes advance past the highest numeric suffix", () => {
  assert.equal(
    buildCategoryProductCode(" ec ", ["EC1", "EC9", "EC10", "OTHER4"]),
    "EC11"
  )
})

test("product image uploads use an inventory product key", () => {
  const target = buildUploadTarget({
    scope: "product",
    fileName: "front.webp",
    fileType: "image/webp",
    now: 1700000000000,
    random: "abc123",
  })

  assert.deepEqual(target, {
    scope: "product",
    key: "inventory/products/1700000000000-abc123.webp",
  })
})

test("product image uploads reject non-image content", () => {
  assert.throws(
    () => buildUploadTarget({
      scope: "product",
      fileName: "report.pdf",
      fileType: "application/pdf",
      now: 1700000000000,
      random: "abc123",
    }),
    /PNG, JPG, or WEBP/
  )
})
