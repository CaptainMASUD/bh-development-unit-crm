export function getDashboardPathForRole(role) {
  const normalizedRole = String(role || "").toLowerCase()

  if (normalizedRole === "admin" || normalizedRole === "superadmin") return "/admin"
  if (normalizedRole === "employee") return "/employee"

  return ""
}

export function getJwtExpirationMs(token) {
  if (!token || typeof token !== "string") return null

  try {
    const payloadPart = token.split(".")[1]
    if (!payloadPart) return null

    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
    const payload = JSON.parse(atob(padded))
    const expirationSeconds = Number(payload?.exp)

    return Number.isFinite(expirationSeconds) ? expirationSeconds * 1000 : null
  } catch {
    return null
  }
}
