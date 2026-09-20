const API_BASE = `${String(import.meta.env.VITE_API_URL || "").replace(/\/$/, "")}/api`

export function lcHeaders(extra = {}) {
  const token = localStorage.getItem("token")
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}

export async function lcRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: lcHeaders(options.headers),
  })
  const contentType = response.headers.get("content-type") || ""
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : await response.blob()
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error || "Commercial LC request failed.")
    error.status = response.status
    error.details = payload?.details
    throw error
  }
  return payload
}

export function lcJson(method, body = {}) {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }
}

export function currentUserFromStorage() {
  try {
    const stored = JSON.parse(localStorage.getItem("user") || "null")
    return stored?.user || stored
  } catch {
    return null
  }
}

export const cleanId = (value) => value?._id || value || ""

export const pretty = (value) =>
  String(value || "—")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())

export function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
}

export function toDateInput(value) {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10)
}

export const todayInput = () => new Date().toISOString().slice(0, 10)

export function formatMoney(value, currency = "BDT") {
  return `${String(currency || "BDT").toUpperCase()} ${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function relationLabel(item, fallback = "—") {
  if (!item) return fallback
  const label = item.businessName || item.bankName || item.accountName || item.name || item.orderNo || item.billNo || item.code || fallback
  const secondary = item.code || item.shortName || item.accountNumber || ""
  return secondary && !String(label).includes(String(secondary)) ? `${label} (${secondary})` : label
}

export function lcDisplayNo(lc) {
  return lc?.lcNumber || lc?.applicationNo || "Commercial LC"
}

export function normalizeCollection(data, keys = []) {
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key]
  }
  return Array.isArray(data) ? data : []
}

export async function loadLCReferenceData() {
  const requests = await Promise.allSettled([
    lcRequest("/purchase/commercial-lcs/meta"),
    lcRequest("/purchase/commercial-lcs/import-meta"),
    lcRequest("/purchase/commercial-lcs/landed-cost-meta"),
    lcRequest("/purchase/purchase-orders?tradeType=import&limit=100"),
    lcRequest("/banks?limit=150&status=active"),
    lcRequest("/banks/accounts?limit=150&status=active"),
    lcRequest("/accounting/vendor-bills?limit=100"),
  ])
  const value = (index, fallback = {}) => requests[index].status === "fulfilled" ? requests[index].value : fallback
  return {
    lcMeta: value(0),
    importMeta: value(1),
    landedMeta: value(2),
    purchaseOrders: normalizeCollection(value(3), ["purchaseOrders", "orders", "items"]),
    banks: normalizeCollection(value(4), ["banks", "items"]),
    bankAccounts: normalizeCollection(value(5), ["accounts", "bankAccounts", "items"]),
    vendorBills: normalizeCollection(value(6), ["vendorBills", "bills", "items"]),
    failures: requests.filter((item) => item.status === "rejected").map((item) => item.reason),
  }
}
