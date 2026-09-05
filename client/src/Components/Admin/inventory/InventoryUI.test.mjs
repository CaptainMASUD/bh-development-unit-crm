import assert from "node:assert/strict"
import test from "node:test"
import { createServer } from "vite"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import fs from "node:fs"

async function loadUi(t) {
  const server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: "custom" })
  t.after(() => server.close())
  return server.ssrLoadModule("/src/Components/Admin/inventory/InventoryUI.jsx")
}

test("shared inventory shell follows the CRM Leads page layout", async (t) => {
  const ui = await loadUi(t)
  const markup = renderToStaticMarkup(
    React.createElement(ui.InventoryThemeBoundary, null,
      React.createElement(ui.InventoryPageShell, null,
        React.createElement(ui.InventoryPageHeader, { title: "Products", description: "Manage products" })
      )
    )
  )

  assert.match(markup, /inventory-theme/)
  assert.match(markup, /bg-gradient-to-b/)
  assert.match(markup, /max-w-\[1500px\]/)
  assert.match(markup, /rounded-3xl/)
  assert.match(markup, /Products/)
})

test("shared buttons and badges expose Leads visual and accessibility contracts", async (t) => {
  const ui = await loadUi(t)
  const button = renderToStaticMarkup(React.createElement(ui.InventoryButton, { variant: "primary" }, "Add New"))
  const iconButton = renderToStaticMarkup(React.createElement(ui.InventoryIconButton, { label: "Refresh data" }, "R"))
  const active = renderToStaticMarkup(React.createElement(ui.InventoryStatusBadge, { value: "active" }))
  const pending = renderToStaticMarkup(React.createElement(ui.InventoryStatusBadge, { value: "pending" }))

  assert.match(button, /bg-indigo-600/)
  assert.match(iconButton, /aria-label="Refresh data"/)
  assert.match(active, /emerald/)
  assert.match(pending, /amber/)
})

test("shared table and empty state use Leads card language", async (t) => {
  const ui = await loadUi(t)
  const markup = renderToStaticMarkup(
    React.createElement(ui.InventoryTableCard, { footer: React.createElement("span", null, "1 record") },
      React.createElement(ui.InventoryEmptyState, { title: "No records", description: "Adjust filters." })
    )
  )

  assert.match(markup, /rounded-3xl/)
  assert.match(markup, /border-gray-200/)
  assert.match(markup, /No records/)
  assert.match(markup, /Adjust filters/)
})

test("shared inventory search toolbar matches the CRM Leads control layout", async (t) => {
  const ui = await loadUi(t)
  const markup = renderToStaticMarkup(
    React.createElement(ui.InventorySearchToolbar, {
      value: "paper",
      onChange: () => {},
      placeholder: "Search inventory items...",
      ariaLabel: "Search inventory items",
      filters: [{ key: "status", label: "Status", value: "Active" }],
      onRemoveFilter: () => {},
      onOpenFilters: () => {},
      onClear: () => {},
      utilities: React.createElement("button", null, "Export"),
    })
  )

  assert.match(markup, /data-inventory-search-toolbar="true"/)
  assert.match(markup, /data-inventory-search-surface="true"/)
  assert.match(markup, /min-h-\[50px\]/)
  assert.match(markup, /bg-gray-50\/80/)
  assert.match(markup, /focus-within:border-indigo-300/)
  assert.match(markup, /aria-label="Search inventory items"/)
  assert.match(markup, /!bg-transparent/)
  assert.match(markup, /!border-0/)
  assert.match(markup, /focus-visible:!ring-0/)
  assert.match(markup, /Status:/)
  assert.match(markup, / Active<\/span>/)
  assert.match(markup, />Filters</)
  assert.match(markup, /data-inventory-search-utilities="true"/)
  assert.match(markup, />Export</)
  assert.match(markup, /Clear search and filters/)
})

test("search toolbar keeps utilities separate from the full-width search surface", async (t) => {
  const ui = await loadUi(t)
  const markup = renderToStaticMarkup(
    React.createElement(ui.InventorySearchToolbar, {
      value: "",
      onChange: () => {},
      utilities: React.createElement("select", { className: "w-full", "aria-label": "Status" },
        React.createElement("option", null, "All statuses")
      ),
    })
  )

  assert.match(markup, /data-inventory-search-utilities="true"/)
  assert.match(markup, /justify-end/)
})

test("search toolbar exposes page filters from the embedded Filters button", async (t) => {
  const ui = await loadUi(t)
  const markup = renderToStaticMarkup(
    React.createElement(ui.InventorySearchToolbar, {
      value: "",
      onChange: () => {},
      filterCount: 1,
      filtersOpen: true,
      onFiltersOpenChange: () => {},
      filterControls: React.createElement("select", { "aria-label": "Status filter" },
        React.createElement("option", null, "Active")
      ),
    })
  )

  assert.match(markup, />Filters</)
  assert.match(markup, /aria-expanded="true"/)
  assert.match(markup, /data-inventory-filter-panel="true"/)
  assert.match(markup, /aria-label="Status filter"/)
})

test("scoped compatibility theme normalizes legacy controls and flat page headers", () => {
  const css = fs.readFileSync(new URL("./inventory-theme.css", import.meta.url), "utf8")
  assert.match(css, /data-inventory-page-header/)
  assert.match(css, /bg-blue-600/)
  assert.match(css, /bg-violet-600/)
  assert.match(css, /rounded-3xl/)
  assert.match(css, /position:\s*sticky/)
})
