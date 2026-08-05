"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useSelector } from "react-redux"
import toast, { Toaster } from "react-hot-toast"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Activity01Icon,
  Add01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Calendar03Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  File02Icon,
  FilterIcon,
  MoreVerticalIcon,
  PencilEdit02Icon,
  RefreshIcon,
  Search01Icon,
  SecurityCheckIcon,
  UserIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons"
import CompanyBranchesModal from "./CompanyBranchesModal"
import { hasPermission } from "../../Auth/permissions"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const PAGE_SIZE = 20
const REQUIRED_MODULE_IDS = new Set(["administration"])
const MODULE_DEPENDENCIES = {
  supplier: ["inventory"],
  purchase: ["supplier", "inventory"],
  payroll: ["accounting"],
}

function normalizeModuleSelection(values = []) {
  const selected = new Set([...values.map(String), ...REQUIRED_MODULE_IDS])
  let changed = true
  while (changed) {
    changed = false
    for (const moduleId of [...selected]) {
      for (const dependency of MODULE_DEPENDENCIES[moduleId] || []) {
        if (!selected.has(dependency)) {
          selected.add(dependency)
          changed = true
        }
      }
    }
  }
  return [...selected]
}

function removeModuleAndDependents(values, removedId) {
  const selected = new Set(values.map(String))
  selected.delete(String(removedId))
  let changed = true
  while (changed) {
    changed = false
    for (const moduleId of [...selected]) {
      if ((MODULE_DEPENDENCIES[moduleId] || []).some((dependency) => !selected.has(dependency))) {
        selected.delete(moduleId)
        changed = true
      }
    }
  }
  for (const required of REQUIRED_MODULE_IDS) selected.add(required)
  return [...selected]
}

/*
  Expected API contract. Rename these paths to match your backend.

  GET    /companies
  POST   /companies
  PATCH  /companies/:id
  PATCH  /companies/:id/status
  GET    /erp-modules?active=true

  Company module access is a tenant/company entitlement.
  User role permissions should be managed separately inside each enabled module.
*/
const ENDPOINTS = {
  companies: "/companies",
  modules: "/erp-modules",
}

const shell = "min-h-screen bg-[#f7f8fb]"
const card =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_16px_45px_-32px_rgba(15,23,42,0.45)]"
const btn =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
const btnPrimary = "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
const btnGhost = "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
const btnDanger = "bg-rose-600 text-white hover:bg-rose-700"
const iconBtn =
  "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50"
const input =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/15"
const textarea =
  "min-h-28 w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/15"
const softInput =
  "h-10 w-full border-0 bg-transparent px-1 text-sm font-semibold text-gray-800 outline-none placeholder:text-gray-400 focus:outline-none focus:ring-0"

const defaultFilters = {
  status: "all",
  plan: "",
  country: "",
}

const planOptions = ["Starter", "Professional", "Enterprise", "Custom"]
const industryOptions = [
  "Technology",
  "Retail",
  "Textile & Garments",
  "Manufacturing",
  "Professional Services",
  "Education",
  "Healthcare",
  "Construction",
  "Logistics",
  "Other",
]

function today() {
  return new Date().toISOString().slice(0, 10)
}

function defaultSubscriptionEnd() {
  const date = new Date()
  date.setFullYear(date.getFullYear() + 1)
  date.setDate(date.getDate() - 1)
  return date.toISOString().slice(0, 10)
}

function createEmptyForm() {
  return {
    name: "",
    legalName: "",
    code: "",
    industry: "",
    registrationNo: "",
    taxId: "",
    email: "",
    phone: "",
    website: "",
    logoUrl: "",
    address: {
      line1: "",
      line2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "Bangladesh",
      latitude: "",
      longitude: "",
    },
    headOffice: {
      name: "Head Office",
      code: "HO",
      email: "",
      phone: "",
    },
    manager: {
      name: "",
      email: "",
      phone: "",
      designation: "Company Manager",
      password: "",
    },
    settings: {
      currency: "BDT",
      timezone: "Asia/Dhaka",
      fiscalYearStart: "01-01",
      dateFormat: "DD/MM/YYYY",
    },
    subscription: {
      plan: "Professional",
      startDate: today(),
      endDate: defaultSubscriptionEnd(),
    },
    moduleIds: [],
    status: "active",
    note: "",
  }
}

function HIcon({ icon, size = 18, className = "" }) {
  return (
    <HugeiconsIcon
      icon={icon}
      size={size}
      color="currentColor"
      strokeWidth={1.8}
      className={className}
      aria-hidden="true"
    />
  )
}

function LocationPin({ className = "h-5 w-5" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}

function BuildingIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 21V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16" />
      <path d="M17 9h2a1 1 0 0 1 1 1v11" />
      <path d="M8 7h5M8 11h5M8 15h5M8 19h5M2 21h20" />
    </svg>
  )
}

function BranchIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="6" cy="5" r="2" />
      <circle cx="18" cy="5" r="2" />
      <circle cx="12" cy="19" r="2" />
      <path d="M6 7v3a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7M12 12v5" />
    </svg>
  )
}

function authHeaders(isJson = true) {
  const token = localStorage.getItem("token")
  return {
    ...(isJson ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...authHeaders(options.isJson !== false),
      ...(options.headers || {}),
    },
    credentials: "include",
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.message || "Request failed")
  return data
}

function getId(value) {
  return value?._id || value?.id || value || ""
}

function initials(name) {
  const result = String(name || "Company")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
  return result || "CO"
}

function pretty(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function dateText(value) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function toDateInput(value) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString().slice(0, 10)
}

function companyStatus(company) {
  if (["expired", "scheduled"].includes(company?.subscriptionAccess?.state)) {
    return company.subscriptionAccess.state
  }
  return String(company?.status || (company?.isActive === false ? "suspended" : "active")).toLowerCase()
}

function getCompanyAddress(company = {}) {
  return company?.headOffice?.address || company?.address || company?.location || {}
}

function fullAddress(address = {}) {
  return [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.postalCode,
    address.country,
  ]
    .filter(Boolean)
    .join(", ")
}

function getCompanyModuleIds(company = {}) {
  const raw =
    company.moduleIds ||
    company.modules ||
    company.erpModules ||
    company.moduleAccess ||
    company.accessibleModules ||
    []

  return (Array.isArray(raw) ? raw : [])
    .filter((item) => item?.enabled !== false)
    .map((item) => String(getId(item?.module || item)))
    .filter(Boolean)
}

function getBranchCount(company = {}) {
  if (Number.isFinite(Number(company.branchCount))) return Number(company.branchCount)
  if (Array.isArray(company.branches)) return company.branches.length
  return company.headOffice || company.address ? 1 : 0
}

function normalizeForm(company = {}) {
  const base = createEmptyForm()
  const address = getCompanyAddress(company)
  const headOffice = company.headOffice || company.primaryBranch || {}
  const manager =
    headOffice.manager ||
    company.manager ||
    company.primaryContact ||
    company.accountManager ||
    {}
  const settings = company.settings || company.erpSettings || {}
  const subscription = company.subscription || company.plan || {}

  return {
    ...base,
    name: company.name || company.companyName || "",
    legalName: company.legalName || "",
    code: company.code || company.companyCode || "",
    industry: company.industry || "",
    registrationNo: company.registrationNo || company.registrationNumber || "",
    taxId: company.taxId || company.tin || company.vatNo || "",
    email: company.email || company.contact?.email || "",
    phone: company.phone || company.contact?.phone || "",
    website: company.website || "",
    logoUrl: company.logoUrl || company.logo || "",
    address: {
      ...base.address,
      ...address,
      latitude: address.latitude ?? address.lat ?? "",
      longitude: address.longitude ?? address.lng ?? "",
    },
    headOffice: {
      ...base.headOffice,
      ...headOffice,
      name: headOffice.name || "Head Office",
      code: headOffice.code || "HO",
      email: headOffice.email || company.email || "",
      phone: headOffice.phone || company.phone || "",
    },
    manager: {
      ...base.manager,
      ...manager,
      designation: manager.designation || manager.position || "Company Manager",
    },
    settings: {
      ...base.settings,
      ...settings,
    },
    subscription: {
      ...base.subscription,
      ...(typeof subscription === "string" ? { plan: subscription } : subscription),
      plan:
        (typeof subscription === "string" ? subscription : subscription.plan) ||
        company.planName ||
        base.subscription.plan,
      startDate: toDateInput(subscription.startDate) || base.subscription.startDate,
      endDate: toDateInput(subscription.endDate),
    },
    moduleIds: getCompanyModuleIds(company),
    status: companyStatus(company),
    note: company.note || company.notes || "",
  }
}

