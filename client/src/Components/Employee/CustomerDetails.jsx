"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import {
  FiArrowLeft,
  FiUsers,
  FiClipboard,
  FiRefreshCw,
  FiAlertCircle,
  FiMail,
  FiPhone,
  FiMapPin,
} from "react-icons/fi"
import toast, { Toaster } from "react-hot-toast"
import CustomerOverview from "./CustomerOverview"
import CustomerCRM from "./CustomerCRM"
import { hasPermission, PERMISSIONS } from "../Auth/permissions"

// ✅ banner image import
import bannerimg from "../../images/banner/legacy.png"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

function getAuthHeaders() {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

const cn = (...c) => c.filter(Boolean).join(" ")

function Badge({ children, tone = "gray" }) {
  const tones = {
    gray: "bg-gray-100 text-gray-700 border-gray-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    sky: "bg-sky-50 text-sky-700 border-sky-200",
  }
  const cls = tones[tone] || tones.gray
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold tracking-wide border",
        cls
      )}
    >
      {children}
    </span>
  )
}

function statusTone(status) {
  const s = String(status || "").toLowerCase()
  if (s === "complete") return "emerald"
  if (s === "in_progress") return "sky"
  if (s === "pending") return "amber"
  return "gray"
}

function customerTypeTone(customerType) {
  const s = String(customerType || "").toLowerCase()
  if (s === "returning") return "indigo"
  if (s === "new") return "emerald"
  return "gray"
}

function initials(name = "") {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return "C"
  const a = parts[0]?.[0] || "C"
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : ""
  return (a + b).toUpperCase()
}

const TabBtn = ({ active, icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors",
      active
        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
    )}
  >
    {icon} {label}
  </button>
)

function ContactCard({ icon, label, value, href }) {
  const inner = (
    <div
      className={cn(
        "h-full w-full rounded-2xl border border-gray-200 bg-white/90 backdrop-blur",
        "px-4 py-3 hover:bg-white transition",
        "flex items-center gap-3 shadow-sm"
      )}
    >
      <div className="w-10 h-10 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-700 shrink-0">
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-[12px] font-extrabold text-gray-500">{label}</p>
        <p className="text-sm font-extrabold text-gray-900 truncate">{value || "—"}</p>
      </div>
    </div>
  )

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="block flex-1 min-w-[240px]">
        {inner}
      </a>
    )
  }

  return <div className="block flex-1 min-w-[240px]">{inner}</div>
}

