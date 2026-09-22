import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { DOCUMENT_NUMBER_TYPES, getDocumentNumberType } from "../../config/documentNumberTypes.js";

test("product identifiers retain category-based numbering context", () => {
  const product = getDocumentNumberType("inventory.product");
  assert.equal(product.model, "Product");
  assert.equal(product.field, "sku");
  assert.equal(product.contextTokens.includes("CATEGORY"), true);
  assert.equal(product.pattern, "{CATEGORY}{SERIAL}");
});

test("every registered owned identifier has a unique, actionable numbering contract", () => {
  const keys = DOCUMENT_NUMBER_TYPES.map((type) => type.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const type of DOCUMENT_NUMBER_TYPES) {
    assert.match(type.key, /^[a-z]+\.[a-z][a-z0-9-]*$/);
    assert.ok(type.module && type.model && type.field, type.key);
    assert.ok(Array.isArray(type.producers) && type.producers.length, type.key);
    for (const producer of type.producers) {
      assert.equal(existsSync(fileURLToPath(new URL(`../../${producer}`, import.meta.url))), true, `${type.key}: ${producer}`);
    }
    assert.ok(type.mode === "manual" || type.pattern.includes("{SERIAL}"), type.key);
  }
});

test("registry spans each existing ERP module with application-owned identifiers", () => {
  const modules = new Set(DOCUMENT_NUMBER_TYPES.map((type) => type.module));
  for (const module of ["inventory", "purchase", "sales", "accounting", "manufacturing", "crm", "payroll", "supplier", "administration"]) {
    assert.ok(modules.has(module), module);
  }
});