function Field({ label, children, hint, required = false }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-extrabold text-gray-900">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs font-semibold text-gray-500">{hint}</span> : null}
    </label>
  )
}

function SectionTitle({ icon, title, subtitle, action }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10">
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold text-gray-900">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs font-semibold text-gray-500">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  )
}

function Modal({
  open,
  title,
  subtitle,
  icon,
  children,
  footer,
  onClose,
  maxWidthClass = "max-w-6xl",
}) {
  useEffect(() => {
    if (!open) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => event.key === "Escape" && onClose?.()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 overflow-y-auto">
        <div className="flex min-h-full items-start justify-center p-4 sm:items-center sm:p-6">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-md" onClick={onClose} />
          <div
            className={`relative w-full overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_30px_70px_-30px_rgba(0,0,0,0.65)] ${maxWidthClass}`}
          >
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-100 bg-white p-4 sm:p-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
                  {icon}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-extrabold text-gray-900 sm:text-lg">{title}</h2>
                  {subtitle ? <p className="truncate text-sm font-semibold text-gray-500">{subtitle}</p> : null}
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-xl p-2 transition hover:bg-gray-100"
                type="button"
                aria-label="Close modal"
              >
                <HIcon icon={Cancel01Icon} className="h-5 w-5 text-gray-700" />
              </button>
            </div>
            <div className="max-h-[calc(100vh-13rem)] overflow-y-auto bg-[#fbfcff] p-4 sm:p-5">
              {children}
            </div>
            {footer ? (
              <div className="sticky bottom-0 z-20 border-t border-gray-100 bg-white p-4 sm:p-5">
                {footer}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const normalized = String(status || "active").toLowerCase()
  const classes =
    normalized === "active"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/10"
      : normalized === "trial"
        ? "bg-sky-50 text-sky-700 ring-sky-600/10"
        : normalized === "pending"
          ? "bg-amber-50 text-amber-700 ring-amber-600/10"
          : "bg-rose-50 text-rose-700 ring-rose-600/10"

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${classes}`}>
      {pretty(normalized)}
    </span>
  )
}

function CompanyAvatar({ company, size = "h-11 w-11" }) {
  const logoUrl = company?.logoUrl || company?.logo
  return (
    <div
      className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-indigo-50 text-sm font-black text-indigo-700 ring-1 ring-indigo-100`}
    >
      {logoUrl ? (
        <img src={logoUrl} alt={company?.name || "Company"} className="h-full w-full object-cover" />
      ) : (
        initials(company?.name || company?.companyName)
      )}
    </div>
  )
}

function ModulePill({ module }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-extrabold text-indigo-700 ring-1 ring-indigo-600/10">
      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
      {module?.name || module?.code || "Module"}
    </span>
  )
}

function FilterChip({ label, value, onClear }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
    >
      <span className="text-indigo-400">{label}:</span>
      <span className="max-w-[180px] truncate sm:max-w-[220px]">{value}</span>
      <HIcon icon={Cancel01Icon} className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
    </button>
  )
}

