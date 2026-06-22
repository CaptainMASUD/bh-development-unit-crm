import axios from "axios"

export const SESSION_EXPIRED_EVENT = "businesshub:session-expired"

export function notifySessionExpired() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT))
}

export function installSessionExpiryInterceptors() {
  if (typeof window === "undefined" || window.__businessHubSessionInterceptorsInstalled) return
  window.__businessHubSessionInterceptorsInstalled = true

  const originalFetch = window.fetch.bind(window)
  window.fetch = async (...args) => {
    const response = await originalFetch(...args)
    if (response.status === 401 && localStorage.getItem("token")) notifySessionExpired()
    return response
  }

  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error?.response?.status === 401 && localStorage.getItem("token")) {
        notifySessionExpired()
      }
      return Promise.reject(error)
    }
  )
}
