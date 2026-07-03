"use client"

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react"
import {
  FiRefreshCw,
  FiSearch,
  FiChevronLeft,
  FiChevronRight,
  FiUsers,
  FiX,
  FiAlertTriangle,
} from "react-icons/fi"
import toast, { Toaster } from "react-hot-toast"
import CustomerCRM from "./CustomerCRM"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

/* =================== FIXED LAYOUT =================== */
const fixedWorkspaceStyle = {
  height: "clamp(560px, calc(100dvh - 150px), 840px)",
}

/* =================== HELPERS =================== */
function getAuthHeaders() {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function statusPill(status) {
  const s = String(status || "pending")
  if (s === "done") return "bg-emerald-50 text-emerald-700 border border-emerald-200"
  if (s === "in_progress") return "bg-indigo-50 text-indigo-700 border border-indigo-200"
  return "bg-gray-100 text-gray-700 border border-gray-200"
}

function getRoleFromLocal() {
  const direct = localStorage.getItem("role")
  if (direct) return String(direct).toLowerCase()

  try {
    const u = JSON.parse(localStorage.getItem("user") || "null")
    if (u?.role) return String(u.role).toLowerCase()
  } catch {}

  return "admin"
}

function normalizeEmployees(input) {
  const arr = Array.isArray(input) ? input : []

  return arr
    .map((u) => {
      if (!u) return null

      if (typeof u === "string") {
        return { _id: u, name: u, email: "" }
      }

      const id = u._id || u.id
      if (!id) return null

      return {
        _id: String(id),
        name: u.name || u.fullName || u.email || "Employee",
        email: u.email || "",
      }
    })
    .filter(Boolean)
}

function normalizeAssignedToArray(assignedTo) {
  if (!assignedTo) return []
  if (Array.isArray(assignedTo)) return assignedTo
  return [assignedTo]
}

/* =================== API =================== */
async function fetchCustomersApi({ q = "" } = {}) {
  const qs = new URLSearchParams()
  if (q) qs.set("q", q)

  const res = await fetch(`${API_BASE}/customers?${qs.toString()}`, {
    headers: getAuthHeaders(),
    credentials: "include",
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data?.message || "Failed to load clients")
  }

  const list = Array.isArray(data?.customers)
    ? data.customers
    : Array.isArray(data)
      ? data
      : Array.isArray(data?.data)
        ? data.data
        : []

  return list
}

async function fetchCustomerApi(customerId, signal) {
  if (!customerId) return null

  const res = await fetch(`${API_BASE}/customers/${customerId}`, {
    headers: getAuthHeaders(),
    credentials: "include",
    signal,
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data?.message || "Failed to load client")
  }

  return data?.customer || data || null
}

async function fetchAssignedEmployeesApi(customerId, customerObj = null, signal) {
  const assignedTo = normalizeAssignedToArray(customerObj?.assignedTo)

  if (assignedTo.length) {
    return assignedTo
      .map((x) => (typeof x === "object" ? x : { _id: x, name: String(x) }))
      .filter(Boolean)
  }

  if (Array.isArray(customerObj?.assignedEmployees) && customerObj.assignedEmployees.length) {
    return customerObj.assignedEmployees
  }

  const res = await fetch(`${API_BASE}/customers/${customerId}/assigned-employees`, {
    headers: getAuthHeaders(),
    credentials: "include",
    signal,
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) return []

  return Array.isArray(data?.employees)
    ? data.employees
    : Array.isArray(data?.assignedEmployees)
      ? data.assignedEmployees
      : Array.isArray(data)
        ? data
        : []
}

/* =================== UI PIECES =================== */
function RoleHint({ isEmployee }) {
  return (
    <div
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold",
        isEmployee
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-indigo-200 bg-indigo-50 text-indigo-700",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-2 w-2 rounded-full",
          isEmployee ? "bg-amber-500" : "bg-indigo-600",
        ].join(" ")}
      />
      {isEmployee ? "Update mode" : "Management mode"}
    </div>
  )
}