function LocationPreview({ address = {}, compact = false }) {
  const text = fullAddress(address) || "Location has not been configured"
  const hasCoordinates = address.latitude !== "" && address.longitude !== ""
  const mapQuery = hasCoordinates
    ? `${address.latitude},${address.longitude}`
    : encodeURIComponent(text)

  return (
    <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-white">
      <div className={`relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-sky-50 ${compact ? "h-28" : "h-40"}`}>
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(99,102,241,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,.12)_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="absolute left-[18%] top-[30%] h-2 w-16 rotate-12 rounded-full bg-indigo-100" />
        <div className="absolute right-[12%] top-[22%] h-2 w-24 -rotate-12 rounded-full bg-sky-100" />
        <div className="absolute bottom-[18%] left-[30%] h-2 w-28 -rotate-6 rounded-full bg-indigo-100" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl shadow-indigo-300/40 ring-8 ring-white/80">
            <LocationPin className="h-7 w-7" />
          </span>
        </div>
      </div>
      <div className="p-4">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-indigo-400">Primary location</p>
        <p className="mt-1.5 text-sm font-extrabold leading-6 text-gray-900">{text}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-gray-500">
          {hasCoordinates ? (
            <span className="rounded-full bg-gray-100 px-2.5 py-1">
              {address.latitude}, {address.longitude}
            </span>
          ) : null}
          {text !== "Location has not been configured" ? (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700 transition hover:bg-indigo-100"
            >
              Open in Maps
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function CompanyActionMenu({ company, onView, onEdit, onChangeStatus, onManageBranches }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef(null)
  const status = companyStatus(company)
  const closeMenu = useCallback(() => setOpen(false), [])

  const runAction = useCallback(
    (action) => {
      closeMenu()
      window.requestAnimationFrame(() => action?.(company))
    },
    [closeMenu, company]
  )

  useEffect(() => {
    if (!open) return undefined

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) return
      const width = 230
      const height = 190
      const gap = 8
      const left = Math.min(window.innerWidth - width - 12, Math.max(12, rect.right - width))
      const openAbove = rect.bottom + height + gap > window.innerHeight
      const top = openAbove
        ? Math.max(12, rect.top - height - gap)
        : Math.min(window.innerHeight - height - 12, rect.bottom + gap)
      setPosition({ top, left })
    }

    updatePosition()
    const onOutside = () => closeMenu()
    const onKey = (event) => event.key === "Escape" && closeMenu()

    window.addEventListener("click", onOutside)
    window.addEventListener("keydown", onKey)
    window.addEventListener("scroll", updatePosition, true)
    window.addEventListener("resize", updatePosition)

    return () => {
      window.removeEventListener("click", onOutside)
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("scroll", updatePosition, true)
      window.removeEventListener("resize", updatePosition)
    }
  }, [open, closeMenu])

  const itemClass =
    "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-gray-700 transition hover:bg-gray-50"

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            style={{ position: "fixed", top: position.top, left: position.left, width: 230 }}
            className="z-[9999] overflow-hidden rounded-2xl border border-gray-100 bg-white p-2 text-left shadow-[0_22px_60px_-28px_rgba(15,23,42,0.65)]"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className={itemClass} onClick={() => runAction(onEdit)}>
              <HIcon icon={PencilEdit02Icon} className="text-indigo-600" />
              Edit company setup
            </button>
            <button type="button" className={itemClass} onClick={() => runAction(onManageBranches)}>
              <BranchIcon className="h-4 w-4 text-indigo-600" />
              Manage branches
            </button>
            {onChangeStatus ? <button
              type="button"
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition ${
                status === "active"
                  ? "text-rose-700 hover:bg-rose-50"
                  : "text-emerald-700 hover:bg-emerald-50"
              }`}
              onClick={() => runAction(onChangeStatus)}
            >
              <HIcon icon={SecurityCheckIcon} />
              {status === "active" ? "Suspend company" : "Reactivate company"}
            </button> : null}
          </div>,
          document.body
        )
      : null

  return (
    <div className="relative flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className={`${btn} ${btnPrimary} h-10 px-3 py-2 shadow-sm shadow-indigo-600/20`}
        onClick={() => runAction(onView)}
      >
        <HIcon icon={ViewIcon} className="h-4 w-4" />
        View
      </button>
      <button
        ref={buttonRef}
        type="button"
        className={iconBtn}
        title="More actions"
        aria-label="More company actions"
        onClick={(event) => {
          event.stopPropagation()
          setOpen((previous) => !previous)
        }}
      >
        <HIcon icon={MoreVerticalIcon} className="h-4 w-4" />
      </button>
      {menu}
    </div>
  )
}

function CompanyMobileCard({ company, modules, onView, onEdit, onChangeStatus, onManageBranches }) {
  const address = getCompanyAddress(company)
  const moduleIds = getCompanyModuleIds(company)
  const enabledModules = modules.filter((module) => moduleIds.includes(String(getId(module))))
  const plan = company.subscription?.plan || company.planName || company.plan || "Custom"

  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <CompanyAvatar company={company} />
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-gray-900">{company.name || company.companyName}</p>
            <p className="truncate text-xs font-semibold text-gray-500">{company.code || company.companyCode || "No company code"}</p>
            <p className="mt-1 truncate text-xs font-bold text-indigo-600">
              {company.industry || "Industry not configured"}
            </p>
          </div>
        </div>
        <StatusBadge status={companyStatus(company)} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-gray-400">Location</p>
          <p className="mt-1 truncate text-sm font-extrabold text-gray-900">
            {[address.city, address.country].filter(Boolean).join(", ") || "Not configured"}
          </p>
        </div>
        <div className="rounded-xl bg-indigo-50 p-3">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-indigo-400">ERP access</p>
          <p className="mt-1 text-sm font-extrabold text-indigo-700">{enabledModules.length} modules</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-gray-400">Plan</p>
          <p className="mt-1 truncate text-sm font-extrabold text-gray-900">{pretty(plan)}</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-gray-400">Locations</p>
          <p className="mt-1 text-sm font-extrabold text-gray-900">{getBranchCount(company)} branches</p>
        </div>
      </div>

      <div className="mt-4 flex min-h-7 flex-wrap gap-2">
        {enabledModules.length ? (
          enabledModules.slice(0, 3).map((module) => <ModulePill key={getId(module)} module={module} />)
        ) : (
          <span className="text-xs font-semibold text-gray-400">No ERP modules assigned</span>
        )}
        {enabledModules.length > 3 ? (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-extrabold text-gray-600">
            +{enabledModules.length - 3}
          </span>
        ) : null}
      </div>

      <div className="mt-4 border-t border-gray-100 pt-4">
        <CompanyActionMenu
          company={company}
          onView={onView}
          onEdit={onEdit}
          onChangeStatus={onChangeStatus}
          onManageBranches={onManageBranches}
        />
      </div>
    </article>
  )
}

function DetailItem({ label, value, tone = "gray" }) {
  const toneClass =
    tone === "indigo"
      ? "bg-indigo-50 text-indigo-700"
      : tone === "emerald"
        ? "bg-emerald-50 text-emerald-700"
        : tone === "amber"
          ? "bg-amber-50 text-amber-800"
          : "bg-gray-50 text-gray-800"

  return (
    <div className={`rounded-2xl p-4 ${toneClass}`}>
      <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] opacity-60">{label}</p>
      <p className="mt-1.5 break-words text-base font-extrabold">{value || "—"}</p>
    </div>
  )
}

function CompanyDetails({ company, modules, onManageBranches }) {
  if (!company) return null

  const form = normalizeForm(company)
  const enabledModules = modules.filter((module) =>
    form.moduleIds.includes(String(getId(module)))
  )
  const groupedModules = enabledModules.reduce((groups, module) => {
    const category = module.category || "Other"
    groups[category] = [...(groups[category] || []), module]
    return groups
  }, {})

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <CompanyAvatar company={company} size="h-16 w-16" />
          <div className="min-w-0">
            <p className="truncate text-xl font-extrabold text-gray-900">{form.name || "Unnamed company"}</p>
            <p className="truncate text-sm font-semibold text-gray-500">
              {form.legalName || "Legal name not configured"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-extrabold text-indigo-600">
              <span>{form.code || "No code"}</span>
              <span className="text-gray-300">•</span>
              <span>{form.industry || "No industry"}</span>
            </div>
          </div>
        </div>
        <StatusBadge status={form.status} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DetailItem label="ERP modules" value={`${enabledModules.length} enabled`} tone="indigo" />
        <DetailItem label="Locations" value={`${getBranchCount(company)} branches`} />
        <DetailItem label="Subscription" value={form.subscription.plan} tone="emerald" />
        <DetailItem label="Currency" value={form.settings.currency} tone="amber" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_.85fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <SectionTitle
              icon={<BuildingIcon />}
              title="Company identity"
              subtitle="Legal, registration and contact information"
            />
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                ["Company code", form.code],
                ["Legal name", form.legalName],
                ["Registration number", form.registrationNo],
                ["Tax / VAT ID", form.taxId],
                ["Email", form.email],
                ["Phone", form.phone],
                ["Website", form.website],
                ["Industry", form.industry],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-gray-50 p-3">
                  <dt className="text-xs font-bold text-gray-400">{label}</dt>
                  <dd className="mt-1 break-words text-sm font-extrabold text-gray-900">{value || "—"}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <SectionTitle
              icon={<HIcon icon={SecurityCheckIcon} />}
              title="ERP module access"
              subtitle="Company-level subscription entitlements"
            />
            {Object.keys(groupedModules).length ? (
              <div className="space-y-4">
                {Object.entries(groupedModules).map(([category, items]) => (
                  <div key={category}>
                    <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.12em] text-gray-400">
                      {category}
                    </p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {items.map((module) => (
                        <div key={getId(module)} className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 ring-1 ring-indigo-100">
                              <HIcon icon={CheckmarkCircle02Icon} className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-extrabold text-gray-900">{module.name}</p>
                              <p className="mt-1 text-xs font-semibold leading-5 text-gray-500">
                                {module.description || "Module access enabled for this company."}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm font-semibold text-gray-400">
                No ERP modules are assigned to this company.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <LocationPreview address={form.address} />

          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <SectionTitle
              icon={<HIcon icon={UserIcon} />}
              title="Company manager"
              subtitle="Primary operational contact"
            />
            <div className="space-y-3">
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs font-bold text-gray-400">Name</p>
                <p className="mt-1 text-sm font-extrabold text-gray-900">{form.manager.name || "—"}</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="text-xs font-bold text-gray-400">Email</p>
                  <p className="mt-1 break-words text-sm font-extrabold text-gray-900">{form.manager.email || "—"}</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="text-xs font-bold text-gray-400">Phone</p>
                  <p className="mt-1 text-sm font-extrabold text-gray-900">{form.manager.phone || "—"}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <SectionTitle
              icon={<BranchIcon />}
              title="Branch structure"
              subtitle="Head office and child branch records"
              action={
                onManageBranches ? <button
                  type="button"
                  className={`${btn} ${btnGhost} h-9 px-3 py-2 text-xs`}
                  onClick={() => onManageBranches?.(company)}
                >
                  Manage branches
                </button> : null
              }
            />
            <div className="rounded-xl bg-gray-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-extrabold text-gray-900">{form.headOffice.name}</p>
                  <p className="mt-1 text-xs font-semibold text-gray-500">Code: {form.headOffice.code || "HO"}</p>
                </div>
                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-extrabold text-indigo-700">
                  Primary
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <SectionTitle
              icon={<HIcon icon={Calendar03Icon} />}
              title="Subscription & ERP settings"
              subtitle="Commercial plan and company defaults"
            />
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {[
                ["Plan", form.subscription.plan],
                ["Subscription end", dateText(form.subscription.endDate)],
                ["Timezone", form.settings.timezone],
                ["Fiscal year", form.settings.fiscalYearStart],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-gray-50 p-3">
                  <dt className="text-xs font-bold text-gray-400">{label}</dt>
                  <dd className="mt-1 text-sm font-extrabold text-gray-900">{value || "—"}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {form.note ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <p className="text-xs font-extrabold uppercase tracking-wide text-amber-600">Internal note</p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm font-semibold leading-6 text-amber-900">
            {form.note}
          </p>
        </div>
      ) : null}
    </div>
  )
}

function ModuleAccessSelector({ modules, selectedIds, onChange }) {
  const grouped = useMemo(
    () =>
      modules.reduce((groups, module) => {
        const category = module.category || "Other"
        groups[category] = [...(groups[category] || []), module]
        return groups
      }, {}),
    [modules]
  )

  const selectedSet = useMemo(() => new Set(selectedIds.map(String)), [selectedIds])

  const toggle = (moduleId) => {
    const id = String(moduleId)
    onChange(
      selectedSet.has(id)
        ? removeModuleAndDependents(selectedIds, id)
        : normalizeModuleSelection([...selectedIds, id])
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-extrabold text-indigo-900">{selectedIds.length} modules selected</p>
          <p className="mt-0.5 text-xs font-semibold text-indigo-600">
            This controls company access. Configure employee permissions separately through roles.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl bg-white px-3 py-2 text-xs font-extrabold text-indigo-700 ring-1 ring-indigo-100 transition hover:bg-indigo-100"
            onClick={() => onChange(normalizeModuleSelection(modules.map((module) => String(getId(module))))) }
          >
            Select all
          </button>
          <button
            type="button"
            className="rounded-xl bg-white px-3 py-2 text-xs font-extrabold text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-100"
            onClick={() => onChange([...REQUIRED_MODULE_IDS])}
          >
            Clear
          </button>
        </div>
      </div>

      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.12em] text-gray-400">{category}</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {items.map((module) => {
              const id = String(getId(module))
              const selected = selectedSet.has(id)
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggle(id)}
                  className={`group rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
                    selected
                      ? "border-indigo-200 bg-indigo-50 shadow-sm"
                      : "border-gray-100 bg-white hover:border-indigo-100 hover:bg-indigo-50/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${
                        selected
                          ? "bg-indigo-600 text-white ring-indigo-600"
                          : "bg-gray-50 text-gray-500 ring-gray-100 group-hover:bg-white group-hover:text-indigo-600"
                      }`}
                    >
                      <HIcon icon={selected ? CheckmarkCircle02Icon : Activity01Icon} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-extrabold text-gray-900">{module.name}</span>
                      <span className="mt-1 block text-xs font-semibold leading-5 text-gray-500">
                        {module.description || "Enable this ERP module for the company."}
                      </span>
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function setupCompletion(form) {
  const checks = [
    form.name,
    form.code,
    form.email,
    form.phone,
    form.address.line1,
    form.address.city,
    form.address.country,
    form.manager.name,
    form.settings.currency,
    form.subscription.plan,
    form.moduleIds.length > 0,
  ]
  const completed = checks.filter(Boolean).length
  return Math.round((completed / checks.length) * 100)
}

export default function AdminCompanySetupPage() {
  const currentUser = useSelector((state) => state.user?.currentUser)
  const isSuperAdmin = currentUser?.role === "superadmin"
  const canManageCompany = currentUser?.role === "admin" || hasPermission(currentUser, "company:manage")
  const canManageBranches = currentUser?.role === "admin" || hasPermission(currentUser, "branch:manage")
  const canManageTenantAdmin = ["admin", "superadmin"].includes(currentUser?.role)
  const [companies, setCompanies] = useState([])
  const [modules, setModules] = useState([])
  const [moduleCatalogError, setModuleCatalogError] = useState("")
  const [moduleCatalogLoading, setModuleCatalogLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [searchText, setSearchText] = useState("")
  const [filters, setFilters] = useState(defaultFilters)
  const [filterDraft, setFilterDraft] = useState(defaultFilters)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(createEmptyForm())
  const [viewCompany, setViewCompany] = useState(null)
  const [statusState, setStatusState] = useState({ open: false, company: null, loading: false })
  const [branchCompany, setBranchCompany] = useState(null)

  const moduleMap = useMemo(
    () => new Map(modules.map((module) => [String(getId(module)), module])),
    [modules]
  )

  const activeFilterEntries = useMemo(() => {
    const entries = []
    if (filters.status !== "all") entries.push({ key: "status", label: "Status", value: pretty(filters.status) })
    if (filters.plan) entries.push({ key: "plan", label: "Plan", value: filters.plan })
    if (filters.country) entries.push({ key: "country", label: "Country", value: filters.country })
    return entries
  }, [filters])

  const activeFilterCount = activeFilterEntries.length + (searchText.trim() ? 1 : 0)

  const visibleCompanies = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    if (!query) return companies
    return companies.filter((company) => {
      const address = getCompanyAddress(company)
      const manager = company.headOffice?.manager || company.manager || company.primaryContact || {}
      return [
        company.name,
        company.companyName,
        company.legalName,
        company.code,
        company.companyCode,
        company.email,
        company.phone,
        company.industry,
        address.city,
        address.country,
        manager.name,
        manager.email,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    })
  }, [companies, searchText])

  const totals = useMemo(() => {
    const active = companies.filter((company) => company.subscriptionAccess?.allowed === true).length
    const expiring = companies.filter((company) => {
      const days = company.subscriptionAccess?.daysRemaining
      return company.subscriptionAccess?.allowed === true && days != null && days <= 30
    }).length
    const blocked = companies.filter((company) => company.subscriptionAccess?.allowed === false).length
    const branches = companies.reduce((sum, company) => sum + getBranchCount(company), 0)
    const assignedModules = companies.reduce((sum, company) => sum + getCompanyModuleIds(company).length, 0)
    const averageModules = companies.length ? Math.round(assignedModules / companies.length) : 0
    return { active, expiring, blocked, branches, averageModules }
  }, [companies])

  const completion = useMemo(() => setupCompletion(form), [form])

  const loadModules = async () => {
    setModuleCatalogLoading(true)
    setModuleCatalogError("")
    try {
      const data = await api(`${ENDPOINTS.modules}?active=true`)
      const list = data.modules || data.erpModules || data.items || []
      if (!Array.isArray(list) || !list.length) throw new Error("The ERP module catalog is empty.")
      setModules(list)
    } catch (error) {
      setModules([])
      setModuleCatalogError(error.message || "The ERP module catalog could not be loaded.")
    } finally {
      setModuleCatalogLoading(false)
    }
  }

  const loadCompanies = async (nextPage = page) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("limit", String(PAGE_SIZE))
      params.set("page", String(nextPage))
      if (filters.status !== "all") params.set("status", filters.status)
      if (filters.plan) params.set("plan", filters.plan)
      if (filters.country) params.set("country", filters.country)

      const data = await api(`${ENDPOINTS.companies}?${params.toString()}`)
      const list = data.companies || data.tenants || data.items || []
      setCompanies(Array.isArray(list) ? list : [])
      setTotal(Number(data.total ?? list.length ?? 0))
      setTotalPages(Math.max(Number(data.totalPages || data.pages || 1), 1))
      setPage(Number(data.page || nextPage))
    } catch (error) {
      toast.error(error.message || "Failed to load companies")
      setCompanies([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadModules()
  }, [])

  useEffect(() => {
    loadCompanies(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  const openCreate = () => {
    setEditing(null)
    setForm(createEmptyForm())
    setModalOpen(true)
  }

  const openEdit = (company) => {
    setEditing(company)
    setForm(normalizeForm(company))
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
    setForm(createEmptyForm())
  }

  const updateForm = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  const updateNested = (section, key, value) => {
    setForm((previous) => ({
      ...previous,
      [section]: {
        ...previous[section],
        [key]: value,
      },
    }))
  }

  const buildPayload = () => ({
    name: form.name.trim(),
    legalName: form.legalName.trim(),
    code: form.code.trim().toUpperCase(),
    industry: form.industry,
    registrationNo: form.registrationNo.trim(),
    taxId: form.taxId.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    website: form.website.trim(),
    logoUrl: form.logoUrl.trim(),
    address: {
      ...form.address,
      latitude: form.address.latitude === "" ? null : Number(form.address.latitude),
      longitude: form.address.longitude === "" ? null : Number(form.address.longitude),
    },
    adminUser: {
      name: form.manager.name.trim(),
      email: form.manager.email.trim(),
      phone: form.manager.phone.trim(),
      designation: form.manager.designation.trim(),
      password: form.manager.password || "",
    },
    headOffice: {
      name: form.headOffice.name.trim() || "Head Office",
      code: form.headOffice.code.trim().toUpperCase() || "HO",
      email: form.headOffice.email.trim() || form.email.trim(),
      phone: form.headOffice.phone.trim() || form.phone.trim(),
      address: {
        ...form.address,
        latitude: form.address.latitude === "" ? null : Number(form.address.latitude),
        longitude: form.address.longitude === "" ? null : Number(form.address.longitude),
      },
      manager: {
        ...form.manager,
        name: form.manager.name.trim(),
        email: form.manager.email.trim(),
        phone: form.manager.phone.trim(),
        designation: form.manager.designation.trim(),
      },
    },
    settings: form.settings,
    subscription: {
      ...form.subscription,
      startDate: form.subscription.startDate || null,
      endDate: form.subscription.endDate || null,
    },
    moduleIds: form.moduleIds,
    status: form.status,
    note: form.note.trim(),
  })

  const saveCompany = async (event) => {
    event.preventDefault()

    if (isSuperAdmin && (moduleCatalogLoading || moduleCatalogError)) return toast.error("Load the ERP module catalog before saving a company.")
    if (!form.name.trim()) return toast.error("Company name is required")
    if (!form.code.trim()) return toast.error("Company code is required")
    if (!form.address.line1.trim()) return toast.error("Address line is required")
    if (!form.address.city.trim()) return toast.error("City is required")
    if (!form.address.country.trim()) return toast.error("Country is required")
    if (!editing && isSuperAdmin && !form.manager.name.trim()) return toast.error("Tenant admin name is required")
    if (!editing && isSuperAdmin && !form.manager.email.trim()) return toast.error("Tenant admin email is required")
    if (!editing && isSuperAdmin && form.manager.password && String(form.manager.password).length < 6) return toast.error("Temporary admin password must be at least 6 characters")

    setSaving(true)
    try {
      const companyId = getId(editing)
      await api(companyId ? `${ENDPOINTS.companies}/${companyId}` : ENDPOINTS.companies, {
        method: companyId ? "PATCH" : "POST",
        body: JSON.stringify(buildPayload()),
      })
      toast.success(companyId ? "Company setup updated" : "Company created successfully")
      closeModal()
      loadCompanies(page)
    } catch (error) {
      toast.error(error.message || "Failed to save company")
    } finally {
      setSaving(false)
    }
  }

  const changeCompanyStatus = async () => {
    const company = statusState.company
    const companyId = getId(company)
    if (!companyId) return

    const current = String(company?.status || "active").toLowerCase()
    const nextStatus = current === "active" ? "suspended" : "active"
    setStatusState((previous) => ({ ...previous, loading: true }))

    try {
      await api(`${ENDPOINTS.companies}/${companyId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      })
      toast.success(nextStatus === "active" ? "Company reactivated" : "Company suspended")
      setStatusState({ open: false, company: null, loading: false })
      loadCompanies(page)
    } catch (error) {
      toast.error(error.message || "Status update failed")
      setStatusState((previous) => ({ ...previous, loading: false }))
    }
  }

  const clearSingleFilter = (key) => {
    setFilters((previous) => ({
      ...previous,
      [key]: key === "status" ? "all" : "",
    }))
  }

  const resetFilters = () => {
    setSearchText("")
    setFilters(defaultFilters)
    setFilterDraft(defaultFilters)
  }

  const manageBranches = (company) => {
    const companyId = getId(company)
    if (!companyId) return toast.error("Company ID is missing")
    setBranchCompany(company)
  }

  return (
    <div className={shell}>
      <Toaster
        position="top-right"
        toastOptions={{ duration: 2600, style: { borderRadius: "14px", fontWeight: 700 } }}
      />

      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <div className={`${card} mb-5 overflow-hidden`}>
          <div className="relative p-4 sm:p-5">
            <div className="pointer-events-none absolute right-0 top-0 h-40 w-64 bg-gradient-to-bl from-indigo-100/80 via-indigo-50/20 to-transparent" />
            <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
                  <BuildingIcon />
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
                    {isSuperAdmin ? "Company Subscriptions & ERP Access" : "My Company Profile"}
                  </h1>
                  <p className="mt-1 max-w-3xl text-sm font-semibold text-gray-500">
                    {isSuperAdmin
                      ? "Manage SaaS companies, tenant Admins, subscription dates and entitled ERP modules."
                      : "Review your company, update permitted profile information and manage authorized branches."}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className={`${btn} ${btnGhost}`}
                  onClick={() => loadCompanies(page)}
                  disabled={loading}
                  type="button"
                >
                  <HIcon icon={RefreshIcon} className={loading ? "animate-spin" : ""} />
                  Refresh
                </button>
                {isSuperAdmin ? <button className={`${btn} ${btnPrimary}`} onClick={openCreate} type="button">
                  <HIcon icon={Add01Icon} />
                  Add Company
                </button> : null}
              </div>
            </div>
          </div>
        </div>

        {!isSuperAdmin && !loading && companies[0] ? (
          <section className={`${card} mb-5 p-4 sm:p-5`}>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-indigo-500">Tenant workspace</p>
                <h2 className="mt-1 text-xl font-black text-gray-900">{companies[0].name}</h2>
                <p className="mt-1 text-sm font-semibold text-gray-500">
                  Subscription: {pretty(companies[0].subscriptionAccess?.state || companies[0].status)}
                  {companies[0].subscriptionAccess?.daysRemaining != null
                    ? ` · ${companies[0].subscriptionAccess.daysRemaining} days remaining`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canManageBranches ? <button className={`${btn} ${btnGhost}`} type="button" onClick={() => manageBranches(companies[0])}>
                  <BranchIcon className="h-4 w-4" /> Manage Branches
                </button> : null}
                {canManageCompany ? <button className={`${btn} ${btnPrimary}`} type="button" onClick={() => openEdit(companies[0])}>
                  <HIcon icon={PencilEdit02Icon} /> Edit Company Profile
                </button> : null}
              </div>
            </div>
            <CompanyDetails company={companies[0]} modules={modules} onManageBranches={canManageBranches ? manageBranches : undefined} />
          </section>
        ) : null}

        <section className={`${!isSuperAdmin ? "hidden " : ""}mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4`}>
          {[
            {
              label: "Active subscriptions",
              value: totals.active,
              hint: `${total || companies.length} total companies`,
              icon: <HIcon icon={CheckmarkCircle02Icon} />,
              tone: "emerald",
            },
            {
              label: "Expiring soon",
              value: totals.expiring,
              hint: "Within the next 30 days",
              icon: <HIcon icon={SecurityCheckIcon} />,
              tone: "rose",
            },
            {
              label: "Blocked / expired",
              value: totals.blocked,
              hint: "Tenant access is unavailable",
              icon: <HIcon icon={SecurityCheckIcon} />,
              tone: "rose",
            },
            {
              label: "Company locations",
              value: totals.branches,
              hint: "Head offices and branches",
              icon: <BranchIcon />,
              tone: "indigo",
            },
          ].map((stat) => {
            const toneClass =
              stat.tone === "emerald"
                ? "bg-emerald-50 text-emerald-700"
                : stat.tone === "rose"
                  ? "bg-rose-50 text-rose-700"
                  : stat.tone === "amber"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-indigo-50 text-indigo-700"
            return (
              <div key={stat.label} className={`${card} p-4`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-gray-400">{stat.label}</p>
                    <p className="mt-2 text-2xl font-black text-gray-900">{stat.value}</p>
                    <p className="mt-1 text-xs font-semibold text-gray-500">{stat.hint}</p>
                  </div>
                  <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${toneClass}`}>
                    {stat.icon}
                  </span>
                </div>
              </div>
            )
          })}
        </section>

        <section className={`${card} ${!isSuperAdmin ? "hidden" : ""}`}>
          <div className="border-b border-gray-100 p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-h-[42px] w-full flex-wrap items-center gap-1.5 rounded-2xl border border-gray-200 bg-[#f7f8fb] px-2.5 py-1 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.10)] lg:max-w-[760px]">
                <HIcon icon={Search01Icon} className="h-4 w-4 shrink-0 text-gray-400" />
                {searchText.trim() ? (
                  <FilterChip label="Search" value={searchText.trim()} onClear={() => setSearchText("")} />
                ) : null}
                {activeFilterEntries.map((filter) => (
                  <FilterChip
                    key={filter.key}
                    label={filter.label}
                    value={filter.value}
                    onClear={() => clearSingleFilter(filter.key)}
                  />
                ))}
                <input
                  className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-1 text-sm font-semibold text-gray-800 outline-none placeholder:text-gray-400 focus:outline-none focus:ring-0"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder={activeFilterCount ? "Search..." : "Search company, code, city or manager..."}
                  type="text"
                />
                <button
                  type="button"
                  onClick={() => {
                    setFilterDraft(filters)
                    setFiltersOpen(true)
                  }}
                  className={`inline-flex h-8 shrink-0 items-center gap-2 rounded-xl px-2.5 text-xs font-black transition ${
                    activeFilterEntries.length
                      ? "bg-indigo-600 text-white hover:bg-indigo-700"
                      : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"
                  }`}
                >
                  <HIcon icon={FilterIcon} className="h-3.5 w-3.5" />
                  Filters
                  {activeFilterEntries.length ? (
                    <span className="rounded-full bg-white/20 px-1.5 text-[10px]">
                      {activeFilterEntries.length}
                    </span>
                  ) : null}
                </button>
                {activeFilterCount ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                    title="Clear search and filters"
                  >
                    <HIcon icon={Cancel01Icon} className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-3 lg:justify-end">
                <p className="text-sm font-bold text-gray-500">
                  Showing <span className="text-gray-900">{visibleCompanies.length}</span> of{" "}
                  <span className="text-gray-900">{total || companies.length}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            {loading ? (
              <div className="flex min-h-72 items-center justify-center">
                <div className="text-center">
                  <HIcon icon={RefreshIcon} className="mx-auto h-7 w-7 animate-spin text-indigo-600" />
                  <p className="mt-3 text-sm font-bold text-gray-500">Loading company setups...</p>
                </div>
              </div>
            ) : visibleCompanies.length ? (
              <>
                <div className="space-y-3 lg:hidden">
                  {visibleCompanies.map((company) => (
                    <CompanyMobileCard
                      key={getId(company)}
                      company={company}
                      modules={modules}
                      onView={setViewCompany}
                      onEdit={openEdit}
                      onChangeStatus={isSuperAdmin ? (selected) =>
                        setStatusState({ open: true, company: selected, loading: false })
                      : undefined}
                      onManageBranches={manageBranches}
                    />
                  ))}
                </div>

                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[1120px] border-separate border-spacing-0">
                    <thead>
                      <tr className="text-left">
                        {[
                          "Company",
                          "Primary location",
                          "Manager",
                          "Plan",
                          "ERP access",
                          "Status",
                          "Actions",
                        ].map((heading) => (
                          <th
                            key={heading}
                            className="border-b border-gray-100 bg-gray-50/80 px-4 py-3 text-xs font-extrabold uppercase tracking-[0.1em] text-gray-400 first:rounded-l-xl last:rounded-r-xl"
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleCompanies.map((company) => {
                        const address = getCompanyAddress(company)
                        const manager =
                          company.headOffice?.manager ||
                          company.manager ||
                          company.primaryContact ||
                          {}
                        const enabledModules = getCompanyModuleIds(company)
                          .map((id) => moduleMap.get(String(id)))
                          .filter(Boolean)
                        const plan =
                          company.subscription?.plan ||
                          company.planName ||
                          company.plan ||
                          "Custom"

                        return (
                          <tr
                            key={getId(company)}
                            className="group cursor-pointer transition hover:bg-indigo-50/30"
                            onClick={() => setViewCompany(company)}
                          >
                            <td className="border-b border-gray-100 px-4 py-4">
                              <div className="flex min-w-0 items-center gap-3">
                                <CompanyAvatar company={company} />
                                <div className="min-w-0">
                                  <p className="max-w-[240px] truncate text-sm font-extrabold text-gray-900">
                                    {company.name || company.companyName || "Unnamed company"}
                                  </p>
                                  <p className="mt-1 max-w-[240px] truncate text-xs font-semibold text-gray-500">
                                    {company.code || company.companyCode || "No code"} · {company.industry || "No industry"}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="border-b border-gray-100 px-4 py-4">
                              <div className="flex max-w-[240px] items-start gap-2">
                                <LocationPin className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-extrabold text-gray-900">
                                    {[address.city, address.country].filter(Boolean).join(", ") || "Not configured"}
                                  </p>
                                  <p className="mt-1 truncate text-xs font-semibold text-gray-500">
                                    {getBranchCount(company)} location{getBranchCount(company) === 1 ? "" : "s"}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="border-b border-gray-100 px-4 py-4">
                              <p className="max-w-[180px] truncate text-sm font-extrabold text-gray-900">
                                {manager.name || "Not assigned"}
                              </p>
                              <p className="mt-1 max-w-[180px] truncate text-xs font-semibold text-gray-500">
                                {manager.email || manager.phone || "No contact"}
                              </p>
                            </td>
                            <td className="border-b border-gray-100 px-4 py-4">
                              <p className="text-sm font-extrabold text-gray-900">{pretty(plan)}</p>
                              <p className="mt-1 text-xs font-semibold text-gray-500">
                                {company.subscription?.endDate
                                  ? `Until ${dateText(company.subscription.endDate)}`
                                  : "No expiry"}
                              </p>
                            </td>
                            <td className="border-b border-gray-100 px-4 py-4">
                              <div className="flex max-w-[320px] flex-wrap gap-1.5">
                                {enabledModules.length ? (
                                  enabledModules.slice(0, 3).map((module) => (
                                    <ModulePill key={getId(module)} module={module} />
                                  ))
                                ) : (
                                  <span className="text-xs font-semibold text-gray-400">No modules</span>
                                )}
                                {enabledModules.length > 3 ? (
                                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-extrabold text-gray-600">
                                    +{enabledModules.length - 3}
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="border-b border-gray-100 px-4 py-4">
                              <StatusBadge status={companyStatus(company)} />
                            </td>
                            <td className="border-b border-gray-100 px-4 py-4">
                              <CompanyActionMenu
                                company={company}
                                onView={setViewCompany}
                                onEdit={openEdit}
                                onChangeStatus={isSuperAdmin ? (selected) =>
                                  setStatusState({ open: true, company: selected, loading: false })
                                : undefined}
                                onManageBranches={manageBranches}
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="flex min-h-72 items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50">
                <div className="max-w-md px-6 text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm ring-1 ring-gray-100">
                    <BuildingIcon className="h-7 w-7" />
                  </span>
                  <h3 className="mt-4 text-base font-extrabold text-gray-900">No companies found</h3>
                  <p className="mt-1 text-sm font-semibold leading-6 text-gray-500">
                    Add a company or clear the current search and filters.
                  </p>
                  {isSuperAdmin ? <button className={`${btn} ${btnPrimary} mt-4`} onClick={openCreate} type="button">
                    <HIcon icon={Add01Icon} />
                    Add Company
                  </button> : null}
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-col gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-bold text-gray-500">
                Page <span className="text-gray-900">{page}</span> of{" "}
                <span className="text-gray-900">{totalPages}</span>
              </p>
              <div className="flex gap-2">
                <button
                  className={`${btn} ${btnGhost}`}
                  disabled={loading || page <= 1}
                  onClick={() => loadCompanies(page - 1)}
                  type="button"
                >
                  <HIcon icon={ArrowLeft01Icon} />
                  Previous
                </button>
                <button
                  className={`${btn} ${btnGhost}`}
                  disabled={loading || page >= totalPages}
                  onClick={() => loadCompanies(page + 1)}
                  type="button"
                >
                  Next
                  <HIcon icon={ArrowRight01Icon} />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <Modal
        open={Boolean(viewCompany)}
        title="Company Setup Details"
        subtitle={viewCompany?.name || "Review company location, settings and ERP access"}
        icon={<BuildingIcon />}
        onClose={() => setViewCompany(null)}
        maxWidthClass="max-w-6xl"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              className={`${btn} ${btnGhost}`}
              type="button"
              onClick={() => manageBranches(viewCompany)}
            >
              <BranchIcon className="h-4 w-4" />
              Manage Branches
            </button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button className={`${btn} ${btnGhost}`} type="button" onClick={() => setViewCompany(null)}>
                Close
              </button>
              <button
                className={`${btn} ${btnPrimary}`}
                type="button"
                onClick={() => {
                  const selected = viewCompany
                  setViewCompany(null)
                  window.requestAnimationFrame(() => selected && openEdit(selected))
                }}
              >
                <HIcon icon={PencilEdit02Icon} />
                Edit Company
              </button>
            </div>
          </div>
        }
      >
        <CompanyDetails company={viewCompany} modules={modules} onManageBranches={manageBranches} />
      </Modal>

      <Modal
        open={filtersOpen}
        title="Company Filters"
        subtitle="Filter by operational status, subscription plan and country."
        icon={<HIcon icon={FilterIcon} />}
        onClose={() => setFiltersOpen(false)}
        maxWidthClass="max-w-3xl"
        footer={
          <div className="flex justify-end gap-2">
            <button
              className={`${btn} ${btnGhost}`}
              type="button"
              onClick={() => {
                setFilterDraft(defaultFilters)
                setFilters(defaultFilters)
                setFiltersOpen(false)
              }}
            >
              Clear All
            </button>
            <button
              className={`${btn} ${btnPrimary}`}
              type="button"
              onClick={() => {
                setFilters(filterDraft)
                setFiltersOpen(false)
              }}
            >
              Apply Filters
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Status">
            <select
              className={input}
              value={filterDraft.status}
              onChange={(event) =>
                setFilterDraft((previous) => ({ ...previous, status: event.target.value }))
              }
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
            </select>
          </Field>
          <Field label="Subscription plan">
            <select
              className={input}
              value={filterDraft.plan}
              onChange={(event) =>
                setFilterDraft((previous) => ({ ...previous, plan: event.target.value }))
              }
            >
              <option value="">All plans</option>
              {planOptions.map((plan) => (
                <option key={plan} value={plan}>{plan}</option>
              ))}
            </select>
          </Field>
          <Field label="Country">
            <input
              className={input}
              value={filterDraft.country}
              onChange={(event) =>
                setFilterDraft((previous) => ({ ...previous, country: event.target.value }))
              }
              placeholder="Bangladesh"
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={modalOpen}
        title={editing ? "Edit Company Setup" : "Create Company Setup"}
        subtitle="Configure company identity, head office, ERP defaults and module access."
        icon={<BuildingIcon />}
        onClose={closeModal}
        maxWidthClass="max-w-7xl"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="h-2 w-28 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${completion}%` }} />
              </div>
              <span className="text-xs font-extrabold text-gray-500">{completion}% setup complete</span>
            </div>
            <div className="flex justify-end gap-2">
              <button className={`${btn} ${btnGhost}`} onClick={closeModal} type="button" disabled={saving}>
                Cancel
              </button>
              <button className={`${btn} ${btnPrimary}`} form="company-form" type="submit" disabled={saving || (isSuperAdmin && (moduleCatalogLoading || Boolean(moduleCatalogError)))}>
                {saving ? "Saving..." : editing ? "Update Company" : "Create Company"}
              </button>
            </div>
          </div>
        }
      >
        <form id="company-form" onSubmit={saveCompany} className="space-y-5">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-5">
              <div className={`${card} p-4`}>
                <SectionTitle
                  icon={<BuildingIcon />}
                  title="Company identity"
                  subtitle="Core legal and business information"
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <Field label="Company name" required>
                    <input
                      className={input}
                      value={form.name}
                      onChange={(event) => updateForm("name", event.target.value)}
                      placeholder="Business Hub BD"
                    />
                  </Field>
                  <Field label="Company code" required hint="Unique tenant code, e.g. BHBD">
                    <input
                      className={input}
                      disabled={Boolean(editing)}
                      value={form.code}
                      onChange={(event) => updateForm("code", event.target.value.toUpperCase())}
                      placeholder="BHBD"
                    />
                  </Field>
                  <Field label="Industry">
                    <select
                      className={input}
                      value={form.industry}
                      onChange={(event) => updateForm("industry", event.target.value)}
                    >
                      <option value="">Select industry</option>
                      {industryOptions.map((industry) => (
                        <option key={industry} value={industry}>{industry}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Legal name">
                    <input
                      className={input}
                      value={form.legalName}
                      onChange={(event) => updateForm("legalName", event.target.value)}
                      placeholder="Registered legal entity name"
                    />
                  </Field>
                  <Field label="Registration number">
                    <input
                      className={input}
                      value={form.registrationNo}
                      onChange={(event) => updateForm("registrationNo", event.target.value)}
                      placeholder="Company registration no."
                    />
                  </Field>
                  <Field label="Tax / VAT ID">
                    <input
                      className={input}
                      value={form.taxId}
                      onChange={(event) => updateForm("taxId", event.target.value)}
                      placeholder="TIN / BIN / VAT number"
                    />
                  </Field>
                  <Field label="Business email">
                    <input
                      className={input}
                      type="email"
                      value={form.email}
                      onChange={(event) => updateForm("email", event.target.value)}
                      placeholder="info@company.com"
                    />
                  </Field>
                  <Field label="Business phone">
                    <input
                      className={input}
                      value={form.phone}
                      onChange={(event) => updateForm("phone", event.target.value)}
                      placeholder="+880 1XXXXXXXXX"
                    />
                  </Field>
                  <Field label="Website">
                    <input
                      className={input}
                      value={form.website}
                      onChange={(event) => updateForm("website", event.target.value)}
                      placeholder="https://company.com"
                    />
                  </Field>
                  <Field label="Logo URL">
                    <input
                      className={input}
                      value={form.logoUrl}
                      onChange={(event) => updateForm("logoUrl", event.target.value)}
                      placeholder="https://.../logo.png"
                    />
                  </Field>
                  <Field label="Status">
                    <select
                      className={input}
                      disabled={!isSuperAdmin}
                      value={form.status}
                      onChange={(event) => updateForm("status", event.target.value)}
                    >
                      <option value="active">Active</option>
                      <option value="trial">Trial</option>
                      <option value="pending">Pending setup</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </Field>
                </div>
              </div>

              <div className={`${card} p-4`}>
                <SectionTitle
                  icon={<LocationPin />}
                  title="Head office location"
                  subtitle="The first location is created as the company head office"
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <Field label="Office name">
                    <input
                      className={input}
                      value={form.headOffice.name}
                      onChange={(event) => updateNested("headOffice", "name", event.target.value)}
                      placeholder="Head Office"
                    />
                  </Field>
                  <Field label="Office code">
                    <input
                      className={input}
                      value={form.headOffice.code}
                      onChange={(event) => updateNested("headOffice", "code", event.target.value.toUpperCase())}
                      placeholder="HO"
                    />
                  </Field>
                  <Field label="Office email">
                    <input
                      className={input}
                      type="email"
                      value={form.headOffice.email}
                      onChange={(event) => updateNested("headOffice", "email", event.target.value)}
                      placeholder="office@company.com"
                    />
                  </Field>
                  <Field label="Address line 1" required>
                    <input
                      className={input}
                      value={form.address.line1}
                      onChange={(event) => updateNested("address", "line1", event.target.value)}
                      placeholder="House, road, area"
                    />
                  </Field>
                  <Field label="Address line 2">
                    <input
                      className={input}
                      value={form.address.line2}
                      onChange={(event) => updateNested("address", "line2", event.target.value)}
                      placeholder="Floor, suite or landmark"
                    />
                  </Field>
                  <Field label="City" required>
                    <input
                      className={input}
                      value={form.address.city}
                      onChange={(event) => updateNested("address", "city", event.target.value)}
                      placeholder="Dhaka"
                    />
                  </Field>
                  <Field label="State / Division">
                    <input
                      className={input}
                      value={form.address.state}
                      onChange={(event) => updateNested("address", "state", event.target.value)}
                      placeholder="Dhaka Division"
                    />
                  </Field>
                  <Field label="Postal code">
                    <input
                      className={input}
                      value={form.address.postalCode}
                      onChange={(event) => updateNested("address", "postalCode", event.target.value)}
                      placeholder="1219"
                    />
                  </Field>
                  <Field label="Country" required>
                    <input
                      className={input}
                      value={form.address.country}
                      onChange={(event) => updateNested("address", "country", event.target.value)}
                      placeholder="Bangladesh"
                    />
                  </Field>
                  <Field label="Latitude">
                    <input
                      className={input}
                      type="number"
                      step="any"
                      value={form.address.latitude}
                      onChange={(event) => updateNested("address", "latitude", event.target.value)}
                      placeholder="23.8103"
                    />
                  </Field>
                  <Field label="Longitude">
                    <input
                      className={input}
                      type="number"
                      step="any"
                      value={form.address.longitude}
                      onChange={(event) => updateNested("address", "longitude", event.target.value)}
                      placeholder="90.4125"
                    />
                  </Field>
                  <Field label="Office phone">
                    <input
                      className={input}
                      value={form.headOffice.phone}
                      onChange={(event) => updateNested("headOffice", "phone", event.target.value)}
                      placeholder="+880 2XXXXXXXX"
                    />
                  </Field>
                </div>
              </div>

              <div className={`${card} p-4`}>
                <SectionTitle
                  icon={<HIcon icon={UserIcon} />}
                  title="Tenant Admin account"
                  subtitle="The Admin account responsible for this company and its users"
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Admin name" required={!editing}>
                    <input
                      className={input}
                      disabled={!canManageTenantAdmin}
                      required={!editing}
                      value={form.manager.name}
                      onChange={(event) => updateNested("manager", "name", event.target.value)}
                      placeholder="Admin full name"
                    />
                  </Field>
                  <Field label="Designation">
                    <input
                      className={input}
                      disabled={!canManageTenantAdmin}
                      value={form.manager.designation}
                      onChange={(event) => updateNested("manager", "designation", event.target.value)}
                      placeholder="Company Manager"
                    />
                  </Field>
                  <Field label="Admin email" required={!editing}>
                    <input
                      className={input}
                      type="email"
                      disabled={!canManageTenantAdmin}
                      required={!editing}
                      value={form.manager.email}
                      onChange={(event) => updateNested("manager", "email", event.target.value)}
                      placeholder="admin@company.com"
                    />
                  </Field>
                  <Field label="Admin phone">
                    <input
                      className={input}
                      disabled={!canManageTenantAdmin}
                      value={form.manager.phone}
                      onChange={(event) => updateNested("manager", "phone", event.target.value)}
                      placeholder="+880 1XXXXXXXXX"
                    />
                  </Field>
                  {!editing && isSuperAdmin ? <Field label="Temporary password" hint="Required for a new Admin; leave blank only when assigning an existing unassigned user.">
                    <input
                      className={input}
                      type="password"
                      value={form.manager.password || ""}
                      onChange={(event) => updateNested("manager", "password", event.target.value)}
                      placeholder="Minimum 6 characters"
                    />
                  </Field> : null}
                </div>
              </div>

              <div className={`${card} p-4`}>
                <SectionTitle
                  icon={<HIcon icon={SecurityCheckIcon} />}
                  title="ERP module access"
                  subtitle="Select the modules included in this company's subscription"
                />
                <div className={!isSuperAdmin ? "pointer-events-none opacity-65" : ""}>
                {moduleCatalogLoading ? (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm font-bold text-gray-600">Loading the ERP module catalog…</div>
                ) : moduleCatalogError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                    <p className="text-sm font-extrabold text-rose-800">ERP module catalog unavailable</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-rose-700">{moduleCatalogError}</p>
                    <button type="button" className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-extrabold text-rose-700 ring-1 ring-rose-200" onClick={loadModules}>
                      Retry module catalog
                    </button>
                  </div>
                ) : (
                  <ModuleAccessSelector
                    modules={modules}
                    selectedIds={form.moduleIds}
                    onChange={(value) => updateForm("moduleIds", value)}
                  />
                )}
                </div>
              </div>

              <div className={`${card} p-4`}>
                <SectionTitle
                  icon={<HIcon icon={Calendar03Icon} />}
                  title="Subscription & ERP defaults"
                  subtitle="Commercial plan and tenant-level localization settings"
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Subscription plan">
                    <select
                      className={input}
                      disabled={!isSuperAdmin}
                      value={form.subscription.plan}
                      onChange={(event) => updateNested("subscription", "plan", event.target.value)}
                    >
                      {planOptions.map((plan) => (
                        <option key={plan} value={plan}>{plan}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Subscription start">
                    <input
                      className={input}
                      type="date"
                      disabled={!isSuperAdmin}
                      value={form.subscription.startDate}
                      onChange={(event) => updateNested("subscription", "startDate", event.target.value)}
                    />
                  </Field>
                  <Field label="Subscription end">
                    <input
                      className={input}
                      type="date"
                      disabled={!isSuperAdmin}
                      value={form.subscription.endDate}
                      onChange={(event) => updateNested("subscription", "endDate", event.target.value)}
                    />
                  </Field>
                  <Field label="Base currency">
                    <input
                      className={input}
                      value={form.settings.currency}
                      onChange={(event) => updateNested("settings", "currency", event.target.value.toUpperCase())}
                      placeholder="BDT"
                    />
                  </Field>
                  <Field label="Timezone">
                    <input
                      className={input}
                      value={form.settings.timezone}
                      onChange={(event) => updateNested("settings", "timezone", event.target.value)}
                      placeholder="Asia/Dhaka"
                    />
                  </Field>
                  <Field label="Fiscal year starts">
                    <input
                      className={input}
                      value={form.settings.fiscalYearStart}
                      onChange={(event) => updateNested("settings", "fiscalYearStart", event.target.value)}
                      placeholder="01-01"
                    />
                  </Field>
                  <Field label="Date format">
                    <select
                      className={input}
                      value={form.settings.dateFormat}
                      onChange={(event) => updateNested("settings", "dateFormat", event.target.value)}
                    >
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </Field>
                </div>
              </div>

              <div className={`${card} p-4`}>
                <SectionTitle
                  icon={<HIcon icon={File02Icon} />}
                  title="Internal note"
                  subtitle="Visible only to ERP platform administrators"
                />
                <textarea
                  className={textarea}
                  value={form.note}
                  onChange={(event) => updateForm("note", event.target.value)}
                  placeholder="Onboarding requirements, commercial terms or setup notes..."
                />
              </div>
            </div>

            <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
              <div className={`${card} p-4`}>
                <div className="flex items-center gap-3">
                  <CompanyAvatar company={form} size="h-14 w-14" />
                  <div className="min-w-0">
                    <p className="truncate text-base font-extrabold text-gray-900">{form.name || "New company"}</p>
                    <p className="mt-1 truncate text-xs font-semibold text-gray-500">
                      {form.code || "COMPANY CODE"} · {form.industry || "Industry"}
                    </p>
                  </div>
                </div>
                <div className="mt-4 rounded-xl bg-gray-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-extrabold text-gray-500">Setup completion</span>
                    <span className="text-sm font-black text-indigo-700">{completion}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${completion}%` }} />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-indigo-50 p-3">
                    <p className="text-[11px] font-extrabold uppercase tracking-wide text-indigo-400">ERP modules</p>
                    <p className="mt-1 text-xl font-black text-indigo-700">{form.moduleIds.length}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3">
                    <p className="text-[11px] font-extrabold uppercase tracking-wide text-gray-400">Plan</p>
                    <p className="mt-1 truncate text-sm font-black text-gray-900">{form.subscription.plan}</p>
                  </div>
                </div>
              </div>

              <LocationPreview address={form.address} compact />

              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-700 ring-1 ring-indigo-100">
                    <BranchIcon />
                  </span>
                  <div>
                    <p className="text-sm font-extrabold text-indigo-900">Multi-branch structure</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-indigo-700">
                      Create the company once. Store head office and additional branches as child records using the same company ID.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700 ring-1 ring-amber-100">
                    <HIcon icon={SecurityCheckIcon} />
                  </span>
                  <div>
                    <p className="text-sm font-extrabold text-amber-900">Access model</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-amber-800">
                      Module access decides what the company owns. Roles and permissions decide what each employee can use.
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </form>
      </Modal>

      <Modal
        open={statusState.open}
        title={companyStatus(statusState.company) === "active" ? "Suspend Company" : "Reactivate Company"}
        subtitle={statusState.company?.name || "Update company operational access"}
        icon={<HIcon icon={SecurityCheckIcon} />}
        onClose={() =>
          statusState.loading || setStatusState({ open: false, company: null, loading: false })
        }
        maxWidthClass="max-w-xl"
        footer={
          <div className="flex justify-end gap-2">
            <button
              className={`${btn} ${btnGhost}`}
              type="button"
              disabled={statusState.loading}
              onClick={() => setStatusState({ open: false, company: null, loading: false })}
            >
              Cancel
            </button>
            <button
              className={`${btn} ${companyStatus(statusState.company) === "active" ? btnDanger : btnPrimary}`}
              type="button"
              disabled={statusState.loading}
              onClick={changeCompanyStatus}
            >
              {statusState.loading
                ? "Updating..."
                : companyStatus(statusState.company) === "active"
                  ? "Suspend Company"
                  : "Reactivate Company"}
            </button>
          </div>
        }
      >
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <p className="text-sm font-extrabold text-amber-900">
            {companyStatus(statusState.company) === "active"
              ? "Suspending will block company users from accessing the ERP without deleting operational data."
              : "Reactivating will restore company access according to its assigned modules and user permissions."}
          </p>
          <p className="mt-2 text-xs font-semibold leading-5 text-amber-800">
            Existing transactions, audit logs, branches and configuration remain preserved.
          </p>
        </div>
      </Modal>
      {branchCompany ? (
        <CompanyBranchesModal
          company={branchCompany}
          role={currentUser?.role}
          onClose={() => setBranchCompany(null)}
          onChanged={() => loadCompanies(page)}
        />
      ) : null}
    </div>
  )
}
