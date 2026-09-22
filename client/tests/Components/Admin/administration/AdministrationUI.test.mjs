import assert from "node:assert/strict"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer } from "vite"

async function loadAdministrationModules(t) {
  const server = await createServer({
    root: process.cwd(),
    server: { middlewareMode: true },
    appType: "custom",
  })
  t.after(() => server.close())
  return Promise.all([
    server.ssrLoadModule("/src/Components/Admin/administration/AdministrationUI.jsx"),
    server.ssrLoadModule("/src/Components/Admin/administration/administrationApi.js"),
  ])
}

test("Administration UI renders the CRM-aligned page, header, toolbar, fields, and retry state", async (t) => {
  const [ui] = await loadAdministrationModules(t)
  const html = renderToStaticMarkup(
    React.createElement(ui.AdministrationPage, null,
      React.createElement(ui.AdministrationHeader, {
        title: "Company Details",
        description: "Manage the active tenant company profile.",
      }),
      React.createElement(ui.AdministrationToolbar, {
        value: "acme",
        onChange() {},
        placeholder: "Search company settings...",
        onOpenFilters() {},
      }),
      React.createElement(ui.AdministrationField, { label: "Company Name", htmlFor: "company-name" },
        React.createElement("input", { id: "company-name" })
      ),
      React.createElement(ui.AdministrationStatus, { value: "active" }),
      React.createElement(ui.AdministrationTableState, {
        status: "error",
        title: "Unable to load",
        onRetry() {},
      })
    )
  )

  assert.match(html, /max-w-\[1500px\]/)
  assert.match(html, /Company Details/)
  assert.match(html, /data-administration-search="true"/)
  assert.match(html, /Search company settings/)
  assert.match(html, />Filters</)
  assert.match(html, /for="company-name"/)
  assert.match(html, /aria-label="Status: active"/)
  assert.match(html, />Retry</)
})

test("Administration API sends the stored bearer token and normalizes API errors", async (t) => {
  const [, api] = await loadAdministrationModules(t)
  const calls = []
  const storage = { getItem(key) { return key === "token" ? "signed-token" : null } }
  const fetchImpl = async (url, options) => {
    calls.push({ url, options })
    return {
      ok: true,
      status: 200,
      async json() { return { success: true, data: { settings: { tablePageSize: 20 } } } },
    }
  }

  const payload = await api.administrationRequest("/settings", { fetchImpl, storage })
  assert.equal(payload.data.settings.tablePageSize, 20)
  assert.equal(calls[0].options.headers.Authorization, "Bearer signed-token")

  const failingFetch = async () => ({
    ok: false,
    status: 409,
    async json() { return { message: "Settings changed in another session." } },
  })
  await assert.rejects(
    () => api.administrationRequest("/settings", { fetchImpl: failingFetch, storage }),
    (error) => error.status === 409 && /another session/i.test(error.message)
  )
})