function ErrorBanner({ message, onRetry }) {
  if (!message) return null

  return (
    <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-red-200 bg-white">
          <FiAlertTriangle className="text-red-700" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Something went wrong</p>
          <p className="mt-0.5 break-words text-sm">{message}</p>

          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-50"
            >
              <FiRefreshCw />
              Retry
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function ClientsSkeleton() {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-[72px] rounded-2xl border border-gray-100 bg-white px-4 py-3">
          <div className="h-4 w-2/3 rounded bg-gray-100" />
          <div className="mt-2 h-3 w-1/2 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  )
}

function DetailsSkeleton() {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6">
      <div className="h-5 w-1/3 rounded bg-gray-100" />
      <div className="mt-3 h-4 w-2/3 rounded bg-gray-100" />
      <div className="mt-8 space-y-3">
        <div className="h-4 w-full rounded bg-gray-100" />
        <div className="h-4 w-11/12 rounded bg-gray-100" />
        <div className="h-4 w-10/12 rounded bg-gray-100" />
      </div>
    </div>
  )
}

/* =================== CLIENT ROW =================== */
function ClientRow({ active, customer, onClick }) {
  const name = customer?.name || customer?.fullName || customer?.title || "Client"
  const sub = customer?.company || customer?.companyName || customer?.group || customer?.subtitle || ""
  const status = customer?.status || "pending"

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group relative h-[72px] w-full rounded-2xl border text-left transition-all duration-150",
        "focus:outline-none focus:ring-2 focus:ring-indigo-500/30",
        active
          ? "border-indigo-200 bg-indigo-50/70 shadow-sm"
          : "border-gray-100 bg-white hover:border-indigo-100 hover:bg-slate-50",
      ].join(" ")}
    >
      <span
        className={[
          "absolute bottom-2 left-0 top-2 w-1.5 rounded-r-2xl transition",
          active ? "bg-indigo-600" : "bg-transparent group-hover:bg-indigo-200",
        ].join(" ")}
      />

      <div className="flex h-full items-center justify-between gap-3 px-4 pl-5">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight text-gray-900">{name}</p>
          <p className="mt-1 truncate text-xs text-gray-500">{sub || "No company added"}</p>
        </div>

        <span
          className={[
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize",
            statusPill(status),
          ].join(" ")}
        >
          {String(status).replace("_", " ")}
        </span>
      </div>
    </button>
  )
}

