"use client"

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { FiRefreshCw, FiSearch, FiChevronLeft, FiChevronRight, FiUsers, FiX, FiAlertTriangle } from "react-icons/fi"
import CustomerCRM from "./CustomerCRM"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

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

function safeText(v) {
  return String(v ?? "").trim()
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

/** normalize any employee shape into: { _id, name, email } */
function normalizeEmployees(input) {
  const arr = Array.isArray(input) ? input : []
  return arr
    .map((u) => {
      if (!u) return null
      if (typeof u === "string") return { _id: u, name: u, email: "" }
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

/** normalize assigned list that might be string IDs or objects */
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
  if (!res.ok) throw new Error(data?.message || "Failed to load clients")

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
  if (!res.ok) throw new Error(data?.message || "Failed to load client")
  return data?.customer || data || null
}

/**
 * Pull assigned employees from:
 *  - customer.assignedTo
 *  - customer.assignedEmployees
 *  - /assigned-employees (fallback)
 */
async function fetchAssignedEmployeesApi(customerId, customerObj = null, signal) {
  const assignedTo = normalizeAssignedToArray(customerObj?.assignedTo)
  if (assignedTo.length) {
    const objs = assignedTo
      .map((x) => (typeof x === "object" ? x : { _id: x, name: String(x) }))
      .filter(Boolean)
    return objs
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
function Toast({ message }) {
  if (!message) return null
  return (
    <div className="fixed top-4 right-4 z-[90]">
      <div className="rounded-2xl bg-gray-900 text-white px-4 py-3 shadow-2xl border border-white/10 text-sm font-semibold">
        {message}
      </div>
    </div>
  )
}

function RoleHint({ isEmployee }) {
  return (
    <div
      className={[
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-extrabold border",
        isEmployee ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-indigo-50 text-indigo-700 border-indigo-200",
      ].join(" ")}
    >
      <span className={["inline-block w-2 h-2 rounded-full", isEmployee ? "bg-amber-500" : "bg-indigo-600"].join(" ")} />
      {isEmployee ? "Update mode" : "Management mode"}
    </div>
  )
}

function ErrorBanner({ message, onRetry }) {
  if (!message) return null
  return (
    <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white border border-red-200">
          <FiAlertTriangle className="text-red-700" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold">Something went wrong</p>
          <p className="text-sm mt-0.5 break-words">{message}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-800 hover:bg-red-50"
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
    <div className="p-3 space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-gray-100 bg-white px-4 py-3">
          <div className="h-4 w-2/3 bg-gray-100 rounded" />
          <div className="mt-2 h-3 w-1/2 bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  )
}

function DetailsSkeleton() {
  return (
    <div className="p-4 sm:p-6">
      <div className="rounded-3xl border border-gray-100 bg-white p-6">
        <div className="h-5 w-1/3 bg-gray-100 rounded" />
        <div className="mt-3 h-4 w-2/3 bg-gray-100 rounded" />
        <div className="mt-8 space-y-3">
          <div className="h-4 w-full bg-gray-100 rounded" />
          <div className="h-4 w-11/12 bg-gray-100 rounded" />
          <div className="h-4 w-10/12 bg-gray-100 rounded" />
        </div>
      </div>
    </div>
  )
}

/* =================== CLIENT ROW =================== */
function ClientRow({ active, customer, onClick }) {
  const name = customer?.name || customer?.fullName || customer?.title || "Client"
  const sub = customer?.company || customer?.companyName || customer?.group || customer?.subtitle || ""
  const status = customer?.status || "pending"

  // Fixed height row for consistent scanning
  // Left "selected" bar restored (like your old UI)
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group relative w-full text-left rounded-2xl border transition-all duration-150",
        "focus:outline-none focus:ring-2 focus:ring-indigo-500/30",
        active ? "border-indigo-200 bg-indigo-50/60" : "border-gray-100 bg-white hover:bg-slate-50",
      ].join(" ")}
      style={{ height: 72 }} // ✅ fixed height card
    >
      {/* ✅ old selected indicator bar */}
      <span
        className={[
          "absolute left-0 top-2 bottom-2 w-1.5 rounded-r-2xl transition",
          active ? "bg-indigo-600" : "bg-transparent group-hover:bg-indigo-200",
        ].join(" ")}
      />

      <div className="h-full px-4 pl-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-extrabold text-gray-900 truncate leading-tight">{name}</p>
          <p className="text-xs text-gray-500 truncate mt-0.5">{sub || "—"}</p>
        </div>

        <span className={["shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full border", statusPill(status)].join(" ")}>
          {String(status)}
        </span>
      </div>
    </button>
  )
}

/* =================== MAIN =================== */
export default function CustomerCRMInner() {
  const [pageError, setPageError] = useState("")
  const [toast, setToast] = useState("")

  const [customers, setCustomers] = useState([])
  const [customersLoading, setCustomersLoading] = useState(false)
  const [query, setQuery] = useState("")
  const [selectedCustomerId, setSelectedCustomerId] = useState("")

  const [customerLoading, setCustomerLoading] = useState(false)
  const [customer, setCustomer] = useState(null)
  const [assignedEmployees, setAssignedEmployees] = useState([])

  const [refreshNonce, setRefreshNonce] = useState(0)

  // Desktop collapse + mobile drawer
  const [customersCollapsed, setCustomersCollapsed] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  const role = useMemo(() => getRoleFromLocal(), [])
  const isAdmin = role !== "employee"
  const isEmployee = role === "employee"

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const customerAbortRef = useRef(null)
  const queryDebounceRef = useRef(null)

  const showToast = useCallback((msg) => setToast(String(msg || "")), [])

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
        if (mountedRef.current) setCustomersLoading(false)
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

    if (customerAbortRef.current) customerAbortRef.current.abort()
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
      if (mountedRef.current) setCustomerLoading(false)
    }
  }, [])

  // initial
  useEffect(() => {
    loadCustomers({ q: "" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // debounced server search
  useEffect(() => {
    if (queryDebounceRef.current) clearTimeout(queryDebounceRef.current)
    queryDebounceRef.current = setTimeout(() => {
      loadCustomers({ q: query })
    }, 300)

    return () => {
      if (queryDebounceRef.current) clearTimeout(queryDebounceRef.current)
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
    setTimeout(() => showToast(""), 1600)
  }

  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null
    return customers.find((c) => String(c?._id || c?.id) === String(selectedCustomerId)) || null
  }, [customers, selectedCustomerId])

  const customersCountLabel = useMemo(() => {
    const n = Array.isArray(customers) ? customers.length : 0
    if (!query) return `${n} client${n === 1 ? "" : "s"}`
    return `${n} match${n === 1 ? "" : "es"}`
  }, [customers, query])

  const clearSearch = () => setQuery("")
  const selectCustomer = (id) => {
    setSelectedCustomerId(String(id || ""))
    setMobileDrawerOpen(false)
  }

  const TopBar = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-base font-extrabold text-gray-900 truncate">
          Jobs & Tasks — {selectedCustomer?.name || "Select a client"}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <RoleHint isEmployee={isEmployee} />
          <span className="text-xs text-gray-500">
            {isEmployee ? "Update progress and keep work moving." : "Create, assign, and organize work clearly."}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Mobile: open clients */}
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="lg:hidden inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-extrabold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm border border-indigo-600"
          title="Open clients"
        >
          <FiUsers className="w-4 h-4" />
          Clients
          <FiChevronRight className="w-4 h-4" />
        </button>

        {/* Desktop: expand if collapsed */}
        {customersCollapsed ? (
          <button
            type="button"
            onClick={() => setCustomersCollapsed(false)}
            className="hidden lg:inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-extrabold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm border border-indigo-600"
            title="Expand clients"
          >
            <FiUsers className="w-4 h-4" />
            Clients
            <FiChevronRight className="w-4 h-4" />
          </button>
        ) : null}

        <button
          type="button"
          onClick={doRefreshAll}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl border border-gray-200 bg-white hover:bg-slate-50 text-sm font-semibold text-gray-800 shadow-sm"
          title="Refresh"
        >
          <FiRefreshCw />
          Refresh
        </button>
      </div>
    </div>
  )

  const ClientsPanel = (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between gap-3 bg-white">
        <div className="min-w-0 flex items-center gap-2">
          {/* ✅ filled background icon */}
          <span className="inline-flex w-10 h-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
            <FiUsers className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-gray-900">Clients</p>
            <p className="text-[11px] text-gray-500 mt-0.5 truncate">{customersCountLabel}</p>
          </div>
        </div>

        {/* Desktop collapse */}
        <button
          type="button"
          onClick={() => setCustomersCollapsed(true)}
          className="hidden lg:flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white hover:bg-slate-50 text-gray-700 shadow-sm shrink-0"
          title="Minimize clients"
          aria-label="Minimize clients"
        >
          <FiChevronLeft />
        </button>

        {/* Mobile close */}
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(false)}
          className="lg:hidden h-10 w-10 flex items-center justify-center rounded-2xl border border-gray-200 bg-white hover:bg-slate-50 text-gray-700 shadow-sm shrink-0"
          title="Close"
          aria-label="Close"
        >
          <FiX />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-4 border-b border-gray-100 bg-white">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-10 py-2.5 rounded-2xl border border-gray-200 bg-white focus:ring-2 focus:ring-indigo-500/30 focus:border-transparent text-sm outline-none shadow-sm"
            placeholder="Search clients…"
            aria-label="Search clients"
          />
          {query ? (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-xl border border-gray-200 bg-white hover:bg-slate-50 flex items-center justify-center text-gray-700"
              aria-label="Clear search"
              title="Clear"
            >
              <FiX />
            </button>
          ) : null}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 min-h-0">
        {customersLoading ? (
          <ClientsSkeleton />
        ) : customers?.length ? (
          <div className="p-3 space-y-2 overflow-auto h-full">
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
          <div className="p-8 text-center">
            <p className="text-sm font-extrabold text-gray-900">No clients found</p>
            <p className="text-sm text-gray-500 mt-1">Try a different search.</p>
          </div>
        )}
      </div>

      {/* Footer quick actions */}
      <div className="p-3 border-t border-gray-100 bg-white">
        <button
          type="button"
          onClick={doRefreshAll}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl border border-gray-200 bg-white hover:bg-slate-50 text-sm font-semibold text-gray-800 shadow-sm"
          title="Refresh"
        >
          <FiRefreshCw />
          Refresh
        </button>
      </div>
    </div>
  )

  return (
    <div className="w-full">
      <Toast message={toast} />

      {/* Mobile drawer */}
      {mobileDrawerOpen ? (
        <div className="lg:hidden fixed inset-0 z-[80]">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileDrawerOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 w-[92%] max-w-sm p-3">{ClientsPanel}</div>
        </div>
      ) : null}

      <div className="flex gap-4">
        {/* LEFT (desktop) */}
        <div
          className={[
            "hidden lg:block shrink-0 transition-[width,opacity,transform] duration-300 ease-in-out overflow-hidden",
            customersCollapsed ? "w-0 opacity-0 -translate-x-2" : "w-full max-w-sm lg:w-96 opacity-100 translate-x-0",
          ].join(" ")}
        >
          {ClientsPanel}
        </div>

        {/* RIGHT */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100 bg-white">{TopBar}</div>

            <div className="p-4 sm:p-6 bg-slate-50">
              <ErrorBanner message={pageError} onRetry={() => loadCustomers({ q: query })} />

              {customerLoading ? (
                <DetailsSkeleton />
              ) : !selectedCustomerId ? (
                <div className="rounded-3xl border border-gray-100 bg-white p-10 text-center">
                  <p className="text-sm font-extrabold text-gray-900">Pick a client</p>
                  <p className="text-sm text-gray-500 mt-1">Open the client list and choose who you want to work on.</p>
                  <div className="mt-5 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setMobileDrawerOpen(true)}
                      className="lg:hidden inline-flex items-center gap-2 rounded-2xl bg-indigo-600 text-white px-5 py-3 text-sm font-extrabold hover:bg-indigo-700"
                    >
                      <FiUsers />
                      Open clients
                    </button>
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
                  showToast={(msg) => {
                    showToast(msg)
                    setTimeout(() => showToast(""), 1400)
                  }}
                />
              )}
            </div>
          </div>

          {customersCollapsed ? (
            <div className="mt-3 text-xs text-gray-500 flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-gray-200 bg-white shadow-sm">
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
