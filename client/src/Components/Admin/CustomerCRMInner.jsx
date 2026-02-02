"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { FiRefreshCw, FiSearch, FiChevronLeft, FiChevronRight, FiUsers } from "react-icons/fi"
import CustomerCRM from "./CustomerCRM" // <-- adjust path if needed

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
  } catch {
    // ignore
  }
  return "admin"
}

/* =================== API =================== */
async function fetchCustomersApi({ q = "" } = {}) {
  const qs = new URLSearchParams()
  if (q) qs.set("q", q)

  const res = await fetch(`${API_BASE}/customers?${qs.toString()}`, {
    headers: getAuthHeaders(),
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

async function fetchCustomerApi(customerId) {
  if (!customerId) return null
  const res = await fetch(`${API_BASE}/customers/${customerId}`, {
    headers: getAuthHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to load client")
  return data?.customer || data || null
}

async function fetchAssignedEmployeesApi(customerId, customerObj = null) {
  const embedded =
    customerObj && Array.isArray(customerObj?.assignedEmployees) ? customerObj.assignedEmployees : null
  if (embedded) return embedded

  const res = await fetch(`${API_BASE}/customers/${customerId}/assigned-employees`, {
    headers: getAuthHeaders(),
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

/* =================== TOAST =================== */
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
        "relative w-full text-left px-4 py-3 rounded-2xl border transition-all duration-200",
        "hover:shadow-md hover:-translate-y-[1px] transform-gpu",
        active
          ? "bg-indigo-50/70 border-indigo-200 shadow-sm"
          : "bg-white border-gray-100 hover:bg-slate-50",
      ].join(" ")}
    >
      {/* ✅ left soft stripe */}
      <span
        className={[
          "absolute left-0 top-2 bottom-2 w-1.5 rounded-r-2xl transition",
          active ? "bg-indigo-600" : "bg-transparent",
        ].join(" ")}
      />

      <div className="pl-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-extrabold text-gray-900 truncate">{name}</p>
          <p className="text-xs text-gray-500 truncate">{sub || "—"}</p>
        </div>

        <span
          className={[
            "shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full border",
            statusPill(status),
          ].join(" ")}
        >
          {String(status)}
        </span>
      </div>
    </button>
  )
}

/* =================== HEADER BADGE =================== */
function RoleHint({ isEmployee }) {
  // ✅ user-friendly, not "programming" text
  return (
    <div
      className={[
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-extrabold border",
        isEmployee
          ? "bg-amber-50 text-amber-800 border-amber-200"
          : "bg-indigo-50 text-indigo-700 border-indigo-200",
      ].join(" ")}
      title={isEmployee ? "You can update task status." : "You can manage jobs and tasks."}
    >
      <span className={["inline-block w-2 h-2 rounded-full", isEmployee ? "bg-amber-500" : "bg-indigo-600"].join(" ")} />
      {isEmployee ? "Status update mode" : "Management mode"}
    </div>
  )
}

/* =================== MAIN =================== */
export default function CustomerCRMInner() {
  const [pageError, setPageError] = useState("")
  const [toast, setToast] = useState("")

  // Clients list
  const [customers, setCustomers] = useState([])
  const [customersLoading, setCustomersLoading] = useState(false)
  const [query, setQuery] = useState("")
  const [selectedCustomerId, setSelectedCustomerId] = useState("")

  // Selected client data
  const [customerLoading, setCustomerLoading] = useState(false)
  const [customer, setCustomer] = useState(null)
  const [assignedEmployees, setAssignedEmployees] = useState([])

  // Refresh nonce triggers CustomerCRM to refetch jobs/tasks
  const [refreshNonce, setRefreshNonce] = useState(0)

  // ✅ Clients panel collapse
  const [customersCollapsed, setCustomersCollapsed] = useState(false)

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

  const showToast = (msg) => setToast(String(msg || ""))

  const loadCustomers = async ({ q = query } = {}) => {
    setPageError("")
    setCustomersLoading(true)
    try {
      const list = await fetchCustomersApi({ q })
      if (!mountedRef.current) return
      setCustomers(Array.isArray(list) ? list : [])
      if (!selectedCustomerId && list?.length) {
        setSelectedCustomerId(String(list[0]?._id || list[0]?.id || ""))
      }
    } catch (e) {
      if (!mountedRef.current) return
      setCustomers([])
      setPageError(e?.message || "Failed to load clients.")
    } finally {
      if (mountedRef.current) setCustomersLoading(false)
    }
  }

  const loadSelectedCustomer = async (cid) => {
    const id = String(cid || "")
    if (!id) {
      setCustomer(null)
      setAssignedEmployees([])
      return
    }

    setPageError("")
    setCustomerLoading(true)
    try {
      const c = await fetchCustomerApi(id)
      if (!mountedRef.current) return
      setCustomer(c)

      const employees = await fetchAssignedEmployeesApi(id, c)
      if (!mountedRef.current) return
      setAssignedEmployees(Array.isArray(employees) ? employees : [])
    } catch (e) {
      if (!mountedRef.current) return
      setCustomer(null)
      setAssignedEmployees([])
      setPageError(e?.message || "Failed to load client.")
    } finally {
      if (mountedRef.current) setCustomerLoading(false)
    }
  }

  useEffect(() => {
    loadCustomers({ q: "" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadSelectedCustomer(selectedCustomerId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomerId])

  const onSoftRefreshCustomer = async () => {
    await loadSelectedCustomer(selectedCustomerId)
  }

  const doRefreshAll = async () => {
    await loadCustomers({ q: query })
    setRefreshNonce((n) => n + 1)
    await loadSelectedCustomer(selectedCustomerId)
    showToast("Refreshed")
    setTimeout(() => showToast(""), 2000)
  }

  const filteredCustomers = useMemo(() => {
    const q = safeText(query).toLowerCase()
    if (!q) return customers
    return (customers || []).filter((c) => {
      const name = safeText(c?.name || c?.fullName || c?.title).toLowerCase()
      const sub = safeText(c?.company || c?.companyName || c?.group || c?.subtitle).toLowerCase()
      return name.includes(q) || sub.includes(q)
    })
  }, [customers, query])

  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null
    return customers.find((c) => String(c?._id || c?.id) === String(selectedCustomerId)) || null
  }, [customers, selectedCustomerId])

  return (
    <div className="w-full">
      <Toast message={toast} />

      <div className="flex gap-4">
        {/* LEFT: Clients panel (premium + smooth minimize) */}
        <div
          className={[
            "transition-[width,opacity,transform] duration-300 ease-in-out overflow-hidden shrink-0",
            customersCollapsed ? "w-0 opacity-0 -translate-x-2" : "w-full max-w-sm lg:w-96 opacity-100 translate-x-0",
          ].join(" ")}
        >
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
            <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between gap-3 bg-gradient-to-b from-indigo-50/60 to-white">
              <div className="min-w-0 flex items-center gap-2">
                <span className="inline-flex w-10 h-10 items-center justify-center rounded-2xl bg-white border border-indigo-100 text-indigo-700 shadow-sm">
                  <FiUsers className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-gray-900">Clients</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                    Choose a client to view jobs & tasks
                  </p>
                </div>
              </div>

              {/* minimize */}
              <button
                type="button"
                onClick={() => setCustomersCollapsed(true)}
                className="h-10 w-10 flex items-center justify-center rounded-2xl border border-gray-200 bg-white hover:bg-slate-50 text-gray-700 shadow-sm shrink-0"
                title="Minimize clients"
                aria-label="Minimize clients"
              >
                <FiChevronLeft />
              </button>
            </div>

            <div className="px-4 pb-4 pt-4">
              {/* ✅ Soft search look, no inner black outline */}
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-2xl border border-gray-200 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm outline-none shadow-sm"
                  placeholder="Search client..."
                />
              </div>
            </div>

            <div className="px-3 pb-4">
              {customersLoading ? (
                <div className="p-6 text-sm text-gray-500 text-center">Loading clients...</div>
              ) : filteredCustomers?.length ? (
                <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
                  {filteredCustomers.map((c) => {
                    const id = String(c?._id || c?.id || "")
                    return (
                      <ClientRow
                        key={id}
                        customer={c}
                        active={String(selectedCustomerId) === id}
                        onClick={() => setSelectedCustomerId(id)}
                      />
                    )
                  })}
                </div>
              ) : (
                <div className="p-6 text-sm text-gray-500 text-center">No clients found.</div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Jobs & Tasks */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gradient-to-b from-slate-50/70 to-white">
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-gray-900 truncate">
                  Jobs & Tasks — {selectedCustomer?.name || "—"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <RoleHint isEmployee={isEmployee} />
                  <span className="text-xs text-gray-500">
                    {isEmployee ? "Update progress and keep work moving." : "Create and organize work clearly."}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {/* ✅ When minimized: show Clients button with bg color */}
                {customersCollapsed ? (
                  <button
                    type="button"
                    onClick={() => setCustomersCollapsed(false)}
                    className={[
                      "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-extrabold",
                      "bg-indigo-600 text-white hover:bg-indigo-700",
                      "shadow-lg shadow-indigo-600/15",
                      "border border-indigo-600",
                    ].join(" ")}
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

            <div className="p-4 sm:p-6 bg-slate-50/50">
              {pageError ? (
                <div className="mb-4 p-4 rounded-2xl border border-red-200 bg-red-50 text-red-700 text-sm font-semibold">
                  {pageError}
                </div>
              ) : null}

              {customerLoading ? (
                <div className="p-10 text-center text-gray-500 text-sm">Loading client...</div>
              ) : !selectedCustomerId ? (
                <div className="p-10 text-center text-gray-500 text-sm">Select a client to view jobs & tasks.</div>
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
                  showToast={(msg) => showToast(msg)}
                />
              )}
            </div>
          </div>

          {/* subtle hint row when minimized */}
          {customersCollapsed ? (
            <div className="mt-3 text-xs text-gray-500 flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-gray-200 bg-white shadow-sm">
                Clients minimized
              </span>
              <span>•</span>
              <span>Tap “Clients” above to open the list.</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