/* =================== MAIN =================== */
export default function CustomerCRMInner({ openCustomerId, onSelectCustomer }) {
  const [pageError, setPageError] = useState("")

  const [customers, setCustomers] = useState([])
  const [customersLoading, setCustomersLoading] = useState(false)
  const [query, setQuery] = useState("")
  const [selectedCustomerId, setSelectedCustomerId] = useState(() => String(openCustomerId || ""))

  const [customerLoading, setCustomerLoading] = useState(false)
  const [customer, setCustomer] = useState(null)
  const [assignedEmployees, setAssignedEmployees] = useState([])

  const [refreshNonce, setRefreshNonce] = useState(0)

  const [customersCollapsed, setCustomersCollapsed] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  const role = useMemo(() => getRoleFromLocal(), [])
  const isAdmin = role !== "employee"
  const isEmployee = role === "employee"

  const mountedRef = useRef(true)
  const customerAbortRef = useRef(null)
  const queryDebounceRef = useRef(null)

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      if (customerAbortRef.current) {
        customerAbortRef.current.abort()
      }
    }
  }, [])

  const showToast = useCallback((msg, type = "success") => {
    const safeMessage = String(msg || "").trim()
    if (!safeMessage) return

    if (type === "error") toast.error(safeMessage)
    else toast.success(safeMessage)
  }, [])

  useEffect(() => {
    if (openCustomerId) {
      setSelectedCustomerId(String(openCustomerId))
    }
  }, [openCustomerId])

  const loadCustomers = useCallback(
    async ({ q = query } = {}) => {
      setPageError("")
      setCustomersLoading(true)

      try {
        const list = await fetchCustomersApi({ q })

        if (!mountedRef.current) return

        const arr = Array.isArray(list) ? list : []
        setCustomers(arr)

        const exists = arr.some((c) => String(c?._id || c?.id) === String(selectedCustomerId))

        if (!selectedCustomerId || !exists) {
          const firstId = String(arr?.[0]?._id || arr?.[0]?.id || "")
          setSelectedCustomerId(firstId)
        }
      } catch (e) {
        if (!mountedRef.current) return

        setCustomers([])
        setPageError(e?.message || "Failed to load clients.")
      } finally {
        if (mountedRef.current) {
          setCustomersLoading(false)
        }
      }
    },
    [query, selectedCustomerId]
  )

  const loadSelectedCustomer = useCallback(async (cid) => {
    const id = String(cid || "")

    if (!id) {
      setCustomer(null)
      setAssignedEmployees([])
      return
    }

    setCustomer(null)
    setAssignedEmployees([])
    setPageError("")
    setCustomerLoading(true)

    if (customerAbortRef.current) {
      customerAbortRef.current.abort()
    }

    const controller = new AbortController()
    customerAbortRef.current = controller

    try {
      const c = await fetchCustomerApi(id, controller.signal)

      if (!mountedRef.current) return

      setCustomer(c)

      const employeesRaw = await fetchAssignedEmployeesApi(id, c, controller.signal)

      if (!mountedRef.current) return

      setAssignedEmployees(normalizeEmployees(employeesRaw))
    } catch (e) {
      if (!mountedRef.current) return
      if (e?.name === "AbortError") return

      setCustomer(null)
      setAssignedEmployees([])
      setPageError(e?.message || "Failed to load client.")
    } finally {
      if (mountedRef.current) {
        setCustomerLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    loadCustomers({ q: "" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (queryDebounceRef.current) {
      clearTimeout(queryDebounceRef.current)
    }

    queryDebounceRef.current = setTimeout(() => {
      loadCustomers({ q: query })
    }, 300)

    return () => {
      if (queryDebounceRef.current) {
        clearTimeout(queryDebounceRef.current)
      }
    }
  }, [query, loadCustomers])

  useEffect(() => {
    loadSelectedCustomer(selectedCustomerId)
  }, [selectedCustomerId, loadSelectedCustomer])

  const onSoftRefreshCustomer = async () => {
    await loadSelectedCustomer(selectedCustomerId)
  }

  const doRefreshAll = async () => {
    await loadCustomers({ q: query })
    setRefreshNonce((n) => n + 1)
    await loadSelectedCustomer(selectedCustomerId)
    showToast("Refreshed")
  }

  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null

    return (
      customers.find((c) => String(c?._id || c?.id) === String(selectedCustomerId)) || null
    )
  }, [customers, selectedCustomerId])

  const customersCountLabel = useMemo(() => {
    const n = Array.isArray(customers) ? customers.length : 0
    if (!query) return `${n} client${n === 1 ? "" : "s"}`
    return `${n} match${n === 1 ? "" : "es"}`
  }, [customers, query])

  const clearSearch = () => setQuery("")

  const selectCustomer = (id) => {
    const customerId = String(id || "")
    setSelectedCustomerId(customerId)
    onSelectCustomer?.(customerId)
    setMobileDrawerOpen(false)
  }

  const TopBar = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-base font-bold text-gray-900">
          Jobs & Tasks — {selectedCustomer?.name || "Select a client"}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <RoleHint isEmployee={isEmployee} />

          <span className="text-xs text-gray-500">
            {isEmployee
              ? "Update progress and keep assigned work moving."
              : "Create, assign, and organize client work clearly."}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-indigo-600 bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 lg:hidden"
          title="Open clients"
        >
          <FiUsers className="h-4 w-4" />
          Clients
          <FiChevronRight className="h-4 w-4" />
        </button>

        {customersCollapsed ? (
          <button
            type="button"
            onClick={() => setCustomersCollapsed(false)}
            className="hidden items-center justify-center gap-2 rounded-2xl border border-indigo-600 bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 lg:inline-flex"
            title="Expand clients"
          >
            <FiUsers className="h-4 w-4" />
            Clients
            <FiChevronRight className="h-4 w-4" />
          </button>
        ) : null}

        <button
          type="button"
          onClick={doRefreshAll}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm hover:bg-slate-50"
          title="Refresh"
        >
          <FiRefreshCw />
          Refresh
        </button>
      </div>
    </div>
  )

  const ClientsPanel = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-xl">
      <div className="shrink-0 border-b border-gray-100 bg-white px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
              <FiUsers className="h-5 w-5" />
            </span>

            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900">Clients</p>
              <p className="mt-0.5 truncate text-[11px] text-gray-500">{customersCountLabel}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCustomersCollapsed(true)}
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-slate-50 lg:flex"
            title="Minimize clients"
            aria-label="Minimize clients"
          >
            <FiChevronLeft />
          </button>

          <button
            type="button"
            onClick={() => setMobileDrawerOpen(false)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-slate-50 lg:hidden"
            title="Close"
            aria-label="Close"
          >
            <FiX />
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-gray-100 bg-slate-50 p-2">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-10 text-sm font-normal outline-none transition focus:border-transparent focus:ring-2 focus:ring-indigo-500/30"
              placeholder="Search clients..."
              aria-label="Search clients"
            />

            {query ? (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-slate-50"
                aria-label="Clear search"
                title="Clear"
              >
                <FiX />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50/70">
        {customersLoading ? (
          <ClientsSkeleton />
        ) : customers?.length ? (
          <div className="space-y-2 p-3">
            {customers.map((c) => {
              const id = String(c?._id || c?.id || "")

              return (
                <ClientRow
                  key={id}
                  customer={c}
                  active={String(selectedCustomerId) === id}
                  onClick={() => selectCustomer(id)}
                />
              )
            })}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <div>
              <p className="text-sm font-bold text-gray-900">No clients found</p>
              <p className="mt-1 text-sm text-gray-500">Try a different search.</p>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-gray-100 bg-white p-3">
        <button
          type="button"
          onClick={doRefreshAll}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm hover:bg-slate-50"
          title="Refresh"
        >
          <FiRefreshCw />
          Refresh clients
        </button>
      </div>
    </div>
  )

  return (
    <div className="w-full">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 2600,
          style: {
            borderRadius: "14px",
            fontWeight: 700,
          },
        }}
      />

      {mobileDrawerOpen ? (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileDrawerOpen(false)}
            aria-hidden="true"
          />

          <div className="absolute inset-y-0 left-0 w-[92%] max-w-sm p-3">
            <div style={{ height: "calc(100dvh - 24px)" }}>{ClientsPanel}</div>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 gap-4" style={fixedWorkspaceStyle}>
        <div
          className={[
            "hidden h-full shrink-0 overflow-hidden transition-[width,opacity,transform] duration-300 ease-in-out lg:block",
            customersCollapsed
              ? "w-0 -translate-x-2 opacity-0"
              : "w-full max-w-sm translate-x-0 opacity-100 lg:w-96",
          ].join(" ")}
        >
          {ClientsPanel}
        </div>

        <div className="h-full min-w-0 flex-1">
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-xl">
            <div className="shrink-0 border-b border-gray-100 bg-white px-4 py-4 sm:px-6">
              {TopBar}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50 p-4 sm:p-6">
              <ErrorBanner message={pageError} onRetry={() => loadCustomers({ q: query })} />

              {customerLoading ? (
                <DetailsSkeleton />
              ) : !selectedCustomerId ? (
                <div className="flex h-full items-center justify-center rounded-3xl border border-gray-100 bg-white p-10 text-center">
                  <div>
                    <p className="text-sm font-bold text-gray-900">Pick a client</p>
                    <p className="mt-1 text-sm text-gray-500">
                      Open the client list and choose who you want to work on.
                    </p>

                    <div className="mt-5 flex justify-center">
                      <button
                        type="button"
                        onClick={() => setMobileDrawerOpen(true)}
                        className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700 lg:hidden"
                      >
                        <FiUsers />
                        Open clients
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <CustomerCRM
                  customerId={selectedCustomerId}
                  customer={customer}
                  assignedEmployees={assignedEmployees}
                  isAdmin={isAdmin}
                  isEmployee={isEmployee}
                  refreshNonce={refreshNonce}
                  onSoftRefreshCustomer={onSoftRefreshCustomer}
                  setPageError={setPageError}
                  showToast={showToast}
                />
              )}
            </div>
          </div>

          {customersCollapsed ? (
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
              <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-1 shadow-sm">
                Clients minimized
              </span>
              <span>•</span>
              <span>Use “Clients” to open the list.</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}