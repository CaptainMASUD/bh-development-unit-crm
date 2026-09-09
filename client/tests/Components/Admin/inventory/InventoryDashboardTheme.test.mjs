import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

for (const file of ["InventoryDashboard.jsx", "ItemProfiles.jsx"]) {
  test(`${file} uses the shared CRM Leads inventory presentation`, () => {
    const source = fs.readFileSync(new URL(`../../../../src/Components/Admin/inventory/${file}`, import.meta.url), "utf8")
    assert.match(source, /from "\.\/InventoryUI"/)
    assert.match(source, /InventoryPageShell/)
    assert.match(source, /InventoryPageHeader/)
    assert.doesNotMatch(source, /from-slate-950/)
  })
}