export default function CustomerDetails({ customerId, onBack }) {
  const [tab, setTab] = useState("overview")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [customer, setCustomer] = useState(null)

  const [me, setMe] = useState(null)
  const role = me?.user?.role || me?.role || null
  const isEmployee = role === "employee"
  const isAdmin = role === "admin" || role === "superadmin"
  const permissionUser = me?.user || me
  const canViewTasks = isAdmin || hasPermission(permissionUser, PERMISSIONS.TASKS_VIEW)
  const canManageTasks = isAdmin || hasPermission(permissionUser, PERMISSIONS.TASKS_MANAGE)
  const meId = me?.user?._id || me?._id || null

  const [crmRefreshNonce, setCrmRefreshNonce] = useState(0)

  const showToast = useCallback((msg, type = "success") => {
    const safeMessage = String(msg || "").trim()
    if (!safeMessage) return
    if (type === "error") toast.error(safeMessage)
    else toast.success(safeMessage)
  }, [])

  const fetchCustomer = useCallback(
    async ({ soft = false } = {}) => {
      if (!customerId) return
      if (!soft) setIsLoading(true)
      setError("")
      try {
        const res = await fetch(`${API_BASE}/customers/${customerId}`, { headers: getAuthHeaders() })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.message || "Failed to fetch customer")
        setCustomer(data?.customer || null)
      } catch (e) {
        setError(e?.message || "Failed to load customer.")
      } finally {
        setIsLoading(false)
      }
    },
    [customerId]
  )

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/users/me`, { headers: getAuthHeaders() })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to fetch me")
      setMe(data)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  useEffect(() => {
    setCustomer(null)
    setError("")
    fetchCustomer()
    setCrmRefreshNonce((n) => n + 1)
  }, [customerId, fetchCustomer])

  const assignedEmployees = useMemo(() => {
    const arr = Array.isArray(customer?.assignedTo) ? customer.assignedTo : []
    return arr
      .map((u) => {
        if (!u) return null
        if (typeof u === "string") return { _id: u, name: u }
        return { _id: u._id, name: u.name || u.fullName || u.email || "Employee", email: u.email }
      })
      .filter(Boolean)
  }, [customer])

  const isOwner = useMemo(() => {
    if (!meId || !customer) return false
    const createdById = String(customer?.createdBy?._id || customer?.createdBy || "")
    return createdById && String(meId) === createdById
  }, [meId, customer])

  const canManageCustomerFiles = isAdmin || isOwner

  const latestEngagement = useMemo(() => {
    const arr = Array.isArray(customer?.engagements) ? customer.engagements : []
    if (!arr.length) return null
    const sorted = arr.slice().sort((a, b) => Number(b?.year || 0) - Number(a?.year || 0))
    return sorted[0] || null
  }, [customer])

  const engagementYear = latestEngagement?.year || null

  const engagementTitle = useMemo(() => {
    if (!latestEngagement) return ""
    const t = String(latestEngagement?.engagementTitle || "").trim()
    if (t) return t
    return latestEngagement?.engagementTemplateId ? String(latestEngagement.engagementTemplateId) : ""
  }, [latestEngagement])

  const subEngagementTexts = useMemo(() => {
    const arr = Array.isArray(latestEngagement?.subEngagements) ? latestEngagement.subEngagements : []
    return arr.map((x) => String(x?.text || "").trim()).filter(Boolean)
  }, [latestEngagement])

  const emailHref = customer?.email ? `mailto:${customer.email}` : ""
  const phoneHref = customer?.phone ? `tel:${customer.phone}` : ""
  const mapHref = customer?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address)}`
    : ""

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-gray-50">
      <Toaster position="top-right" toastOptions={{ duration: 2600, style: { borderRadius: "14px", fontWeight: 700 } }} />

      {/* Cover */}
      <div className="relative">
        {/* ✅ Banner image with ONLY top-left & top-right rounded (design flow friendly) */}
        <div className="h-44 sm:h-56 w-full pointer-events-none relative overflow-hidden rounded-t-3xl">
          <img
            src={bannerimg}
            alt="Legacy banner"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* soft overlay for readability */}
          <div className="absolute inset-0 bg-black/10" />
          {/* subtle bottom glow */}
          <div className="absolute -bottom-12 left-0 right-0 h-24 bg-white/70 blur-2xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 pb-6">
          <div className="relative z-10 bg-white/90 backdrop-blur rounded-3xl shadow-xl border border-gray-100 p-4 sm:p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-20 h-20 rounded-3xl bg-white p-1 shadow-md">
                  <div className="w-full h-full rounded-2xl bg-gray-900 text-white flex items-center justify-center text-2xl font-extrabold">
                    {initials(customer?.name)}
                  </div>
                </div>

                <div className="min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 truncate">
                    {customer?.name || "Customer"}
                  </h1>
                  <p className="text-sm text-gray-600 mt-1 truncate">
                    {customer?.companyName || "—"} • {customer?.contactPerson?.name || "No contact person"}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {customer?.status ? (
                      <Badge tone={statusTone(customer.status)}>
                        {String(customer.status).replaceAll("_", " ").toUpperCase()}
                      </Badge>
                    ) : null}

                    {customer?.customerType ? (
                      <Badge tone={customerTypeTone(customer.customerType)}>
                        {String(customer.customerType).toUpperCase()}
                      </Badge>
                    ) : null}

                    {engagementYear ? <Badge tone="amber">ENGAGEMENT YEAR: {engagementYear}</Badge> : null}
                    {engagementTitle ? <Badge tone="indigo">ENGAGEMENT TYPE: {engagementTitle}</Badge> : null}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 justify-start lg:justify-end">
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold"
                >
                  <FiArrowLeft />
                  Back
                </button>

                <button
                  type="button"
                  onClick={() => {
                    fetchCustomer()
                    setCrmRefreshNonce((n) => n + 1)
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold shadow-sm"
                >
                  <FiRefreshCw />
                  Refresh
                </button>
              </div>
            </div>

            {/* contact row */}
            <div className="mt-5">
              <div className="flex flex-wrap items-stretch gap-3">
                <ContactCard icon={<FiMail />} label="Email" value={customer?.email || "—"} href={emailHref || undefined} />
                <ContactCard icon={<FiPhone />} label="Phone" value={customer?.phone || "—"} href={phoneHref || undefined} />
                <ContactCard
                  icon={<FiMapPin />}
                  label="Address"
                  value={customer?.address || "—"}
                  href={mapHref || undefined}
                />
              </div>
            </div>

            {subEngagementTexts.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {subEngagementTexts.map((t, i) => (
                  <span
                    key={`${t}-${i}`}
                    className="inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-extrabold bg-gray-50 text-gray-700 border border-gray-200"
                    title={t}
                  >
                    {t}
                  </span>
                ))}
              </div>
            ) : null}

            {/* tabs */}
            <div className="mt-6 flex flex-wrap gap-2">
              <TabBtn active={tab === "overview"} icon={<FiUsers />} label="Overview" onClick={() => setTab("overview")} />
              {canViewTasks ? <TabBtn active={tab === "crm"} icon={<FiClipboard />} label="CRM" onClick={() => setTab("crm")} /> : null}
            </div>

            {error ? (
              <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm flex items-start gap-2">
                <FiAlertCircle className="w-4 h-4 mt-0.5" />
                <span>{error}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <div className="mt-2">
          {tab === "overview" || !canViewTasks ? (
            <CustomerOverview
              customerId={customerId}
              customer={customer}
              loading={isLoading}
              canManageCustomerFiles={canManageCustomerFiles}
              onSoftRefreshCustomer={() => fetchCustomer({ soft: true })}
              setPageError={setError}
              showToast={showToast}
            />
          ) : (
            <CustomerCRM
              customerId={customerId}
              customer={customer}
              assignedEmployees={assignedEmployees}
              isAdmin={isAdmin}
              isEmployee={isEmployee}
              canManageTasks={canManageTasks}
              refreshNonce={crmRefreshNonce}
              onSoftRefreshCustomer={() => fetchCustomer({ soft: true })}
              setPageError={setError}
              showToast={showToast}
            />
          )}
        </div>
      </div>
    </div>
  )
}
