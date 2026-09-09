import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import test from "node:test";

test("model imports do not declare duplicate schema indexes", async () => {
  const warnings = [];
  const onWarning = (warning) => warnings.push(warning.message);
  process.on("warning", onWarning);
  try {
    const root = new URL("../../models/", import.meta.url);
    for (const file of await readdir(root, { recursive: true })) {
      if (file.endsWith(".js")) await import(new URL(file.replaceAll("\\", "/"), root));
    }
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(warnings.filter((message) => message.includes("Duplicate schema index")), []);
  } finally {
    process.off("warning", onWarning);
  }
});
