const configuredBase = String(import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "")
export const ADMINISTRATION_API_BASE = `${configuredBase}/api/administration`

const defaultStorage = () => (typeof localStorage === "undefined" ? null : localStorage)

export function buildAdministrationHeaders({ token = "", json = false, headers = {} } = {}) {
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  }
}

export async function administrationRequest(path, {
  method = "GET",
  body,
  headers,
  fetchImpl = fetch,
  storage = defaultStorage(),
} = {}) {
  const token = storage?.getItem?.("token") || ""
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData
  const response = await fetchImpl(`${ADMINISTRATION_API_BASE}${path}`, {
    method,
    credentials: "include",
    headers: buildAdministrationHeaders({ token, json: body !== undefined && !isFormData, headers }),
    ...(body !== undefined ? { body: isFormData || typeof body === "string" ? body : JSON.stringify(body) } : {}),
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw Object.assign(new Error(payload.message || "Administration request failed."), {
      status: response.status,
      payload,
    })
  }
  return payload
}

export const administrationApi = {
  get: (path, options) => administrationRequest(path, options),
  post: (path, body, options) => administrationRequest(path, { ...options, method: "POST", body }),
  patch: (path, body, options) => administrationRequest(path, { ...options, method: "PATCH", body }),
  upload: (path, formData, options) => administrationRequest(path, { ...options, method: "PUT", body: formData }),
  remove: (path, bodyOrOptions, options) => {
    const hasBody = bodyOrOptions && typeof bodyOrOptions === "object" && !("headers" in bodyOrOptions) && !("fetchImpl" in bodyOrOptions);
    const body = hasBody ? bodyOrOptions : undefined;
    const opts = hasBody ? options : bodyOrOptions;
    return administrationRequest(path, { ...opts, method: "DELETE", body });
  },
}
