const API_BASE = `${import.meta.env.VITE_API_URL}/api`

export function salesHeaders(extra = {}) {
  const token = localStorage.getItem("token")
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}

export async function salesRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: salesHeaders(options.headers),
  })
  const contentType = response.headers.get("content-type") || ""
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : await response.blob()
  if (!response.ok) {
    const error = new Error(payload?.message || "The Sales request could not be completed.")
    error.status = response.status
    error.details = payload?.details
    throw error
  }
  return payload
}

export function salesJson(method, body) {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  }
}

export const cleanId = (value) => value?._id || value || ""

export function formatMoney(value, currency = "BDT") {
  return `${currency || "BDT"} ${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })
}

export const pretty = (value) =>
  String(value || "—")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())

export function makeIdempotencyKey(prefix = "sales") {
  return globalThis.crypto?.randomUUID
    ? `${prefix}:${globalThis.crypto.randomUUID()}`
    : `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`
}
