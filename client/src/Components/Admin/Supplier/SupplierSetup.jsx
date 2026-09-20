"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { motion } from "framer-motion"
import toast, { Toaster } from "react-hot-toast"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Alert02Icon,
  Archive02Icon,
  Cancel01Icon,
  Edit02Icon,
  FilterIcon,
  FloppyDiskIcon,
  FolderLibraryIcon,
  RefreshIcon,
  RestoreBinIcon,
  Search01Icon,
  Tick02Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons"
import { hasPermission, PERMISSIONS } from "../../Auth/permissions"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const SUPPLIER_MANAGE_PERMISSION =
  PERMISSIONS?.SUPPLIER_MANAGE || "supplier:manage"
const SUPPLIER_APPROVE_PERMISSION =
  PERMISSIONS?.SUPPLIER_APPROVE || "supplier:approve"
const SUPPLIER_DELETE_PERMISSION =
  PERMISSIONS?.SUPPLIER_DELETE || "supplier:delete"

const FALLBACK_META = {
  supplierTypes: [
    "manufacturer",
    "distributor",
    "wholesaler",
    "retailer",
    "service_provider",
    "contractor",
    "importer",
    "exporter",
    "other",
  ],
  supplierScopes: ["local", "international", "foreign"],
  supplierStatuses: [
    "draft",
    "pending_approval",
    "active",
    "on_hold",
    "inactive",
    "archived",
  ],
  paymentTermTypes: [
    "immediate",
    "net_7",
    "net_15",
    "net_30",
    "net_45",
    "net_60",
    "net_90",
    "lc",
    "sight_lc",
    "usance_lc",
    "deferred",
    "cad",
    "advance",
    "custom",
  ],
  taxTreatments: ["unregistered", "registered", "exempt", "zero_rated"],
  addressTypes: [
    "office",
    "billing",
    "shipping",
    "warehouse",
    "registered",
    "other",
  ],
  documentTypes: [
    "trade_license",
    "tin_certificate",
    "bin_certificate",
    "vat_certificate",
    "contract",
    "bank_document",
    "compliance_certificate",
    "other",
  ],
}

const PAYMENT_DAYS = {
  immediate: 0,
  net_7: 7,
  net_15: 15,
  net_30: 30,
  net_45: 45,
  net_60: 60,
  net_90: 90,
}


const shell = "min-h-screen bg-gradient-to-b from-gray-50 to-white"
const card =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]"
const button =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
const primaryButton =
  "bg-indigo-600 text-white shadow-sm shadow-indigo-600/10 hover:bg-indigo-700"
const ghostButton =
  "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
const dangerButton =
  "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
const warningButton =
  "border border-amber-200 bg-white text-amber-700 hover:bg-amber-50"
const successButton =
  "border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
const input =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-transparent focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
const inputError =
  "!border-rose-400 !bg-rose-50/20 text-rose-900 focus-visible:!ring-rose-500/40"
const chip =
  "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold ring-1"

function cn(...classes) {
  return classes.filter(Boolean).join(" ")
}

function clean(value) {
  return String(value ?? "").trim()
}

function pretty(value) {
  return String(value || "-")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function formatNumber(value, maximumFractionDigits = 2) {
  return Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits,
  })
}

function formatMoney(value, currency = "BDT") {
  return `${clean(currency || "BDT")} ${formatNumber(value, 2)}`
}

function formatDate(value, includeTime = false) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"

  return date.toLocaleString(
    undefined,
    includeTime
      ? {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      : {
          year: "numeric",
          month: "short",
          day: "numeric",
        }
  )
}

function toDateInput(value) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString().slice(0, 10)
}

function relationLabel(item, fallback = "System") {
  if (!item) return fallback
  const name = item.name || item.businessName || item.email || fallback
  const code = item.code || ""
  return `${name}${code ? ` (${code})` : ""}`
}

function formatAddress(address = {}) {
  return [
    address.addressLine1,
    address.addressLine2,
    address.area,
    address.city,
    address.state,
    address.postalCode,
    address.country,
  ]
    .filter((value) => clean(value))
    .join(", ") || "No address"
}

function newContact(isPrimary = false) {
  return {
    _id: undefined,
    clientId: `${Date.now()}-${Math.random()}`,
    name: "",
    designation: "",
    department: "",
    email: "",
    phone: "",
    mobile: "",
    isPrimary,
    canReceivePurchaseOrders: true,
    canReceivePaymentNotices: false,
    notes: "",
  }
}

function newAddress(isPrimary = false) {
  return {
    _id: undefined,
    clientId: `${Date.now()}-${Math.random()}`,
    addressType: "office",
    label: "",
    addressLine1: "",
    addressLine2: "",
    area: "",
    city: "",
    state: "",
    postalCode: "",
    country: "Bangladesh",
    isPrimary,
  }
}

function newBank(isPrimary = false) {
  return {
    _id: undefined,
    clientId: `${Date.now()}-${Math.random()}`,
    bankName: "",
    branchName: "",
    accountName: "",
    accountNumber: "",
    routingNumber: "",
    swiftCode: "",
    iban: "",
    currency: "BDT",
    beneficiaryName: "",
    bicCode: "",
    bankAddress: "",
    bankCountry: "",
    isPrimary,
    isActive: true,
  }
}

function newDocument() {
  return {
    _id: undefined,
    clientId: `${Date.now()}-${Math.random()}`,
    documentType: "other",
    title: "",
    documentNo: "",
    url: "",
    issuedAt: "",
    expiresAt: "",
    isActive: true,
    notes: "",
  }
}

function emptySupplierForm() {
  return {
    code: "",
    businessName: "",
    legalName: "",
    supplierType: "wholesaler",
    supplierScope: "local",
    country: "Bangladesh",
    isPreferred: false,
    primaryEmail: "",
    primaryPhone: "",
    website: "",
    contactPersons: [newContact(true)],
    addresses: [newAddress(true)],
    tax: {
      taxTreatment: "unregistered",
      tradeLicenseNo: "",
      tin: "",
      bin: "",
      registrationNo: "",
    },
    procurement: {
      currency: "BDT",
      paymentTermType: "immediate",
      paymentTermDays: "0",
      creditLimit: "0",
      minimumOrderValue: "0",
      leadTimeDays: "0",
      incoterm: "",
      deliveryNotes: "",
    },
    bankAccounts: [],
    documents: [],
    tagsText: "",
    notes: "",
  }
}

function hydrateSupplierForm(supplier = {}) {
  const contacts = (supplier.contactPersons || []).map((item) => ({
    ...newContact(false),
    ...item,
    clientId: item._id || `${Date.now()}-${Math.random()}`,
  }))
  const addresses = (supplier.addresses || []).map((item) => ({
    ...newAddress(false),
    ...item,
    clientId: item._id || `${Date.now()}-${Math.random()}`,
  }))
  const banks = (supplier.bankAccounts || []).map((item) => ({
    ...newBank(false),
    ...item,
    clientId: item._id || `${Date.now()}-${Math.random()}`,
  }))
  const documents = (supplier.documents || []).map((item) => ({
    ...newDocument(),
    ...item,
    clientId: item._id || `${Date.now()}-${Math.random()}`,
    issuedAt: toDateInput(item.issuedAt),
    expiresAt: toDateInput(item.expiresAt),
  }))

  return {
    code: supplier.code || "",
    businessName: supplier.businessName || "",
    legalName: supplier.legalName || "",
    supplierType: supplier.supplierType || "wholesaler",
    supplierScope: supplier.supplierScope || "local",
    country:
      supplier.country ||
      supplier.addresses?.find((a) => a.isPrimary)?.country ||
      "Bangladesh",
    isPreferred: Boolean(supplier.isPreferred),
    primaryEmail: supplier.primaryEmail || "",
    primaryPhone: supplier.primaryPhone || "",
    website: supplier.website || "",
    contactPersons: contacts.length ? contacts : [newContact(true)],
    addresses: addresses.length ? addresses : [newAddress(true)],
    tax: {
      taxTreatment: supplier.tax?.taxTreatment || "unregistered",
      tradeLicenseNo: supplier.tax?.tradeLicenseNo || "",
      tin: supplier.tax?.tin || "",
      bin: supplier.tax?.bin || "",
      registrationNo: supplier.tax?.registrationNo || "",
    },
    procurement: {
      currency: supplier.procurement?.currency || "BDT",
      paymentTermType:
        supplier.procurement?.paymentTermType || "immediate",
      paymentTermDays: String(
        supplier.procurement?.paymentTermDays ?? 0
      ),
      creditLimit: String(supplier.procurement?.creditLimit ?? 0),
      minimumOrderValue: String(
        supplier.procurement?.minimumOrderValue ?? 0
      ),
      leadTimeDays: String(
        supplier.procurement?.leadTimeDays ?? 0
      ),
      incoterm: supplier.procurement?.incoterm || "",
      deliveryNotes: supplier.procurement?.deliveryNotes || "",
    },
    bankAccounts: banks,
    documents,
    tagsText: (supplier.tags || []).join(", "),
    notes: supplier.notes || "",
  }
}

function Icon({
  icon,
  className = "h-4 w-4",
  strokeWidth = 1.8,
  ...props
}) {
  return (
    <HugeiconsIcon
      icon={icon}
      className={className}
      strokeWidth={strokeWidth}
      {...props}
    />
  )
}

function Spinner({ className = "h-4 w-4" }) {
  return <Icon icon={RefreshIcon} className={cn(className, "animate-spin")} />
}

function SkeletonBlock({ className = "h-4 w-full" }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-lg bg-gray-200/80",
        className
      )}
    />
  )
}

function SupplierTableSkeleton({ rows = 8 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <tr key={`supplier-skeleton-${index}`} className="bg-white" aria-hidden="true">
          <td className="border-b border-gray-100 px-5 py-4 text-center">
            <SkeletonBlock className="mx-auto h-4 w-4 rounded" />
          </td>
          <td className="border-b border-gray-100 px-5 py-4">
            <div className="min-w-[230px] space-y-2">
              <SkeletonBlock className="h-4 w-36" />
              <SkeletonBlock className="h-3 w-20" />
            </div>
          </td>
          <td className="border-b border-gray-100 px-5 py-4"><SkeletonBlock className="h-7 w-24 rounded-full" /></td>
          <td className="border-b border-gray-100 px-5 py-4"><SkeletonBlock className="h-7 w-20 rounded-full" /></td>
          <td className="border-b border-gray-100 px-5 py-4">
            <div className="min-w-[180px] space-y-2">
              <SkeletonBlock className="h-4 w-36" />
              <SkeletonBlock className="h-3 w-24" />
            </div>
          </td>
          <td className="border-b border-gray-100 px-5 py-4"><SkeletonBlock className="h-4 w-24" /></td>
          <td className="border-b border-gray-100 px-5 py-4">
            <div className="min-w-[140px] space-y-2">
              <SkeletonBlock className="h-4 w-28" />
              <SkeletonBlock className="h-3 w-16" />
            </div>
          </td>
          <td className="border-b border-gray-100 px-5 py-4"><SkeletonBlock className="h-4 w-28" /></td>
          <td className="border-b border-gray-100 px-5 py-4"><SkeletonBlock className="h-4 w-16" /></td>
          <td className="border-b border-gray-100 px-5 py-4"><SkeletonBlock className="h-7 w-24 rounded-full" /></td>
          <td className="border-b border-gray-100 px-5 py-4"><SkeletonBlock className="h-7 w-24 rounded-full" /></td>
          <td className="border-b border-gray-100 px-5 py-4"><SkeletonBlock className="h-4 w-28" /></td>
          <td className="sticky right-0 z-10 border-b border-gray-100 bg-white px-5 py-3 text-right shadow-[-14px_0_24px_-22px_rgba(15,23,42,0.45)]">
            <div className="flex justify-end gap-2">
              <SkeletonBlock className="h-10 w-20 rounded-xl" />
              <SkeletonBlock className="h-10 w-10 rounded-xl" />
            </div>
          </td>
        </tr>
      ))}
    </>
  )
}

function SupplierMobileSkeleton({ rows = 5 }) {
  return (
    <div className="divide-y divide-gray-100" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={`mobile-supplier-skeleton-${index}`} className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <SkeletonBlock className="mt-1 h-4 w-4 shrink-0 rounded" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <SkeletonBlock className="h-5 w-40 max-w-full" />
                  <SkeletonBlock className="h-3 w-24" />
                </div>
                <SkeletonBlock className="h-10 w-10 shrink-0 rounded-xl" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <SkeletonBlock className="h-7 w-24 rounded-full" />
                <SkeletonBlock className="h-7 w-20 rounded-full" />
                <SkeletonBlock className="h-7 w-24 rounded-full" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <SkeletonBlock className="h-12 w-full rounded-xl" />
                <SkeletonBlock className="h-12 w-full rounded-xl" />
              </div>
              <div className="mt-4 flex gap-2">
                <SkeletonBlock className="h-10 flex-1 rounded-xl" />
                <SkeletonBlock className="h-10 w-12 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function SelectionCheckbox({ checked, indeterminate = false, onChange, label }) {
  const ref = useRef(null)

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate)
  }, [indeterminate])

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={Boolean(checked)}
      onChange={(event) => onChange?.(event.target.checked)}
      aria-label={label}
      className="h-4 w-4 cursor-pointer rounded border-gray-300 text-indigo-600 accent-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
    />
  )
}

function RequiredMark() {
  return <span className="ml-1 text-rose-500">*</span>
}

function Field({
  label,
  children,
  hint,
  required = false,
  error = "",
  id = "",
  className = "",
}) {
  return (
    <div id={id || undefined} className={className || undefined}>
      <label className="mb-1.5 block text-sm font-semibold text-gray-800">
        {label}
        {required ? <RequiredMark /> : null}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-rose-600">
          <Icon icon={Alert02Icon} className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs font-medium text-gray-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

function SectionCard({ title, description, action, children }) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-black text-gray-900">{title}</h3>
          {description ? (
            <p className="mt-1 text-xs font-semibold leading-5 text-gray-500">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function FocusPlaceholderInput({
  placeholder = "",
  onFocus,
  onBlur,
  ...props
}) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      {...props}
      placeholder={focused ? placeholder : ""}
      onFocus={(event) => {
        setFocused(true)
        onFocus?.(event)
      }}
      onBlur={(event) => {
        setFocused(false)
        onBlur?.(event)
      }}
    />
  )
}

function FocusPlaceholderTextarea({
  placeholder = "",
  onFocus,
  onBlur,
  ...props
}) {
  const [focused, setFocused] = useState(false)
  return (
    <textarea
      {...props}
      placeholder={focused ? placeholder : ""}
      onFocus={(event) => {
        setFocused(true)
        onFocus?.(event)
      }}
      onBlur={(event) => {
        setFocused(false)
        onBlur?.(event)
      }}
    />
  )
}

function Toggle({ checked, onChange, disabled = false, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-indigo-600" : "bg-gray-300"
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  )
}

function StatusBadge({ value }) {
  const status = String(value || "").toLowerCase()
  const style =
    status === "active"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : status === "draft"
        ? "bg-indigo-50 text-indigo-700 ring-indigo-100"
        : status === "pending_approval"
          ? "bg-sky-50 text-sky-700 ring-sky-100"
          : status === "on_hold"
            ? "bg-amber-50 text-amber-700 ring-amber-100"
            : status === "archived"
              ? "bg-orange-50 text-orange-700 ring-orange-100"
              : "bg-gray-100 text-gray-700 ring-gray-200"

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ring-1",
        style
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "active"
            ? "bg-emerald-500"
            : status === "draft"
              ? "bg-indigo-500"
              : status === "pending_approval"
                ? "bg-sky-500"
                : status === "on_hold"
                  ? "bg-amber-500"
                  : status === "archived"
                    ? "bg-orange-500"
                    : "bg-gray-400"
        )}
      />
      {pretty(value)}
    </span>
  )
}

function TypeBadge({ value }) {
  return (
    <span className="inline-flex rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700 ring-1 ring-violet-100">
      {pretty(value)}
    </span>
  )
}

function ScopeBadge({ value }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-black ring-1",
        value === "foreign"
          ? "bg-purple-50 text-purple-700 ring-purple-100"
          : value === "international"
            ? "bg-sky-50 text-sky-700 ring-sky-100"
            : "bg-gray-100 text-gray-700 ring-gray-200"
      )}
    >
      {pretty(value)}
    </span>
  )
}

function PreferredBadge({ value }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-black ring-1",
        value
          ? "bg-indigo-50 text-indigo-700 ring-indigo-100"
          : "bg-gray-100 text-gray-500 ring-gray-200"
      )}
    >
      {value ? "Preferred" : "Standard"}
    </span>
  )
}

function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  maxWidthClass = "max-w-5xl",
}) {
  useEffect(() => {
    if (!open) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 overflow-y-auto">
        <div className="flex min-h-full items-start justify-center p-4 sm:items-center sm:p-6">
          <motion.button
            type="button"
            aria-label="Close modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 cursor-default bg-black/40 backdrop-blur-md"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className={cn(
              "relative w-full overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_30px_70px_-30px_rgba(0,0,0,0.65)]",
              maxWidthClass
            )}
          >
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-100 bg-white p-4 sm:p-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
                  {icon}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-bold text-gray-900 sm:text-lg">
                    {title}
                  </h2>
                  {subtitle ? (
                    <p className="truncate text-sm text-gray-600">
                      {subtitle}
                    </p>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-gray-700 transition hover:bg-gray-100"
                aria-label="Close modal"
              >
                <Icon icon={Cancel01Icon} className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(100vh-14rem)] overflow-y-auto bg-white p-4 sm:p-5">
              {children}
            </div>

            {footer ? (
              <div className="sticky bottom-0 z-20 border-t border-gray-100 bg-white p-4 sm:p-5">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </div>
      </div>
    </div>,
    document.body
  )
}

function headers() {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...headers(),
      ...(options.headers || {}),
    },
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(
      data?.message || data?.error || "Request failed"
    )
    error.data = data
    error.status = response.status
    throw error
  }
  return data
}

export default function SupplierSetup() {
  const currentUser = useMemo(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "null")
      return stored?.user || stored
    } catch {
      return null
    }
  }, [])

  const canManage = hasPermission(currentUser, SUPPLIER_MANAGE_PERMISSION)
  const canApprove = hasPermission(currentUser, SUPPLIER_APPROVE_PERMISSION)
  const canDelete = hasPermission(currentUser, SUPPLIER_DELETE_PERMISSION)

  const [meta, setMeta] = useState(FALLBACK_META)
  const [activeTab, setActiveTab] = useState("all")
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const [openingId, setOpeningId] = useState("")
  const [loadingDetailsId, setLoadingDetailsId] = useState("")
  const [filterOpen, setFilterOpen] = useState(false)
  const [nextCursor, setNextCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)

  const [formModal, setFormModal] = useState({ open: false, item: null })
  const [form, setForm] = useState(emptySupplierForm)
  const [formError, setFormError] = useState("")
  const [fieldErrors, setFieldErrors] = useState({})

  const [detailsModal, setDetailsModal] = useState({
    open: false,
    supplier: null,
    stats: null,
    tab: "overview",
  })
  const [audits, setAudits] = useState([])
  const [auditCursor, setAuditCursor] = useState(null)
  const [auditHasMore, setAuditHasMore] = useState(false)
  const [auditLoading, setAuditLoading] = useState(false)

  const [reasonModal, setReasonModal] = useState({
    open: false,
    type: "",
    supplier: null,
    targetStatus: "",
    reason: "",
    error: "",
  })

  const [actionState, setActionState] = useState({ id: "", type: "" })
  const [selectedIds, setSelectedIds] = useState([])
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    type: "",
    supplier: null,
    title: "",
    message: "",
    danger: false,
    loading: false,
    error: "",
  })
  const [deleteModal, setDeleteModal] = useState({
    open: false,
    suppliers: [],
    password: "",
    loading: false,
    error: "",
  })
  const [bulkModal, setBulkModal] = useState({
    open: false,
    type: "",
    reason: "",
    loading: false,
    error: "",
  })

  const [filters, setFilters] = useState({
    q: "",
    supplierType: "all",
    supplierScope: "all",
    currency: "all",
    isPreferred: "all",
    tag: "",
    updatedFrom: "",
    updatedTo: "",
  })

  const activeFilterCount = useMemo(() => {
    let count = activeTab !== "all" ? 1 : 0
    if (clean(filters.q)) count += 1
    if (filters.supplierType !== "all") count += 1
    if (filters.supplierScope !== "all") count += 1
    if (filters.currency !== "all") count += 1
    if (filters.isPreferred !== "all") count += 1
    if (clean(filters.tag)) count += 1
    if (filters.updatedFrom) count += 1
    if (filters.updatedTo) count += 1
    return count
  }, [activeTab, filters])

  const selectedSuppliers = useMemo(
    () => suppliers.filter((supplier) => selectedIds.includes(String(supplier._id))),
    [suppliers, selectedIds]
  )
  const allLoadedSelected =
    suppliers.length > 0 &&
    suppliers.every((supplier) => selectedIds.includes(String(supplier._id)))
  const someLoadedSelected =
    !allLoadedSelected &&
    suppliers.some((supplier) => selectedIds.includes(String(supplier._id)))

  const toggleSupplierSelection = (supplierId, checked) => {
    const id = String(supplierId)
    setSelectedIds((previous) =>
      checked
        ? Array.from(new Set([...previous, id]))
        : previous.filter((item) => item !== id)
    )
  }

  const toggleAllLoadedSuppliers = (checked) => {
    const loadedIds = suppliers.map((supplier) => String(supplier._id))
    setSelectedIds((previous) => {
      if (checked) return Array.from(new Set([...previous, ...loadedIds]))
      const loadedSet = new Set(loadedIds)
      return previous.filter((id) => !loadedSet.has(id))
    })
  }

  const clearSelection = () => setSelectedIds([])

  useEffect(() => {
    const visibleIds = new Set(suppliers.map((supplier) => String(supplier._id)))
    setSelectedIds((previous) => previous.filter((id) => visibleIds.has(id)))
  }, [suppliers])

  const updateFilter = (key, value) => {
    setFilters((previous) => ({ ...previous, [key]: value }))
  }

  const resetFilters = () => {
    setActiveTab("all")
    setFilters({
      q: "",
      supplierType: "all",
      supplierScope: "all",
      currency: "all",
      isPreferred: "all",
      tag: "",
      updatedFrom: "",
      updatedTo: "",
    })
  }

  const buildParams = ({ append = false, includeStatus = true } = {}) => {
    const params = new URLSearchParams()
    if (append) params.set("limit", "40")
    else params.set("limit", "40")

    if (includeStatus && activeTab !== "all") {
      params.set("status", activeTab)
    }
    if (clean(filters.q)) params.set("q", clean(filters.q))
    if (filters.supplierType !== "all") {
      params.set("supplierType", filters.supplierType)
    }
    if (filters.supplierScope !== "all") {
      params.set("supplierScope", filters.supplierScope)
    }
    if (filters.currency !== "all") {
      params.set("currency", filters.currency)
    }
    if (filters.isPreferred !== "all") {
      params.set("isPreferred", filters.isPreferred)
    }
    if (clean(filters.tag)) params.set("tag", clean(filters.tag))
    if (filters.updatedFrom) {
      params.set("updatedFrom", filters.updatedFrom)
    }
    if (filters.updatedTo) params.set("updatedTo", filters.updatedTo)
    if (append && nextCursor) params.set("cursor", nextCursor)
    return params
  }

  const loadMeta = async () => {
    try {
      const data = await api("/suppliers/meta")
      setMeta({ ...FALLBACK_META, ...data })
    } catch {
      setMeta(FALLBACK_META)
    }
  }

  const loadSuppliers = async ({
    append = false,
    showLoader = true,
    signal,
  } = {}) => {
    if (append) setLoadingMore(true)
    else if (showLoader) setLoading(true)

    try {
      const data = await api(
        `/suppliers?${buildParams({ append }).toString()}`,
        { signal }
      )
      const incoming = data.suppliers || []
      setSuppliers((previous) =>
        append ? [...previous, ...incoming] : incoming
      )
      setHasMore(Boolean(data.hasMore))
      setNextCursor(data.nextCursor || null)
    } catch (error) {
      if (error?.name !== "AbortError") {
        toast.error(error.message || "Failed to load suppliers")
      }
    } finally {
      if (append) setLoadingMore(false)
      else if (showLoader) setLoading(false)
    }
  }

  useEffect(() => {
    loadMeta()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      loadSuppliers({ signal: controller.signal })
    }, 250)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [
    activeTab,
    filters.q,
    filters.supplierType,
    filters.supplierScope,
    filters.currency,
    filters.isPreferred,
    filters.tag,
    filters.updatedFrom,
    filters.updatedTo,
  ])

  const refresh = async () => {
    await Promise.all([loadMeta(), loadSuppliers()])
  }

  const switchTab = (tab) => {
    setActiveTab(tab)
    setFilterOpen(false)
    setNextCursor(null)
    setHasMore(false)
  }

  const openCreateModal = () => {
    setForm(emptySupplierForm())
    setFormError("")
    setFieldErrors({})
    setFormModal({ open: true, item: null })
  }

  const openEditModal = async (supplier) => {
    setOpeningId(supplier._id)
    setFormError("")
    setFieldErrors({})
    try {
      const data = await api(`/suppliers/${supplier._id}`)
      setForm(hydrateSupplierForm(data.supplier))
      setFormModal({ open: true, item: data.supplier })
    } catch (error) {
      toast.error(error.message || "Failed to load supplier")
    } finally {
      setOpeningId("")
    }
  }

  const closeFormModal = () => {
    if (saving) return
    setFormModal({ open: false, item: null })
    setForm(emptySupplierForm())
    setFormError("")
    setFieldErrors({})
  }

  const normalizePrimary = (items, clientId) =>
    items.map((item) => ({
      ...item,
      isPrimary: item.clientId === clientId,
    }))

  const updateArrayItem = (field, clientId, key, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: previous[field].map((item) =>
        item.clientId === clientId ? { ...item, [key]: value } : item
      ),
    }))

    if (field === "contactPersons") {
      setFieldErrors((previous) => {
        if (!previous || !Object.keys(previous).length) return previous
        const contactIndex = form.contactPersons.findIndex(
          (item) => item.clientId === clientId
        )
        if (contactIndex === -1) return previous
        const next = { ...previous }
        delete next[`contact_${contactIndex}_${key}`]
        if (["email", "phone", "mobile"].includes(key) && clean(value)) {
          delete next[`contact_${contactIndex}_group`]
          delete next[`contact_${contactIndex}`]
        }
        if (key === "name" && clean(value)) {
          delete next[`contact_${contactIndex}_name`]
        }
        return next
      })
    } else if (field === "bankAccounts") {
      setFieldErrors((previous) => {
        if (!previous || !Object.keys(previous).length) return previous
        const bankIndex = form.bankAccounts.findIndex(
          (item) => item.clientId === clientId
        )
        if (bankIndex === -1) return previous
        const next = { ...previous }
        delete next[`bank_${bankIndex}`]
        return next
      })
    } else if (field === "documents") {
      setFieldErrors((previous) => {
        if (!previous || !Object.keys(previous).length) return previous
        const docIndex = form.documents.findIndex(
          (item) => item.clientId === clientId
        )
        if (docIndex === -1) return previous
        const next = { ...previous }
        delete next[`document_${docIndex}`]
        return next
      })
    }
  }

  const setPrimaryItem = (field, clientId) => {
    setForm((previous) => ({
      ...previous,
      [field]: normalizePrimary(previous[field], clientId),
    }))
  }

  const addArrayItem = (field, item, max) => {
    setForm((previous) => {
      if (previous[field].length >= max) {
        toast.error(`A supplier cannot have more than ${max} ${field}.`)
        return previous
      }
      return { ...previous, [field]: [...previous[field], item] }
    })
  }

  const removeArrayItem = (field, clientId, minimum = 0) => {
    setForm((previous) => {
      if (previous[field].length <= minimum) {
        toast.error(`At least ${minimum} record is required.`)
        return previous
      }
      const remaining = previous[field].filter(
        (item) => item.clientId !== clientId
      )
      if (remaining.length && !remaining.some((item) => item.isPrimary)) {
        remaining[0] = { ...remaining[0], isPrimary: true }
      }
      return { ...previous, [field]: remaining }
    })
    setFieldErrors({})
  }

  const changePaymentTerm = (paymentTermType) => {
    setForm((previous) => ({
      ...previous,
      procurement: {
        ...previous.procurement,
        paymentTermType,
        paymentTermDays:
          paymentTermType === "custom"
            ? previous.procurement.paymentTermDays
            : String(PAYMENT_DAYS[paymentTermType] ?? 0),
      },
    }))
  }

  const scrollToField = (fieldId) => {
    if (!fieldId || typeof document === "undefined") return
    setTimeout(() => {
      let element = document.getElementById(fieldId)
      if (!element && fieldId.endsWith("-group")) {
        const cardId = fieldId.replace("-group", "")
        element = document.getElementById(cardId)
      }
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" })
        const targetInput =
          element.querySelector(
            "input:not([disabled]), select:not([disabled]), textarea:not([disabled])"
          ) || element
        if (typeof targetInput.focus === "function") {
          try {
            targetInput.focus({ preventScroll: true })
          } catch {
            targetInput.focus()
          }
        }
      }
    }, 80)
  }

  const validateForm = () => {
    const errors = {}
    let firstKey = ""
    let firstId = ""

    const setErr = (key, id, msg) => {
      if (!errors[key]) {
        errors[key] = msg
        if (!firstKey) {
          firstKey = key
          firstId = id
        }
      }
    }

    if (!clean(form.code)) {
      setErr("code", "field-code", "Supplier code is required.")
    }
    if (!clean(form.businessName)) {
      setErr(
        "businessName",
        "field-businessName",
        "Supplier business name is required."
      )
    }
    if (
      (form.supplierScope === "foreign" || form.supplierScope === "international") &&
      !clean(form.country)
    ) {
      setErr(
        "country",
        "field-country",
        "Country is required for foreign or international suppliers."
      )
    }
    if (
      form.primaryEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.primaryEmail)
    ) {
      setErr("primaryEmail", "field-primaryEmail", "Primary email is invalid.")
    }
    if (form.website && !/^https?:\/\//i.test(form.website)) {
      setErr(
        "website",
        "field-website",
        "Website must start with http:// or https://."
      )
    }

    for (let index = 0; index < form.contactPersons.length; index += 1) {
      const contact = form.contactPersons[index]
      if (!clean(contact.name)) {
        setErr(
          `contact_${index}_name`,
          `field-contact-${index}-name`,
          `Contact ${index + 1} name is required.`
        )
      }
      if (
        contact.email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)
      ) {
        setErr(
          `contact_${index}_email`,
          `field-contact-${index}-email`,
          `Contact ${index + 1} email is invalid.`
        )
      }
      if (
        !clean(contact.email) &&
        !clean(contact.phone) &&
        !clean(contact.mobile)
      ) {
        setErr(
          `contact_${index}_group`,
          `field-contact-${index}-group`,
          `Contact ${index + 1} requires an email, phone, or mobile number.`
        )
      }
    }

    for (let index = 0; index < form.bankAccounts.length; index += 1) {
      const bank = form.bankAccounts[index]
      const hasValue = [
        bank.bankName,
        bank.accountName,
        bank.accountNumber,
      ].some((value) => clean(value))
      if (
        hasValue &&
        (!clean(bank.bankName) ||
          !clean(bank.accountName) ||
          !clean(bank.accountNumber))
      ) {
        setErr(
          `bank_${index}`,
          `field-bank-${index}`,
          `Bank account ${index + 1} requires bank name, account name, and account number.`
        )
      }
    }

    const paymentDays = Number(form.procurement.paymentTermDays || 0)
    const creditLimit = Number(form.procurement.creditLimit || 0)
    const minimumOrderValue = Number(
      form.procurement.minimumOrderValue || 0
    )
    const leadTimeDays = Number(form.procurement.leadTimeDays || 0)

    if (
      !Number.isInteger(paymentDays) ||
      paymentDays < 0 ||
      paymentDays > 3650
    ) {
      setErr(
        "procurement_paymentTermDays",
        "field-paymentTermDays",
        "Payment term days must be a whole number between 0 and 3650."
      )
    }
    if (
      form.procurement.paymentTermType === "custom" &&
      paymentDays <= 0
    ) {
      setErr(
        "procurement_paymentTermDays",
        "field-paymentTermDays",
        "Custom payment terms require payment term days greater than zero."
      )
    }
    if (!Number.isFinite(creditLimit) || creditLimit < 0) {
      setErr(
        "procurement_creditLimit",
        "field-creditLimit",
        "Credit limit must be a valid non-negative number."
      )
    }
    if (!Number.isFinite(minimumOrderValue) || minimumOrderValue < 0) {
      setErr(
        "procurement_minimumOrderValue",
        "field-minimumOrderValue",
        "Minimum order value must be a valid non-negative number."
      )
    }
    if (
      !Number.isInteger(leadTimeDays) ||
      leadTimeDays < 0 ||
      leadTimeDays > 3650
    ) {
      setErr(
        "procurement_leadTimeDays",
        "field-leadTimeDays",
        "Lead time must be a whole number between 0 and 3650."
      )
    }

    for (let index = 0; index < form.documents.length; index += 1) {
      const document = form.documents[index]
      if (document.url && !/^https?:\/\//i.test(document.url)) {
        setErr(
          `document_${index}`,
          `field-document-${index}`,
          `Document ${index + 1} URL must start with http:// or https://.`
        )
      }
      if (
        document.issuedAt &&
        document.expiresAt &&
        new Date(document.expiresAt) < new Date(document.issuedAt)
      ) {
        setErr(
          `document_${index}`,
          `field-document-${index}`,
          `Document ${index + 1} expiry date cannot be before its issue date.`
        )
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      firstKey,
      firstId,
    }
  }

  const buildPayload = () => ({
    code: clean(form.code).toUpperCase(),
    businessName: clean(form.businessName),
    legalName: clean(form.legalName),
    supplierType: form.supplierType,
    supplierScope: form.supplierScope,
    country: clean(form.country),
    isPreferred: Boolean(form.isPreferred),
    primaryEmail: clean(form.primaryEmail).toLowerCase(),
    primaryPhone: clean(form.primaryPhone),
    website: clean(form.website),
    contactPersons: form.contactPersons.map(
      ({ clientId: _clientId, ...contact }) => ({
        ...contact,
        email: clean(contact.email).toLowerCase(),
      })
    ),
    addresses: form.addresses.map(
      ({ clientId: _clientId, ...address }) => address
    ),
    tax: {
      taxTreatment: form.tax.taxTreatment,
      tradeLicenseNo: clean(form.tax.tradeLicenseNo).toUpperCase(),
      tin: clean(form.tax.tin).toUpperCase(),
      bin: clean(form.tax.bin).toUpperCase(),
      registrationNo: clean(form.tax.registrationNo).toUpperCase(),
    },
    procurement: {
      currency: clean(form.procurement.currency || "BDT").toUpperCase(),
      paymentTermType: form.procurement.paymentTermType,
      paymentTermDays: Number(form.procurement.paymentTermDays || 0),
      creditLimit: Number(form.procurement.creditLimit || 0),
      minimumOrderValue: Number(
        form.procurement.minimumOrderValue || 0
      ),
      leadTimeDays: Number(form.procurement.leadTimeDays || 0),
      incoterm: clean(form.procurement.incoterm).toUpperCase(),
      deliveryNotes: clean(form.procurement.deliveryNotes),
    },
    bankAccounts: form.bankAccounts.map(
      ({ clientId: _clientId, ...bank }) => ({
        ...bank,
        bankName: clean(bank.bankName),
        branchName: clean(bank.branchName),
        accountName: clean(bank.accountName),
        accountNumber: clean(bank.accountNumber),
        routingNumber: clean(bank.routingNumber),
        currency: clean(bank.currency || "BDT").toUpperCase(),
        swiftCode: clean(bank.swiftCode).toUpperCase(),
        bicCode: clean(bank.bicCode).toUpperCase(),
        iban: clean(bank.iban).toUpperCase(),
        beneficiaryName: clean(bank.beneficiaryName),
        bankAddress: clean(bank.bankAddress),
        bankCountry: clean(bank.bankCountry),
      })
    ),
    documents: form.documents.map(
      ({ clientId: _clientId, ...document }) => ({
        ...document,
        documentNo: clean(document.documentNo).toUpperCase(),
        issuedAt: document.issuedAt || null,
        expiresAt: document.expiresAt || null,
      })
    ),
    tags: [
      ...new Set(
        String(form.tagsText || "")
          .split(",")
          .map((tag) => clean(tag).toLowerCase())
          .filter(Boolean)
      ),
    ],
    notes: clean(form.notes),
  })

  const saveSupplier = async (event) => {
    event.preventDefault()
    setFormError("")
    setFieldErrors({})

    const validation = validateForm()
    if (!validation.isValid) {
      setFieldErrors(validation.errors)
      scrollToField(validation.firstId)
      return
    }

    setSaving(true)
    try {
      const data = await api(
        formModal.item?._id
          ? `/suppliers/${formModal.item._id}`
          : "/suppliers",
        {
          method: formModal.item?._id ? "PATCH" : "POST",
          body: JSON.stringify(buildPayload()),
        }
      )
      toast.success(
        data.message ||
          (formModal.item ? "Supplier updated" : "Supplier draft created")
      )
      setFormModal({ open: false, item: null })
      setForm(emptySupplierForm())
      setFormError("")
      setFieldErrors({})
      await loadSuppliers()
    } catch (error) {
      const message = error.message || "Failed to save supplier."
      const errorsList = Array.isArray(error.data?.errors)
        ? error.data.errors
        : [message]

      const parsedErrors = {}
      let firstScrollId = ""

      for (const msg of errorsList) {
        const contactReqMatch = msg.match(
          /Contact (\d+) requires an email, phone, or mobile number/i
        )
        if (contactReqMatch) {
          const idx = parseInt(contactReqMatch[1], 10) - 1
          parsedErrors[`contact_${idx}_group`] = msg
          if (!firstScrollId) firstScrollId = `field-contact-${idx}-group`
          continue
        }

        const contactNameMatch = msg.match(/Contact (\d+) name is required/i)
        if (contactNameMatch) {
          const idx = parseInt(contactNameMatch[1], 10) - 1
          parsedErrors[`contact_${idx}_name`] = msg
          if (!firstScrollId) firstScrollId = `field-contact-${idx}-name`
          continue
        }

        const contactEmailMatch = msg.match(/Contact (\d+) email is invalid/i)
        if (contactEmailMatch) {
          const idx = parseInt(contactEmailMatch[1], 10) - 1
          parsedErrors[`contact_${idx}_email`] = msg
          if (!firstScrollId) firstScrollId = `field-contact-${idx}-email`
          continue
        }

        if (/primary supplier contact requires an email/i.test(msg)) {
          const primaryIdx = Math.max(
            0,
            form.contactPersons.findIndex((c) => c.isPrimary)
          )
          parsedErrors[`contact_${primaryIdx}_group`] = msg
          if (!firstScrollId) firstScrollId = `field-contact-${primaryIdx}-group`
          continue
        }

        if (/Supplier code is required/i.test(msg)) {
          parsedErrors.code = msg
          if (!firstScrollId) firstScrollId = "field-code"
          continue
        }

        if (/Supplier business name is required/i.test(msg)) {
          parsedErrors.businessName = msg
          if (!firstScrollId) firstScrollId = "field-businessName"
          continue
        }

        if (/Primary email is invalid/i.test(msg)) {
          parsedErrors.primaryEmail = msg
          if (!firstScrollId) firstScrollId = "field-primaryEmail"
          continue
        }

        if (/Website must start with/i.test(msg)) {
          parsedErrors.website = msg
          if (!firstScrollId) firstScrollId = "field-website"
          continue
        }

        const bankMatch = msg.match(/Bank account (\d+) requires/i)
        if (bankMatch) {
          const idx = parseInt(bankMatch[1], 10) - 1
          parsedErrors[`bank_${idx}`] = msg
          if (!firstScrollId) firstScrollId = `field-bank-${idx}`
          continue
        }

        const docMatch = msg.match(/Document (\d+)/i)
        if (docMatch) {
          const idx = parseInt(docMatch[1], 10) - 1
          parsedErrors[`document_${idx}`] = msg
          if (!firstScrollId) firstScrollId = `field-document-${idx}`
          continue
        }
      }

      if (Object.keys(parsedErrors).length > 0) {
        setFieldErrors(parsedErrors)
        setFormError("")
        scrollToField(firstScrollId)
      } else {
        setFormError(message)
      }
    } finally {
      setSaving(false)
    }
  }

  const openDetailsModal = async (supplier) => {
    setLoadingDetailsId(supplier._id)
    try {
      const data = await api(`/suppliers/${supplier._id}`)
      setDetailsModal({
        open: true,
        supplier: data.supplier,
        stats: data.stats || null,
        tab: "overview",
      })
      setAudits([])
      setAuditCursor(null)
      setAuditHasMore(false)
    } catch (error) {
      toast.error(error.message || "Failed to load supplier details")
    } finally {
      setLoadingDetailsId("")
    }
  }

  const loadAudits = async ({ append = false } = {}) => {
    const supplierId = detailsModal.supplier?._id
    if (!supplierId) return
    setAuditLoading(true)
    try {
      const params = new URLSearchParams({ limit: "30" })
      if (append && auditCursor) params.set("cursor", auditCursor)
      const data = await api(
        `/suppliers/${supplierId}/audit?${params.toString()}`
      )
      setAudits((previous) =>
        append ? [...previous, ...(data.audits || [])] : data.audits || []
      )
      setAuditHasMore(Boolean(data.hasMore))
      setAuditCursor(data.nextCursor || null)
    } catch (error) {
      toast.error(error.message || "Failed to load supplier audit history")
    } finally {
      setAuditLoading(false)
    }
  }

  const changeDetailsTab = async (tab) => {
    setDetailsModal((previous) => ({ ...previous, tab }))
    if (tab === "audit" && !audits.length) {
      await loadAudits()
    }
  }

  const runAction = async (supplier, type, endpoint, options = {}) => {
    const { method = "POST", body = {} } = options
    setActionState({ id: supplier._id, type })
    try {
      const data = await api(`/suppliers/${supplier._id}/${endpoint}`, {
        method,
        body: JSON.stringify(body),
      })
      toast.success(data.message || `Supplier ${type} completed`)
      await loadSuppliers()
    } catch (error) {
      toast.error(error.message || `Failed to ${type} supplier`)
    } finally {
      setActionState({ id: "", type: "" })
    }
  }

  const openConfirmModal = (type, supplier) => {
    const config = {
      submit: {
        title: "Submit supplier",
        message: "Send this supplier for approval?",
        danger: false,
      },
      approve: {
        title: "Approve supplier",
        message: "Approve and activate this supplier?",
        danger: false,
      },
      archive: {
        title: "Archive supplier",
        message: "Archive this supplier and its supplier-product links?",
        danger: true,
      },
    }[type]

    if (!config) return
    setConfirmModal({
      open: true,
      type,
      supplier,
      ...config,
      loading: false,
      error: "",
    })
  }

  const closeConfirmModal = () => {
    if (confirmModal.loading) return
    setConfirmModal({
      open: false,
      type: "",
      supplier: null,
      title: "",
      message: "",
      danger: false,
      loading: false,
      error: "",
    })
  }

  const submitConfirmAction = async () => {
    const supplier = confirmModal.supplier
    if (!supplier?._id) return

    setConfirmModal((previous) => ({ ...previous, loading: true, error: "" }))
    setActionState({ id: supplier._id, type: confirmModal.type })

    try {
      let data
      if (confirmModal.type === "submit") {
        data = await api(`/suppliers/${supplier._id}/submit`, { method: "POST" })
      } else if (confirmModal.type === "approve") {
        data = await api(`/suppliers/${supplier._id}/approve`, { method: "POST" })
      } else if (confirmModal.type === "archive") {
        data = await api(`/suppliers/${supplier._id}`, { method: "DELETE" })
      }

      toast.success(data?.message || "Supplier updated")
      setConfirmModal((previous) => ({ ...previous, open: false, loading: false }))
      setSelectedIds((previous) =>
        previous.filter((id) => id !== String(supplier._id))
      )
      await loadSuppliers()
    } catch (error) {
      setConfirmModal((previous) => ({
        ...previous,
        loading: false,
        error: error.message || "Action failed.",
      }))
    } finally {
      setActionState({ id: "", type: "" })
    }
  }

  const submitSupplier = (supplier) => openConfirmModal("submit", supplier)
  const approveSupplier = (supplier) => openConfirmModal("approve", supplier)
  const archiveSupplier = (supplier) => openConfirmModal("archive", supplier)

  const restoreSupplier = (supplier) =>
    runAction(supplier, "restore", "restore", { method: "PATCH" })

  const openDeleteModal = (items) => {
    const list = (Array.isArray(items) ? items : [items]).filter(Boolean)
    if (!list.length) return
    setDeleteModal({
      open: true,
      suppliers: list,
      password: "",
      loading: false,
      error: "",
    })
  }

  const closeDeleteModal = () => {
    if (deleteModal.loading) return
    setDeleteModal({
      open: false,
      suppliers: [],
      password: "",
      loading: false,
      error: "",
    })
  }

  const submitDelete = async (event) => {
    event.preventDefault()
    const password = clean(deleteModal.password)
    if (!password) {
      return setDeleteModal((previous) => ({
        ...previous,
        error: "Password is required.",
      }))
    }

    setDeleteModal((previous) => ({ ...previous, loading: true, error: "" }))
    const deletedIds = []

    try {
      for (const supplier of deleteModal.suppliers) {
        // Backend contract for permanent deletion:
        // DELETE /api/suppliers/:id/permanent  body: { password }
        await api(`/suppliers/${supplier._id}/permanent`, {
          method: "DELETE",
          body: JSON.stringify({ password }),
        })
        deletedIds.push(String(supplier._id))
      }

      toast.success(
        deleteModal.suppliers.length > 1
          ? `${deleteModal.suppliers.length} suppliers deleted.`
          : "Supplier deleted."
      )
      setSelectedIds((previous) =>
        previous.filter((id) => !deletedIds.includes(id))
      )
      setDeleteModal({
        open: false,
        suppliers: [],
        password: "",
        loading: false,
        error: "",
      })
      await loadSuppliers()
    } catch (error) {
      setDeleteModal((previous) => ({
        ...previous,
        loading: false,
        error: error.message || "Failed to delete supplier.",
      }))
    }
  }

  const openBulkModal = (type) => {
    if (!selectedSuppliers.length) return
    setBulkModal({
      open: true,
      type,
      reason: "",
      loading: false,
      error: "",
    })
  }

  const closeBulkModal = () => {
    if (bulkModal.loading) return
    setBulkModal({
      open: false,
      type: "",
      reason: "",
      loading: false,
      error: "",
    })
  }

  const submitBulkAction = async (event) => {
    event.preventDefault()
    const reason = clean(bulkModal.reason)
    const items = [...selectedSuppliers]

    if (!items.length) return closeBulkModal()
    if (bulkModal.type === "on_hold" && !reason) {
      return setBulkModal((previous) => ({
        ...previous,
        error: "Hold reason is required.",
      }))
    }

    setBulkModal((previous) => ({ ...previous, loading: true, error: "" }))

    const results = await Promise.allSettled(
      items.map((supplier) => {
        if (bulkModal.type === "archive") {
          return api(`/suppliers/${supplier._id}`, { method: "DELETE" })
        }
        return api(`/suppliers/${supplier._id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: bulkModal.type, reason }),
        })
      })
    )

    const failed = results.filter((result) => result.status === "rejected")
    const succeeded = results.length - failed.length

    if (succeeded) {
      toast.success(`${succeeded} supplier${succeeded === 1 ? "" : "s"} updated.`)
    }

    await loadSuppliers()

    if (failed.length) {
      const firstError = failed[0]?.reason?.message
      return setBulkModal((previous) => ({
        ...previous,
        loading: false,
        error: `${failed.length} update${failed.length === 1 ? "" : "s"} failed${firstError ? `: ${firstError}` : "."}`,
      }))
    }

    clearSelection()
    closeBulkModal()
  }

  const openReasonModal = (type, supplier, targetStatus = "") => {
    setReasonModal({
      open: true,
      type,
      supplier,
      targetStatus,
      reason: "",
      error: "",
    })
  }

  const closeReasonModal = () => {
    if (saving) return
    setReasonModal({
      open: false,
      type: "",
      supplier: null,
      targetStatus: "",
      reason: "",
      error: "",
    })
  }

  const submitReasonAction = async (event) => {
    event.preventDefault()
    const reason = clean(reasonModal.reason)
    const supplier = reasonModal.supplier

    if (
      (reasonModal.type === "reject" ||
        reasonModal.targetStatus === "on_hold") &&
      !reason
    ) {
      return setReasonModal((previous) => ({
        ...previous,
        error:
          reasonModal.type === "reject"
            ? "Rejection reason is required."
            : "Hold reason is required.",
      }))
    }

    setSaving(true)
    try {
      const endpoint =
        reasonModal.type === "reject"
          ? `/suppliers/${supplier._id}/reject`
          : `/suppliers/${supplier._id}/status`
      const body =
        reasonModal.type === "reject"
          ? { reason }
          : { status: reasonModal.targetStatus, reason }

      const data = await api(endpoint, {
        method: reasonModal.type === "reject" ? "POST" : "PATCH",
        body: JSON.stringify(body),
      })
      toast.success(data.message || "Supplier workflow updated")
      closeReasonModal()
      await loadSuppliers()
    } catch (error) {
      setReasonModal((previous) => ({
        ...previous,
        error: error.message || "Failed to update supplier workflow.",
      }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`${shell} p-4 sm:p-6 lg:p-8`}>
      <Toaster position="top-right" />

      <section className={cn(card, "mb-6 p-4 sm:p-5")}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
              <Icon icon={FolderLibraryIcon} className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-extrabold tracking-tight text-gray-900">
                Suppliers
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className={cn(button, ghostButton)}
              onClick={refresh}
              disabled={loading}
              type="button"
            >
              <Icon
                icon={RefreshIcon}
                className={cn("h-4 w-4", loading ? "animate-spin" : "")}
              />
              Refresh
            </button>
            {canManage ? (
              <button
                className={cn(button, primaryButton)}
                onClick={openCreateModal}
                type="button"
              >
                <Icon icon={Add01Icon} className="h-4 w-4" />
                Add Supplier
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="w-full xl:max-w-[78%]">
            <div className="flex min-h-[44px] w-full flex-wrap items-center gap-1.5 rounded-2xl border border-gray-200 bg-[#f7f8fb] px-2.5 py-1 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.10)]">
              <Icon icon={Search01Icon} className="h-4 w-4 text-gray-400" />
              {activeTab !== "all" ? (
                <FilterChip
                  label="Status"
                  value={pretty(activeTab)}
                  onClear={() => setActiveTab("all")}
                />
              ) : null}
              {filters.supplierType !== "all" ? (
                <FilterChip
                  label="Type"
                  value={pretty(filters.supplierType)}
                  onClear={() => updateFilter("supplierType", "all")}
                />
              ) : null}
              {filters.supplierScope !== "all" ? (
                <FilterChip
                  label="Scope"
                  value={pretty(filters.supplierScope)}
                  onClear={() => updateFilter("supplierScope", "all")}
                />
              ) : null}
              <FocusPlaceholderInput
                className="min-w-[180px] flex-1 border-0 bg-transparent px-1 py-2 text-sm font-medium text-gray-900 outline-none placeholder:text-gray-400"
                value={filters.q}
                onChange={(event) => updateFilter("q", event.target.value)}
                placeholder="Search name, code, phone, email, TIN, BIN..."
              />
              <button
                type="button"
                onClick={() => setFilterOpen(true)}
                className={cn(
                  "inline-flex h-8 items-center gap-2 rounded-xl px-2.5 text-xs font-black transition",
                  activeFilterCount
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-gray-700 ring-1 ring-gray-200"
                )}
              >
                <Icon icon={FilterIcon} className="h-3.5 w-3.5" />
                Filters
                {activeFilterCount ? (
                  <span className="rounded-full bg-white/20 px-1.5 text-[10px]">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
              {activeFilterCount ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                >
                  <Icon icon={Cancel01Icon} className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>

          {loading ? (
            <SkeletonBlock className="h-4 w-28" />
          ) : (
            <p className="text-sm font-bold text-gray-500">
              Showing <span className="text-gray-900">{suppliers.length}</span>{" "}
              suppliers{hasMore ? "+" : ""}
            </p>
          )}
        </div>
      </section>

      <div className={`${card} mb-4 p-1.5`}>
        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
          {[
            ["all", "All"],
            ["draft", "Drafts"],
            ["pending_approval", "Pending"],
            ["active", "Active"],
            ["on_hold", "On Hold"],
            ["inactive", "Inactive"],
            ["archived", "Archived"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={cn(
                "rounded-xl px-3 py-2.5 text-xs font-extrabold transition sm:px-4 sm:text-sm",
                activeTab === key
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-700 hover:bg-gray-50"
              )}
              onClick={() => switchTab(key)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <BulkActionBar
        count={selectedSuppliers.length}
        canManage={canManage}
        canDelete={canDelete}
        onClear={clearSelection}
        onStatus={(type) => openBulkModal(type)}
        onDelete={() => openDeleteModal(selectedSuppliers)}
      />

      <SupplierList
        suppliers={suppliers}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        openingId={openingId}
        loadingDetailsId={loadingDetailsId}
        actionState={actionState}
        selectedIds={selectedIds}
        allSelected={allLoadedSelected}
        someSelected={someLoadedSelected}
        canManage={canManage}
        canApprove={canApprove}
        canDelete={canDelete}
        onView={openDetailsModal}
        onEdit={openEditModal}
        onSubmit={submitSupplier}
        onApprove={approveSupplier}
        onReject={(supplier) => openReasonModal("reject", supplier)}
        onStatus={(supplier, status) =>
          openReasonModal("status", supplier, status)
        }
        onArchive={archiveSupplier}
        onRestore={restoreSupplier}
        onDelete={(supplier) => openDeleteModal([supplier])}
        onToggleSelected={toggleSupplierSelection}
        onToggleAll={toggleAllLoadedSuppliers}
        onLoadMore={() => loadSuppliers({ append: true })}
      />

      <FilterModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        filters={filters}
        updateFilter={updateFilter}
        resetFilters={resetFilters}
        activeFilterCount={activeFilterCount}
        meta={meta}
      />

      <SupplierFormModal
        state={formModal}
        form={form}
        setForm={setForm}
        meta={meta}
        error={formError}
        fieldErrors={fieldErrors}
        setFieldErrors={setFieldErrors}
        saving={saving}
        onClose={closeFormModal}
        onSubmit={saveSupplier}
        onUpdateArray={updateArrayItem}
        onSetPrimary={setPrimaryItem}
        onAddArray={addArrayItem}
        onRemoveArray={removeArrayItem}
        onPaymentTermChange={changePaymentTerm}
      />

      <SupplierDetailsModal
        state={detailsModal}
        audits={audits}
        auditLoading={auditLoading}
        auditHasMore={auditHasMore}
        onClose={() =>
          setDetailsModal({
            open: false,
            supplier: null,
            stats: null,
            tab: "overview",
          })
        }
        onTabChange={changeDetailsTab}
        onLoadMoreAudits={() => loadAudits({ append: true })}
      />

      <ReasonModal
        state={reasonModal}
        setState={setReasonModal}
        saving={saving}
        onClose={closeReasonModal}
        onSubmit={submitReasonAction}
      />

      <ConfirmActionModal
        state={confirmModal}
        onClose={closeConfirmModal}
        onConfirm={submitConfirmAction}
      />

      <BulkActionModal
        state={bulkModal}
        count={selectedSuppliers.length}
        setState={setBulkModal}
        onClose={closeBulkModal}
        onSubmit={submitBulkAction}
      />

      <DeleteSupplierModal
        state={deleteModal}
        setState={setDeleteModal}
        onClose={closeDeleteModal}
        onSubmit={submitDelete}
      />
    </div>
  )
}

function FilterChip({ label, value, onClear }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700"
    >
      <span className="text-indigo-400">{label}:</span>
      <span className="max-w-[180px] truncate">{value}</span>
      <Icon icon={Cancel01Icon} className="h-3.5 w-3.5" />
    </button>
  )
}

function FilterModal({
  open,
  onClose,
  activeTab,
  setActiveTab,
  filters,
  updateFilter,
  resetFilters,
  activeFilterCount,
  meta,
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Supplier filters"
      subtitle="Filter supplier records by lifecycle, business type, scope, currency, and preference."
      icon={<Icon icon={FilterIcon} className="h-5 w-5" />}
      maxWidthClass="max-w-6xl"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span
            className={cn(
              chip,
              activeFilterCount
                ? "bg-indigo-50 text-indigo-700 ring-indigo-600/10"
                : "bg-gray-100 text-gray-600 ring-gray-600/10"
            )}
          >
            {activeFilterCount} active filter
            {activeFilterCount === 1 ? "" : "s"}
          </span>
          <div className="flex justify-end gap-2">
            <button
              className={cn(button, ghostButton)}
              onClick={resetFilters}
              type="button"
            >
              Reset
            </button>
            <button
              className={cn(button, primaryButton)}
              onClick={onClose}
              type="button"
            >
              <Icon icon={Tick02Icon} className="h-4 w-4" />
              Apply filters
            </button>
          </div>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Field label="Status">
          <select
            className={input}
            value={activeTab}
            onChange={(event) => setActiveTab(event.target.value)}
          >
            <option value="all">All current suppliers</option>
            {meta.supplierStatuses.map((status) => (
              <option key={status} value={status}>
                {pretty(status)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Supplier Type">
          <select
            className={input}
            value={filters.supplierType}
            onChange={(event) =>
              updateFilter("supplierType", event.target.value)
            }
          >
            <option value="all">All supplier types</option>
            {meta.supplierTypes.map((type) => (
              <option key={type} value={type}>
                {pretty(type)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Supplier Scope">
          <select
            className={input}
            value={filters.supplierScope}
            onChange={(event) =>
              updateFilter("supplierScope", event.target.value)
            }
          >
            <option value="all">Local + International</option>
            {meta.supplierScopes.map((scope) => (
              <option key={scope} value={scope}>
                {pretty(scope)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Currency">
          <FocusPlaceholderInput
            className={input}
            value={filters.currency === "all" ? "" : filters.currency}
            onChange={(event) =>
              updateFilter(
                "currency",
                event.target.value
                  ? event.target.value.toUpperCase()
                  : "all"
              )
            }
            placeholder="Example: BDT"
          />
        </Field>

        <Field label="Preferred Supplier">
          <select
            className={input}
            value={filters.isPreferred}
            onChange={(event) =>
              updateFilter("isPreferred", event.target.value)
            }
          >
            <option value="all">Preferred + Standard</option>
            <option value="true">Preferred only</option>
            <option value="false">Standard only</option>
          </select>
        </Field>

        <Field label="Tag">
          <FocusPlaceholderInput
            className={input}
            value={filters.tag}
            onChange={(event) => updateFilter("tag", event.target.value)}
            placeholder="Example: rice"
          />
        </Field>

        <Field label="Updated From">
          <input
            className={input}
            type="date"
            value={filters.updatedFrom}
            onChange={(event) =>
              updateFilter("updatedFrom", event.target.value)
            }
          />
        </Field>

        <Field label="Updated To">
          <input
            className={input}
            type="date"
            value={filters.updatedTo}
            onChange={(event) =>
              updateFilter("updatedTo", event.target.value)
            }
          />
        </Field>
      </div>
    </ModalShell>
  )
}

function BulkActionBar({ count, canManage, canDelete, onClear, onStatus, onDelete }) {
  if (!count) return null

  return (
    <div className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-3 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 min-w-9 items-center justify-center rounded-xl bg-indigo-600 px-2 text-sm font-black text-white">
            {count}
          </span>
          <p className="text-sm font-black text-gray-900">Selected</p>
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-bold text-gray-500 transition hover:text-gray-900"
          >
            Clear
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {canManage ? (
            <>
              <button className={cn(button, ghostButton, "px-3 py-2")} type="button" onClick={() => onStatus("active")}>Active</button>
              <button className={cn(button, ghostButton, "px-3 py-2")} type="button" onClick={() => onStatus("inactive")}>Inactive</button>
              <button className={cn(button, warningButton, "px-3 py-2")} type="button" onClick={() => onStatus("on_hold")}>On Hold</button>
            </>
          ) : null}
          {canDelete ? (
            <>
              <button className={cn(button, ghostButton, "px-3 py-2")} type="button" onClick={() => onStatus("archive")}>Archive</button>
              <button className={cn(button, dangerButton, "px-3 py-2")} type="button" onClick={onDelete}>Delete</button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function SupplierList({
  suppliers,
  loading,
  loadingMore,
  hasMore,
  openingId,
  loadingDetailsId,
  actionState,
  selectedIds,
  allSelected,
  someSelected,
  canManage,
  canApprove,
  canDelete,
  onView,
  onEdit,
  onSubmit,
  onApprove,
  onReject,
  onStatus,
  onArchive,
  onRestore,
  onDelete,
  onToggleSelected,
  onToggleAll,
  onLoadMore,
}) {
  return (
    <div className={cn(card, "overflow-hidden rounded-3xl border-gray-200")}>
      <div className="hidden h-[560px] overflow-auto [scrollbar-gutter:stable] xl:block 2xl:h-[650px]">
        <table className="w-full min-w-[1560px] border-separate border-spacing-0 text-left">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="w-14 border-b border-gray-200 bg-gray-50 px-5 py-4 text-center">
                <SelectionCheckbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={onToggleAll}
                  label="Select all loaded suppliers"
                />
              </th>
              <th className="border-b border-gray-200 bg-gray-50 px-5 py-4 text-xs font-black uppercase tracking-[0.06em] text-gray-600">Supplier</th>
              <th className="border-b border-gray-200 bg-gray-50 px-5 py-4 text-xs font-black uppercase tracking-[0.06em] text-gray-600">Type</th>
              <th className="border-b border-gray-200 bg-gray-50 px-5 py-4 text-xs font-black uppercase tracking-[0.06em] text-gray-600">Scope</th>
              <th className="border-b border-gray-200 bg-gray-50 px-5 py-4 text-xs font-black uppercase tracking-[0.06em] text-gray-600">Primary Contact</th>
              <th className="border-b border-gray-200 bg-gray-50 px-5 py-4 text-xs font-black uppercase tracking-[0.06em] text-gray-600">Location</th>
              <th className="border-b border-gray-200 bg-gray-50 px-5 py-4 text-xs font-black uppercase tracking-[0.06em] text-gray-600">Payment Terms</th>
              <th className="border-b border-gray-200 bg-gray-50 px-5 py-4 text-xs font-black uppercase tracking-[0.06em] text-gray-600">Credit Limit</th>
              <th className="border-b border-gray-200 bg-gray-50 px-5 py-4 text-xs font-black uppercase tracking-[0.06em] text-gray-600">Lead Time</th>
              <th className="border-b border-gray-200 bg-gray-50 px-5 py-4 text-xs font-black uppercase tracking-[0.06em] text-gray-600">Preference</th>
              <th className="border-b border-gray-200 bg-gray-50 px-5 py-4 text-xs font-black uppercase tracking-[0.06em] text-gray-600">Status</th>
              <th className="border-b border-gray-200 bg-gray-50 px-5 py-4 text-xs font-black uppercase tracking-[0.06em] text-gray-600">Updated</th>
              <th className="sticky right-0 z-30 border-b border-gray-200 bg-gray-50 px-5 py-4 text-right text-xs font-black uppercase tracking-[0.06em] text-gray-600 shadow-[-12px_0_20px_-20px_rgba(15,23,42,0.35)]">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {loading ? (
              <SupplierTableSkeleton rows={8} />
            ) : suppliers.length ? (
              suppliers.map((supplier) => {
                const address = supplier.addresses?.find((item) => item.isPrimary)
                const selected = selectedIds.includes(String(supplier._id))
                return (
                  <tr key={supplier._id} className="group">
                    <td className={cn("border-b border-gray-100 px-5 py-3 text-center transition", selected ? "bg-indigo-50/80" : "bg-white group-hover:bg-indigo-50/40")}>
                      <SelectionCheckbox
                        checked={selected}
                        onChange={(checked) => onToggleSelected(supplier._id, checked)}
                        label={`Select ${supplier.businessName}`}
                      />
                    </td>
                    <td className={cn("border-b border-gray-100 px-5 py-3 transition", selected ? "bg-indigo-50/80" : "bg-white group-hover:bg-indigo-50/40")}>
                      <div className="min-w-[230px]">
                        <p className="truncate text-sm font-black text-gray-950">{supplier.businessName}</p>
                        <p className="mt-0.5 text-xs font-black text-indigo-700">{supplier.code}</p>
                      </div>
                    </td>
                    <td className={cn("border-b border-gray-100 px-5 py-3 transition", selected ? "bg-indigo-50/80" : "bg-white group-hover:bg-indigo-50/40")}><TypeBadge value={supplier.supplierType} /></td>
                    <td className={cn("border-b border-gray-100 px-5 py-3 transition", selected ? "bg-indigo-50/80" : "bg-white group-hover:bg-indigo-50/40")}><ScopeBadge value={supplier.supplierScope} /></td>
                    <td className={cn("border-b border-gray-100 px-5 py-3 transition", selected ? "bg-indigo-50/80" : "bg-white group-hover:bg-indigo-50/40")}>
                      <p className="min-w-[180px] truncate text-sm font-semibold text-gray-800">{supplier.primaryEmail || "—"}</p>
                      <p className="mt-0.5 truncate text-xs font-medium text-gray-500">{supplier.primaryPhone || "—"}</p>
                    </td>
                    <td className={cn("border-b border-gray-100 px-5 py-3 text-sm font-medium text-gray-700 transition", selected ? "bg-indigo-50/80" : "bg-white group-hover:bg-indigo-50/40")}>{[address?.city, supplier.country || address?.country].filter(Boolean).join(", ") || "—"}</td>
                    <td className={cn("border-b border-gray-100 px-5 py-3 transition", selected ? "bg-indigo-50/80" : "bg-white group-hover:bg-indigo-50/40")}>
                      <p className="min-w-[140px] text-sm font-semibold text-gray-800">{pretty(supplier.procurement?.paymentTermType || "immediate")}</p>
                      <p className="mt-0.5 text-xs font-medium text-gray-500">{supplier.procurement?.paymentTermDays || 0} days</p>
                    </td>
                    <td className={cn("border-b border-gray-100 px-5 py-3 text-sm font-semibold text-gray-800 transition", selected ? "bg-indigo-50/80" : "bg-white group-hover:bg-indigo-50/40")}>{formatMoney(supplier.procurement?.creditLimit, supplier.procurement?.currency)}</td>
                    <td className={cn("border-b border-gray-100 px-5 py-3 text-sm font-semibold text-gray-700 transition", selected ? "bg-indigo-50/80" : "bg-white group-hover:bg-indigo-50/40")}>{supplier.procurement?.leadTimeDays || 0} days</td>
                    <td className={cn("border-b border-gray-100 px-5 py-3 transition", selected ? "bg-indigo-50/80" : "bg-white group-hover:bg-indigo-50/40")}><PreferredBadge value={supplier.isPreferred} /></td>
                    <td className={cn("border-b border-gray-100 px-5 py-3 transition", selected ? "bg-indigo-50/80" : "bg-white group-hover:bg-indigo-50/40")}><StatusBadge value={supplier.status} /></td>
                    <td className={cn("border-b border-gray-100 px-5 py-3 text-sm font-medium text-gray-600 transition", selected ? "bg-indigo-50/80" : "bg-white group-hover:bg-indigo-50/40")}>{formatDate(supplier.updatedAt, true)}</td>
                    <td className={cn("sticky right-0 z-10 border-b border-gray-100 px-5 py-2 text-right transition shadow-[-14px_0_24px_-22px_rgba(15,23,42,0.45)]", selected ? "bg-indigo-50" : "bg-white group-hover:bg-indigo-50/40")}>
                      <SupplierActions
                        supplier={supplier}
                        opening={String(openingId) === String(supplier._id)}
                        loadingDetails={String(loadingDetailsId) === String(supplier._id)}
                        actionState={actionState}
                        canManage={canManage}
                        canApprove={canApprove}
                        canDelete={canDelete}
                        onView={onView}
                        onEdit={onEdit}
                        onSubmit={onSubmit}
                        onApprove={onApprove}
                        onReject={onReject}
                        onStatus={onStatus}
                        onArchive={onArchive}
                        onRestore={onRestore}
                        onDelete={onDelete}
                      />
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={13} className="bg-white p-10 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 p-8">
                    <Icon icon={FolderLibraryIcon} className="h-6 w-6 text-gray-400" />
                    <p className="mt-3 text-sm font-black text-gray-900">No suppliers found</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-gray-100 xl:hidden">
        {loading ? (
          <SupplierMobileSkeleton rows={5} />
        ) : suppliers.length ? (
          suppliers.map((supplier) => (
            <SupplierMobileCard
              key={supplier._id}
              supplier={supplier}
              selected={selectedIds.includes(String(supplier._id))}
              onToggleSelected={onToggleSelected}
              opening={String(openingId) === String(supplier._id)}
              loadingDetails={String(loadingDetailsId) === String(supplier._id)}
              actionState={actionState}
              canManage={canManage}
              canApprove={canApprove}
              canDelete={canDelete}
              onView={onView}
              onEdit={onEdit}
              onSubmit={onSubmit}
              onApprove={onApprove}
              onReject={onReject}
              onStatus={onStatus}
              onArchive={onArchive}
              onRestore={onRestore}
              onDelete={onDelete}
            />
          ))
        ) : (
          <div className="p-8 text-center text-sm font-bold text-gray-500">No suppliers found</div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-gray-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {loading ? (
            <SkeletonBlock className="h-4 w-32" />
          ) : (
            <p className="text-sm font-bold text-gray-800">{suppliers.length} supplier{suppliers.length === 1 ? "" : "s"} loaded</p>
          )}
        </div>
        <button
          type="button"
          className={cn(
            button,
            hasMore ? primaryButton : "cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400",
            "min-w-[150px]"
          )}
          disabled={!hasMore || loadingMore || loading}
          onClick={() => hasMore && onLoadMore?.()}
        >
          {loadingMore ? <Spinner /> : null}
          {loadingMore ? "Loading..." : hasMore ? "Load more" : "All loaded"}
        </button>
      </div>
    </div>
  )
}

function SupplierMobileCard(props) {
  const { supplier, selected, onToggleSelected } = props
  const address = supplier.addresses?.find((item) => item.isPrimary)

  return (
    <article className={cn("p-4 transition", selected ? "bg-indigo-50/60" : "bg-white")}>
      <div className="flex items-start gap-3">
        <div className="pt-1">
          <SelectionCheckbox
            checked={selected}
            onChange={(checked) => onToggleSelected(supplier._id, checked)}
            label={`Select ${supplier.businessName}`}
          />
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-xs font-black text-indigo-700">
          {supplier.code?.slice(0, 3)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-black text-gray-950">{supplier.businessName}</h3>
              <p className="mt-0.5 text-xs font-black text-indigo-700">{supplier.code}</p>
            </div>
            <StatusBadge value={supplier.status} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-white/80 p-3 text-xs ring-1 ring-gray-100">
            <MiniValue label="Contact" value={supplier.primaryPhone || supplier.primaryEmail || "—"} />
            <MiniValue label="Location" value={[address?.city, supplier.country || address?.country].filter(Boolean).join(", ") || "—"} />
            <MiniValue label="Terms" value={`${pretty(supplier.procurement?.paymentTermType || "immediate")} · ${supplier.procurement?.paymentTermDays || 0}d`} />
            <MiniValue label="Credit" value={formatMoney(supplier.procurement?.creditLimit, supplier.procurement?.currency)} />
          </div>

          <div className="mt-3 border-t border-gray-100 pt-3">
            <SupplierActions {...props} mobile />
          </div>
        </div>
      </div>
    </article>
  )
}

function MiniValue({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="font-bold text-gray-400">{label}</p>
      <p className="mt-1 truncate font-black text-gray-700">{value}</p>
    </div>
  )
}

function SupplierActions({
  supplier,
  opening,
  loadingDetails,
  actionState,
  canManage,
  canApprove,
  canDelete,
  onView,
  onEdit,
  onSubmit,
  onApprove,
  onReject,
  onStatus,
  onArchive,
  onRestore,
  onDelete,
  mobile = false,
}) {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState({ top: 0, left: 0, transformOrigin: "top right" })
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const menuRef = useRef(null)
  const busy = String(actionState.id) === String(supplier._id)
  const canEdit = canManage && ["draft", "active", "on_hold", "inactive"].includes(supplier.status)

  const updateMenuPosition = useCallback(() => {
    if (typeof window === "undefined" || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const menuWidth = 250
    const gap = 8
    const estimatedHeight = 420
    const shouldOpenUp = window.innerHeight - rect.bottom < 300
    const top = shouldOpenUp
      ? Math.max(12, rect.top - Math.min(estimatedHeight, window.innerHeight - 24) - gap)
      : Math.min(rect.bottom + gap, window.innerHeight - 12)
    const left = Math.min(
      Math.max(12, rect.right - menuWidth),
      Math.max(12, window.innerWidth - menuWidth - 12)
    )
    setMenuStyle({ top, left, transformOrigin: shouldOpenUp ? "bottom right" : "top right" })
  }, [])

  useEffect(() => {
    if (!open) return undefined
    updateMenuPosition()
    const closeOutside = (event) => {
      if (rootRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return
      setOpen(false)
    }
    const reposition = () => updateMenuPosition()
    document.addEventListener("mousedown", closeOutside)
    window.addEventListener("resize", reposition)
    window.addEventListener("scroll", reposition, true)
    return () => {
      document.removeEventListener("mousedown", closeOutside)
      window.removeEventListener("resize", reposition)
      window.removeEventListener("scroll", reposition, true)
    }
  }, [open, updateMenuPosition])

  const items = []
  if (canEdit) items.push(["edit", "Edit supplier", Edit02Icon])
  if (canManage && supplier.status === "draft") items.push(["submit", "Submit for approval", Tick02Icon])
  if (canApprove && supplier.status === "pending_approval") {
    items.push(["approve", "Approve supplier", Tick02Icon])
    items.push(["reject", "Reject supplier", Cancel01Icon, "danger"])
  }
  if (canManage && supplier.approvedAt && supplier.status !== "archived") {
    if (supplier.status !== "active") items.push(["status-active", "Mark active", Tick02Icon])
    if (supplier.status !== "on_hold") items.push(["status-on_hold", "Put on hold", Alert02Icon, "warning"])
    if (supplier.status !== "inactive") items.push(["status-inactive", "Mark inactive", Archive02Icon])
  }
  if (supplier.status === "archived") {
    if (canDelete) items.push(["restore", "Restore supplier", RestoreBinIcon])
  } else if (canDelete) {
    items.push(["archive", "Archive supplier", Archive02Icon, "warning"])
  }
  if (canDelete) items.push(["delete", "Delete supplier", Cancel01Icon, "danger"])

  const handleItem = (key) => {
    setOpen(false)
    if (key === "edit") return onEdit(supplier)
    if (key === "submit") return onSubmit(supplier)
    if (key === "approve") return onApprove(supplier)
    if (key === "reject") return onReject(supplier)
    if (key === "status-active") return onStatus(supplier, "active")
    if (key === "status-on_hold") return onStatus(supplier, "on_hold")
    if (key === "status-inactive") return onStatus(supplier, "inactive")
    if (key === "archive") return onArchive(supplier)
    if (key === "restore") return onRestore(supplier)
    if (key === "delete") return onDelete(supplier)
  }

  const menu = open && typeof document !== "undefined"
    ? createPortal(
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.14 }}
          style={{ top: menuStyle.top, left: menuStyle.left, transformOrigin: menuStyle.transformOrigin }}
          className="fixed z-[9999] w-[250px] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_24px_60px_-20px_rgba(15,23,42,0.45)]"
        >
          <div className="max-h-[min(70vh,480px)] overflow-y-auto p-2">
            {items.map(([key, text, icon, tone]) => {
              const itemBusy = busy && actionState.type === key.replace("status-", "")
              return (
                <button
                  key={key}
                  type="button"
                  disabled={busy}
                  onClick={() => handleItem(key)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
                    tone === "danger"
                      ? "text-rose-700 hover:bg-rose-50"
                      : tone === "warning"
                        ? "text-amber-800 hover:bg-amber-50"
                        : "text-gray-800 hover:bg-gray-50"
                  )}
                >
                  {itemBusy ? <Spinner className="h-4 w-4" /> : <Icon icon={icon} className="h-4 w-4 shrink-0" />}
                  <span>{text}</span>
                </button>
              )
            })}
          </div>
        </motion.div>,
        document.body
      )
    : null

  return (
    <div ref={rootRef} className={cn("relative flex items-center gap-2", mobile ? "justify-end" : "justify-end")}>
      <button
        type="button"
        onClick={() => onView(supplier)}
        disabled={loadingDetails}
        className={cn(button, primaryButton, mobile ? "h-10 px-3" : "h-10 px-4")}
      >
        {loadingDetails ? <Spinner /> : <Icon icon={ViewIcon} className="h-4 w-4" />}
        View
      </button>
      <button
        ref={buttonRef}
        type="button"
        aria-label="More supplier actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          if (!open) updateMenuPosition()
          setOpen((previous) => !previous)
        }}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
      >
        <span className="-mt-1 text-xl font-black leading-none">⋮</span>
      </button>
      {menu}
    </div>
  )
}

function SupplierFormModal({
  state,
  form,
  setForm,
  meta,
  error,
  fieldErrors = {},
  setFieldErrors,
  saving,
  onClose,
  onSubmit,
  onUpdateArray,
  onSetPrimary,
  onAddArray,
  onRemoveArray,
  onPaymentTermChange,
}) {
  const clearFieldError = (key) => {
    if (!fieldErrors || !fieldErrors[key]) return
    setFieldErrors?.((previous) => {
      if (!previous?.[key]) return previous
      const next = { ...previous }
      delete next[key]
      return next
    })
  }

  return (
    <ModalShell
      open={state.open}
      onClose={onClose}
      title={state.item ? "Update supplier" : "Add supplier"}
      subtitle={
        state.item
          ? `${state.item.code} · ${state.item.businessName}`
          : ""
      }
      icon={
        <Icon
          icon={state.item ? Edit02Icon : Add01Icon}
          className="h-5 w-5"
        />
      }
      maxWidthClass="max-w-[1450px]"
      footer={
        <div className="flex flex-col justify-end gap-2 sm:flex-row">
          <button
            className={cn(button, ghostButton)}
            type="button"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className={cn(button, primaryButton)}
            type="submit"
            form="supplier-form"
            disabled={saving}
          >
            <Icon
              icon={saving ? RefreshIcon : FloppyDiskIcon}
              className={cn("h-4 w-4", saving ? "animate-spin" : "")}
            />
            {saving
              ? "Saving..."
              : state.item
                ? "Update Supplier"
                : "Save Supplier Draft"}
          </button>
        </div>
      }
    >
      {error && !Object.keys(fieldErrors).length ? (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          <Icon icon={Alert02Icon} className="mt-0.5 h-4 w-4" />
          <span>{error}</span>
        </div>
      ) : null}

      <form id="supplier-form" onSubmit={onSubmit} noValidate>
        <div className="space-y-4">
          <SectionCard
            title="Supplier identity"
          >
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Field
                id="field-code"
                label="Supplier Code"
                required
                error={fieldErrors.code}
              >
                <FocusPlaceholderInput
                  className={cn(input, fieldErrors.code && inputError)}
                  value={form.code}
                  onChange={(event) => {
                    setForm((previous) => ({
                      ...previous,
                      code: event.target.value.toUpperCase(),
                    }))
                    clearFieldError("code")
                  }}
                  placeholder="Example: SUP-0001"
                  maxLength={60}
                  required
                />
              </Field>
              <Field
                id="field-businessName"
                label="Business Name"
                required
                error={fieldErrors.businessName}
              >
                <FocusPlaceholderInput
                  className={cn(input, fieldErrors.businessName && inputError)}
                  value={form.businessName}
                  onChange={(event) => {
                    setForm((previous) => ({
                      ...previous,
                      businessName: event.target.value,
                    }))
                    clearFieldError("businessName")
                  }}
                  placeholder="Example: ABC Traders"
                  maxLength={180}
                  required
                />
              </Field>
              <Field label="Legal Name">
                <FocusPlaceholderInput
                  className={input}
                  value={form.legalName}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      legalName: event.target.value,
                    }))
                  }
                  placeholder="Registered legal name"
                  maxLength={220}
                />
              </Field>
              <Field label="Supplier Type">
                <select
                  className={input}
                  value={form.supplierType}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      supplierType: event.target.value,
                    }))
                  }
                >
                  {meta.supplierTypes.map((type) => (
                    <option key={type} value={type}>
                      {pretty(type)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Supplier Scope">
                <select
                  className={input}
                  value={form.supplierScope}
                  onChange={(event) => {
                    const newScope = event.target.value
                    setForm((previous) => ({
                      ...previous,
                      supplierScope: newScope,
                      country:
                        newScope === "local" && (!previous.country || previous.country === "")
                          ? "Bangladesh"
                          : previous.country,
                    }))
                    clearFieldError("country")
                  }}
                >
                  {meta.supplierScopes.map((scope) => (
                    <option key={scope} value={scope}>
                      {pretty(scope)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                id="field-country"
                label="Country"
                required={
                  form.supplierScope === "foreign" ||
                  form.supplierScope === "international"
                }
                error={fieldErrors.country}
              >
                <FocusPlaceholderInput
                  className={cn(input, fieldErrors.country && inputError)}
                  value={form.country}
                  onChange={(event) => {
                    setForm((previous) => ({
                      ...previous,
                      country: event.target.value,
                    }))
                    clearFieldError("country")
                  }}
                  placeholder="e.g. Bangladesh, China, Germany"
                  maxLength={120}
                />
              </Field>
              <Field
                id="field-primaryEmail"
                label="Primary Email"
                error={fieldErrors.primaryEmail}
              >
                <FocusPlaceholderInput
                  className={cn(input, fieldErrors.primaryEmail && inputError)}
                  type="email"
                  value={form.primaryEmail}
                  onChange={(event) => {
                    setForm((previous) => ({
                      ...previous,
                      primaryEmail: event.target.value,
                    }))
                    clearFieldError("primaryEmail")
                  }}
                  placeholder="supplier@example.com"
                  maxLength={180}
                />
              </Field>
              <Field label="Primary Phone">
                <FocusPlaceholderInput
                  className={input}
                  type="tel"
                  value={form.primaryPhone}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      primaryPhone: event.target.value,
                    }))
                  }
                  placeholder="+880 1XXXXXXXXX"
                  maxLength={60}
                />
              </Field>
              <Field
                id="field-website"
                label="Website"
                error={fieldErrors.website}
              >
                <FocusPlaceholderInput
                  className={cn(input, fieldErrors.website && inputError)}
                  type="url"
                  value={form.website}
                  onChange={(event) => {
                    setForm((previous) => ({
                      ...previous,
                      website: event.target.value,
                    }))
                    clearFieldError("website")
                  }}
                  placeholder="https://example.com"
                  maxLength={500}
                />
              </Field>

              <div className="rounded-2xl border border-gray-200 bg-white p-4 md:col-span-2 lg:col-span-1">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-gray-900">
                      Preferred Supplier
                    </p>
                    <p className="mt-1 text-xs font-semibold text-gray-500">
                      Mark this supplier as strategically preferred.
                    </p>
                  </div>
                  <Toggle
                    checked={form.isPreferred}
                    onChange={(value) =>
                      setForm((previous) => ({
                        ...previous,
                        isPreferred: value,
                      }))
                    }
                    label="Preferred supplier"
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Contact persons"
            action={
              <button
                type="button"
                className={cn(button, ghostButton, "px-3 py-2")}
                onClick={() =>
                  onAddArray("contactPersons", newContact(false), 10)
                }
              >
                <Icon icon={Add01Icon} className="h-4 w-4" />
                Add Contact
              </button>
            }
          >
            <div className="space-y-4">
              {form.contactPersons.map((contact, index) => (
                <ContactEditor
                  key={contact.clientId}
                  contact={contact}
                  index={index}
                  errors={fieldErrors}
                  onChange={(key, value) =>
                    onUpdateArray(
                      "contactPersons",
                      contact.clientId,
                      key,
                      value
                    )
                  }
                  onPrimary={() =>
                    onSetPrimary("contactPersons", contact.clientId)
                  }
                  onRemove={() =>
                    onRemoveArray(
                      "contactPersons",
                      contact.clientId,
                      1
                    )
                  }
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Addresses"
            action={
              <button
                type="button"
                className={cn(button, ghostButton, "px-3 py-2")}
                onClick={() =>
                  onAddArray("addresses", newAddress(false), 10)
                }
              >
                <Icon icon={Add01Icon} className="h-4 w-4" />
                Add Address
              </button>
            }
          >
            <div className="space-y-4">
              {form.addresses.map((address, index) => (
                <AddressEditor
                  key={address.clientId}
                  address={address}
                  index={index}
                  addressTypes={meta.addressTypes}
                  onChange={(key, value) =>
                    onUpdateArray(
                      "addresses",
                      address.clientId,
                      key,
                      value
                    )
                  }
                  onPrimary={() =>
                    onSetPrimary("addresses", address.clientId)
                  }
                  onRemove={() =>
                    onRemoveArray("addresses", address.clientId, 1)
                  }
                />
              ))}
            </div>
          </SectionCard>

          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard
              title="Procurement terms"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Currency">
                  <FocusPlaceholderInput
                    className={input}
                    value={form.procurement.currency}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        procurement: {
                          ...previous.procurement,
                          currency: event.target.value.toUpperCase(),
                        },
                      }))
                    }
                    placeholder="Example: BDT"
                    maxLength={12}
                  />
                </Field>
                <Field label="Payment Term">
                  <select
                    className={input}
                    value={form.procurement.paymentTermType}
                    onChange={(event) =>
                      onPaymentTermChange(event.target.value)
                    }
                  >
                    {meta.paymentTermTypes.map((term) => (
                      <option key={term} value={term}>
                        {pretty(term)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  id="field-paymentTermDays"
                  label="Payment Term Days"
                  error={fieldErrors.procurement_paymentTermDays}
                >
                  <FocusPlaceholderInput
                    className={cn(
                      input,
                      fieldErrors.procurement_paymentTermDays && inputError
                    )}
                    type="number"
                    min="0"
                    max="3650"
                    step="1"
                    value={form.procurement.paymentTermDays}
                    onChange={(event) => {
                      setForm((previous) => ({
                        ...previous,
                        procurement: {
                          ...previous.procurement,
                          paymentTermDays: event.target.value,
                        },
                      }))
                      clearFieldError("procurement_paymentTermDays")
                    }}
                    placeholder="Example: 30"
                    disabled={
                      form.procurement.paymentTermType !== "custom"
                    }
                  />
                </Field>
                <Field
                  id="field-creditLimit"
                  label="Credit Limit"
                  error={fieldErrors.procurement_creditLimit}
                >
                  <FocusPlaceholderInput
                    className={cn(
                      input,
                      fieldErrors.procurement_creditLimit && inputError
                    )}
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.procurement.creditLimit}
                    onChange={(event) => {
                      setForm((previous) => ({
                        ...previous,
                        procurement: {
                          ...previous.procurement,
                          creditLimit: event.target.value,
                        },
                      }))
                      clearFieldError("procurement_creditLimit")
                    }}
                    placeholder="Example: 100000"
                  />
                </Field>
                <Field
                  id="field-minimumOrderValue"
                  label="Minimum Order Value"
                  error={fieldErrors.procurement_minimumOrderValue}
                >
                  <FocusPlaceholderInput
                    className={cn(
                      input,
                      fieldErrors.procurement_minimumOrderValue && inputError
                    )}
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.procurement.minimumOrderValue}
                    onChange={(event) => {
                      setForm((previous) => ({
                        ...previous,
                        procurement: {
                          ...previous.procurement,
                          minimumOrderValue: event.target.value,
                        },
                      }))
                      clearFieldError("procurement_minimumOrderValue")
                    }}
                    placeholder="Example: 5000"
                  />
                </Field>
                <Field
                  id="field-leadTimeDays"
                  label="Lead Time Days"
                  error={fieldErrors.procurement_leadTimeDays}
                >
                  <FocusPlaceholderInput
                    className={cn(
                      input,
                      fieldErrors.procurement_leadTimeDays && inputError
                    )}
                    type="number"
                    min="0"
                    max="3650"
                    step="1"
                    value={form.procurement.leadTimeDays}
                    onChange={(event) => {
                      setForm((previous) => ({
                        ...previous,
                        procurement: {
                          ...previous.procurement,
                          leadTimeDays: event.target.value,
                        },
                      }))
                      clearFieldError("procurement_leadTimeDays")
                    }}
                    placeholder="Example: 7"
                  />
                </Field>
                <Field label="Incoterm">
                  <FocusPlaceholderInput
                    className={input}
                    value={form.procurement.incoterm}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        procurement: {
                          ...previous.procurement,
                          incoterm: event.target.value.toUpperCase(),
                        },
                      }))
                    }
                    placeholder="Example: FOB"
                    maxLength={30}
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Delivery Notes">
                    <FocusPlaceholderTextarea
                      className={cn(input, "min-h-[92px] resize-none")}
                      value={form.procurement.deliveryNotes}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          procurement: {
                            ...previous.procurement,
                            deliveryNotes: event.target.value,
                          },
                        }))
                      }
                      placeholder="Delivery schedule, packaging, or receiving instructions..."
                      maxLength={1000}
                    />
                  </Field>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Tax and registration"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Tax Treatment">
                  <select
                    className={input}
                    value={form.tax.taxTreatment}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        tax: {
                          ...previous.tax,
                          taxTreatment: event.target.value,
                        },
                      }))
                    }
                  >
                    {meta.taxTreatments.map((treatment) => (
                      <option key={treatment} value={treatment}>
                        {pretty(treatment)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Trade Licence No.">
                  <FocusPlaceholderInput
                    className={input}
                    value={form.tax.tradeLicenseNo}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        tax: {
                          ...previous.tax,
                          tradeLicenseNo: event.target.value.toUpperCase(),
                        },
                      }))
                    }
                    placeholder="Trade licence number"
                    maxLength={120}
                  />
                </Field>
                <Field label="TIN">
                  <FocusPlaceholderInput
                    className={input}
                    value={form.tax.tin}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        tax: {
                          ...previous.tax,
                          tin: event.target.value.toUpperCase(),
                        },
                      }))
                    }
                    placeholder="Tax identification number"
                    maxLength={120}
                  />
                </Field>
                <Field label="BIN / VAT">
                  <FocusPlaceholderInput
                    className={input}
                    value={form.tax.bin}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        tax: {
                          ...previous.tax,
                          bin: event.target.value.toUpperCase(),
                        },
                      }))
                    }
                    placeholder="BIN or VAT number"
                    maxLength={120}
                  />
                </Field>
                <Field label="Registration No.">
                  <FocusPlaceholderInput
                    className={input}
                    value={form.tax.registrationNo}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        tax: {
                          ...previous.tax,
                          registrationNo: event.target.value.toUpperCase(),
                        },
                      }))
                    }
                    placeholder="Company registration number"
                    maxLength={120}
                  />
                </Field>
              </div>
            </SectionCard>
          </div>

          <SectionCard
            title="Bank accounts"
            action={
              <button
                type="button"
                className={cn(button, ghostButton, "px-3 py-2")}
                onClick={() =>
                  onAddArray("bankAccounts", newBank(false), 10)
                }
              >
                <Icon icon={Add01Icon} className="h-4 w-4" />
                Add Bank Account
              </button>
            }
          >
            {form.bankAccounts.length ? (
              <div className="space-y-4">
                {form.bankAccounts.map((bank, index) => (
                  <BankEditor
                    key={bank.clientId}
                    bank={bank}
                    index={index}
                    errors={fieldErrors}
                    onChange={(key, value) =>
                      onUpdateArray(
                        "bankAccounts",
                        bank.clientId,
                        key,
                        value
                      )
                    }
                    onPrimary={() =>
                      onSetPrimary("bankAccounts", bank.clientId)
                    }
                    onRemove={() =>
                      onRemoveArray("bankAccounts", bank.clientId, 0)
                    }
                  />
                ))}
              </div>
            ) : (
              <EmptyInline text="No bank accounts added." />
            )}
          </SectionCard>

          <SectionCard
            title="Compliance documents"
            action={
              <button
                type="button"
                className={cn(button, ghostButton, "px-3 py-2")}
                onClick={() =>
                  onAddArray("documents", newDocument(), 30)
                }
              >
                <Icon icon={Add01Icon} className="h-4 w-4" />
                Add Document
              </button>
            }
          >
            {form.documents.length ? (
              <div className="space-y-4">
                {form.documents.map((document, index) => (
                  <DocumentEditor
                    key={document.clientId}
                    document={document}
                    index={index}
                    errors={fieldErrors}
                    documentTypes={meta.documentTypes}
                    onChange={(key, value) =>
                      onUpdateArray(
                        "documents",
                        document.clientId,
                        key,
                        value
                      )
                    }
                    onRemove={() =>
                      onRemoveArray("documents", document.clientId, 0)
                    }
                  />
                ))}
              </div>
            ) : (
              <EmptyInline text="No compliance documents added." />
            )}
          </SectionCard>

          <SectionCard title="Tags and notes">
            <div className="grid gap-4 lg:grid-cols-2">
              <Field
                label="Tags"
                hint="Comma-separated; maximum 20 unique tags."
              >
                <FocusPlaceholderInput
                  className={input}
                  value={form.tagsText}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      tagsText: event.target.value,
                    }))
                  }
                  placeholder="rice, local, high-priority"
                />
              </Field>
              <Field label="Internal Notes">
                <FocusPlaceholderTextarea
                  className={cn(input, "min-h-[100px] resize-none")}
                  value={form.notes}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Internal supplier notes..."
                  maxLength={3000}
                />
              </Field>
            </div>
          </SectionCard>
        </div>
      </form>
    </ModalShell>
  )
}

function ContactEditor({
  contact,
  index,
  errors = {},
  onChange,
  onPrimary,
  onRemove,
}) {
  const nameError = errors[`contact_${index}_name`] || ""
  const emailError = errors[`contact_${index}_email`] || ""
  const phoneError = errors[`contact_${index}_phone`] || ""
  const mobileError = errors[`contact_${index}_mobile`] || ""
  const groupError =
    errors[`contact_${index}_group`] ||
    errors[`contact_${index}`] ||
    ""

  return (
    <article
      id={`field-contact-${index}`}
      className={cn(
        "rounded-2xl border bg-white p-4 transition-all duration-200",
        groupError ? "border-rose-300 ring-2 ring-rose-200/50" : "border-gray-200"
      )}
    >
      <EditorHeader
        title={`Contact ${index + 1}`}
        primary={contact.isPrimary}
        onPrimary={onPrimary}
        onRemove={onRemove}
      />
      {groupError ? (
        <div
          id={`field-contact-${index}-group`}
          className="mb-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700"
        >
          <Icon icon={Alert02Icon} className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <span>{groupError}</span>
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Field
          id={`field-contact-${index}-name`}
          label="Name"
          required
          error={nameError}
        >
          <FocusPlaceholderInput
            className={cn(input, nameError && inputError)}
            value={contact.name}
            onChange={(event) => onChange("name", event.target.value)}
            placeholder="Contact person name"
            maxLength={140}
            required
          />
        </Field>
        <Field label="Designation">
          <FocusPlaceholderInput
            className={input}
            value={contact.designation}
            onChange={(event) =>
              onChange("designation", event.target.value)
            }
            placeholder="Example: Sales Manager"
            maxLength={120}
          />
        </Field>
        <Field label="Department">
          <FocusPlaceholderInput
            className={input}
            value={contact.department}
            onChange={(event) =>
              onChange("department", event.target.value)
            }
            placeholder="Example: Sales"
            maxLength={120}
          />
        </Field>
        <Field
          id={`field-contact-${index}-email`}
          label="Email"
          required
          error={emailError}
        >
          <FocusPlaceholderInput
            className={cn(input, (emailError || groupError) && inputError)}
            type="email"
            value={contact.email}
            onChange={(event) => onChange("email", event.target.value)}
            placeholder="contact@example.com"
            maxLength={180}
          />
        </Field>
        <Field
          id={`field-contact-${index}-phone`}
          label="Phone"
          required
          error={phoneError}
        >
          <FocusPlaceholderInput
            className={cn(input, (phoneError || groupError) && inputError)}
            value={contact.phone}
            onChange={(event) => onChange("phone", event.target.value)}
            placeholder="Office phone"
            maxLength={60}
          />
        </Field>
        <Field
          id={`field-contact-${index}-mobile`}
          label="Mobile"
          required
          error={mobileError}
        >
          <FocusPlaceholderInput
            className={cn(input, (mobileError || groupError) && inputError)}
            value={contact.mobile}
            onChange={(event) => onChange("mobile", event.target.value)}
            placeholder="Mobile number"
            maxLength={60}
          />
        </Field>
        <ToggleCard
          label="Receive Purchase Orders"
          checked={contact.canReceivePurchaseOrders}
          onChange={(value) =>
            onChange("canReceivePurchaseOrders", value)
          }
        />
        <ToggleCard
          label="Receive Payment Notices"
          checked={contact.canReceivePaymentNotices}
          onChange={(value) =>
            onChange("canReceivePaymentNotices", value)
          }
        />
      </div>
    </article>
  )
}

function AddressEditor({
  address,
  index,
  addressTypes,
  onChange,
  onPrimary,
  onRemove,
}) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4">
      <EditorHeader
        title={`Address ${index + 1}`}
        primary={address.isPrimary}
        onPrimary={onPrimary}
        onRemove={onRemove}
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Field label="Address Type">
          <select
            className={input}
            value={address.addressType}
            onChange={(event) =>
              onChange("addressType", event.target.value)
            }
          >
            {addressTypes.map((type) => (
              <option key={type} value={type}>
                {pretty(type)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Label">
          <FocusPlaceholderInput
            className={input}
            value={address.label}
            onChange={(event) => onChange("label", event.target.value)}
            placeholder="Example: Head Office"
            maxLength={100}
          />
        </Field>
        <Field label="Address Line 1">
          <FocusPlaceholderInput
            className={input}
            value={address.addressLine1}
            onChange={(event) =>
              onChange("addressLine1", event.target.value)
            }
            placeholder="Building, road, street"
            maxLength={250}
          />
        </Field>
        <Field label="Address Line 2">
          <FocusPlaceholderInput
            className={input}
            value={address.addressLine2}
            onChange={(event) =>
              onChange("addressLine2", event.target.value)
            }
            placeholder="Floor, block, landmark"
            maxLength={250}
          />
        </Field>
        <Field label="Area">
          <FocusPlaceholderInput
            className={input}
            value={address.area}
            onChange={(event) => onChange("area", event.target.value)}
            placeholder="Area"
            maxLength={120}
          />
        </Field>
        <Field label="City">
          <FocusPlaceholderInput
            className={input}
            value={address.city}
            onChange={(event) => onChange("city", event.target.value)}
            placeholder="City"
            maxLength={120}
          />
        </Field>
        <Field label="State / Division">
          <FocusPlaceholderInput
            className={input}
            value={address.state}
            onChange={(event) => onChange("state", event.target.value)}
            placeholder="State or division"
            maxLength={120}
          />
        </Field>
        <Field label="Postal Code">
          <FocusPlaceholderInput
            className={input}
            value={address.postalCode}
            onChange={(event) =>
              onChange("postalCode", event.target.value)
            }
            placeholder="Postal code"
            maxLength={40}
          />
        </Field>
        <Field label="Country">
          <FocusPlaceholderInput
            className={input}
            value={address.country}
            onChange={(event) => onChange("country", event.target.value)}
            placeholder="Country"
            maxLength={120}
          />
        </Field>
      </div>
    </article>
  )
}

function BankEditor({ bank, index, errors = {}, onChange, onPrimary, onRemove }) {
  const bankError = errors[`bank_${index}`] || ""
  return (
    <article
      id={`field-bank-${index}`}
      className={cn(
        "rounded-2xl border bg-white p-4 transition-all duration-200",
        bankError ? "border-rose-300 ring-2 ring-rose-200/50" : "border-gray-200"
      )}
    >
      <EditorHeader
        title={`Bank Account ${index + 1}`}
        primary={bank.isPrimary}
        onPrimary={onPrimary}
        onRemove={onRemove}
      />
      {bankError ? (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700">
          <Icon icon={Alert02Icon} className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <span>{bankError}</span>
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          ["Bank Name", "bankName", "Example: BRAC Bank"],
          ["Branch Name", "branchName", "Example: Gulshan"],
          ["Account Name", "accountName", "Account holder name"],
          ["Beneficiary Name", "beneficiaryName", "Beneficiary name if different"],
          ["Account Number", "accountNumber", "Account number"],
          ["Routing Number", "routingNumber", "Routing number"],
          ["SWIFT Code", "swiftCode", "SWIFT code"],
          ["BIC Code", "bicCode", "Bank Identifier Code (BIC)"],
          ["IBAN", "iban", "IBAN"],
          ["Currency", "currency", "Example: BDT, USD, EUR"],
          ["Bank Country", "bankCountry", "e.g. Bangladesh, China, Germany"],
          ["Bank Address", "bankAddress", "Bank address / city"],
        ].map(([label, key, placeholder]) => (
          <Field key={key} label={label}>
            <FocusPlaceholderInput
              className={input}
              value={bank[key] || ""}
              onChange={(event) =>
                onChange(
                  key,
                  ["swiftCode", "bicCode", "iban", "currency"].includes(key)
                    ? event.target.value.toUpperCase()
                    : event.target.value
                )
              }
              placeholder={placeholder}
            />
          </Field>
        ))}
        <ToggleCard
          label="Active Bank Account"
          checked={bank.isActive}
          onChange={(value) => onChange("isActive", value)}
        />
      </div>
    </article>
  )
}

function DocumentEditor({
  document,
  index,
  errors = {},
  documentTypes,
  onChange,
  onRemove,
}) {
  const docError = errors[`document_${index}`] || ""
  return (
    <article
      id={`field-document-${index}`}
      className={cn(
        "rounded-2xl border bg-white p-4 transition-all duration-200",
        docError ? "border-rose-300 ring-2 ring-rose-200/50" : "border-gray-200"
      )}
    >
      <EditorHeader
        title={`Document ${index + 1}`}
        primary={false}
        onRemove={onRemove}
      />
      {docError ? (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700">
          <Icon icon={Alert02Icon} className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <span>{docError}</span>
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Field label="Document Type">
          <select
            className={input}
            value={document.documentType}
            onChange={(event) =>
              onChange("documentType", event.target.value)
            }
          >
            {documentTypes.map((type) => (
              <option key={type} value={type}>
                {pretty(type)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Title">
          <FocusPlaceholderInput
            className={input}
            value={document.title}
            onChange={(event) => onChange("title", event.target.value)}
            placeholder="Document title"
            maxLength={180}
          />
        </Field>
        <Field label="Document No.">
          <FocusPlaceholderInput
            className={input}
            value={document.documentNo}
            onChange={(event) =>
              onChange("documentNo", event.target.value.toUpperCase())
            }
            placeholder="Document number"
            maxLength={120}
          />
        </Field>
        <Field label="Document URL">
          <FocusPlaceholderInput
            className={input}
            type="url"
            value={document.url}
            onChange={(event) => onChange("url", event.target.value)}
            placeholder="https://..."
            maxLength={1000}
          />
        </Field>
        <Field label="Issued At">
          <input
            className={input}
            type="date"
            value={document.issuedAt}
            onChange={(event) =>
              onChange("issuedAt", event.target.value)
            }
          />
        </Field>
        <Field label="Expires At">
          <input
            className={input}
            type="date"
            value={document.expiresAt}
            onChange={(event) =>
              onChange("expiresAt", event.target.value)
            }
          />
        </Field>
        <ToggleCard
          label="Active Document"
          checked={document.isActive}
          onChange={(value) => onChange("isActive", value)}
        />
      </div>
    </article>
  )
}

function EditorHeader({ title, primary, onPrimary, onRemove }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <p className="text-sm font-black text-gray-900">{title}</p>
        {primary ? (
          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-black text-indigo-700">
            Primary
          </span>
        ) : null}
      </div>
      <div className="flex gap-2">
        {onPrimary ? (
          <button
            type="button"
            className={cn(button, ghostButton, "px-3 py-2")}
            onClick={onPrimary}
            disabled={primary}
          >
            <Icon icon={Tick02Icon} className="h-4 w-4" />
            Set Primary
          </button>
        ) : null}
        <button
          type="button"
          className={cn(button, dangerButton, "px-3 py-2")}
          onClick={onRemove}
        >
          <Icon icon={Cancel01Icon} className="h-4 w-4" />
          Remove
        </button>
      </div>
    </div>
  )
}

function ToggleCard({ label, checked, onChange }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black text-gray-700">{label}</p>
        <Toggle checked={checked} onChange={onChange} label={label} />
      </div>
    </div>
  )
}

function EmptyInline({ text }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-8 text-center text-sm font-semibold text-gray-500">
      {text}
    </div>
  )
}

function SupplierDetailsModal({
  state,
  audits,
  auditLoading,
  auditHasMore,
  onClose,
  onTabChange,
  onLoadMoreAudits,
}) {
  const supplier = state.supplier
  const stats = state.stats || {}

  return (
    <ModalShell
      open={state.open}
      onClose={onClose}
      title={supplier?.businessName || "Supplier details"}
      subtitle={supplier ? `${supplier.code} · ${pretty(supplier.status)}` : ""}
      icon={<Icon icon={ViewIcon} className="h-5 w-5" />}
      maxWidthClass="max-w-[1350px]"
      footer={
        <div className="flex justify-end">
          <button
            className={cn(button, ghostButton)}
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
      }
    >
      {supplier ? (
        <div className="space-y-4">
          <div className="flex gap-2 rounded-2xl border border-gray-100 bg-gray-50 p-2">
            {[
              ["overview", "Overview"],
              ["contacts", "Contacts & Addresses"],
              ["financial", "Tax, Bank & Documents"],
              ["audit", "Audit History"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => onTabChange(key)}
                className={cn(
                  "rounded-xl px-4 py-2.5 text-sm font-black transition",
                  state.tab === key
                    ? "bg-indigo-600 text-white"
                    : "text-gray-600 hover:bg-white"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {state.tab === "overview" ? (
            <SupplierOverview supplier={supplier} stats={stats} />
          ) : null}
          {state.tab === "contacts" ? (
            <SupplierContacts supplier={supplier} />
          ) : null}
          {state.tab === "financial" ? (
            <SupplierFinancial supplier={supplier} />
          ) : null}
          {state.tab === "audit" ? (
            <SupplierAudit
              audits={audits}
              loading={auditLoading}
              hasMore={auditHasMore}
              onLoadMore={onLoadMoreAudits}
            />
          ) : null}
        </div>
      ) : null}
    </ModalShell>
  )
}

function SupplierOverview({ supplier, stats }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Product Links", stats.productLinkCount || 0],
          ["Active Links", stats.activeProductLinkCount || 0],
          ["Preferred Products", stats.preferredProductLinkCount || 0],
          ["Default Products", stats.defaultProductCount || 0],
          ["Credit Limit", formatMoney(supplier.procurement?.creditLimit, supplier.procurement?.currency)],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-gray-100 bg-gray-50 p-4"
          >
            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
              {label}
            </p>
            <p className="mt-2 text-lg font-black text-gray-900">
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Business information">
          <div className="space-y-3 text-sm">
            <DetailRow label="Status" value={<StatusBadge value={supplier.status} />} />
            <DetailRow label="Business name" value={supplier.businessName} />
            <DetailRow label="Legal name" value={supplier.legalName || "-"} />
            <DetailRow label="Type" value={<TypeBadge value={supplier.supplierType} />} />
            <DetailRow label="Scope" value={<ScopeBadge value={supplier.supplierScope} />} />
            <DetailRow label="Country" value={supplier.country || supplier.addresses?.find((a) => a.isPrimary)?.country || "Bangladesh"} />
            <DetailRow label="Preferred" value={supplier.isPreferred ? "Yes" : "No"} />
            <DetailRow label="Email" value={supplier.primaryEmail || "-"} />
            <DetailRow label="Phone" value={supplier.primaryPhone || "-"} />
            <DetailRow label="Website" value={supplier.website || "-"} />
          </div>
        </SectionCard>

        <SectionCard title="Procurement terms">
          <div className="space-y-3 text-sm">
            <DetailRow label="Currency" value={supplier.procurement?.currency || "BDT"} />
            <DetailRow label="Payment term" value={pretty(supplier.procurement?.paymentTermType || "immediate")} />
            <DetailRow label="Payment days" value={`${supplier.procurement?.paymentTermDays || 0} days`} />
            <DetailRow label="Credit limit" value={formatMoney(supplier.procurement?.creditLimit, supplier.procurement?.currency)} />
            <DetailRow label="Minimum order value" value={formatMoney(supplier.procurement?.minimumOrderValue, supplier.procurement?.currency)} />
            <DetailRow label="Lead time" value={`${supplier.procurement?.leadTimeDays || 0} days`} />
            <DetailRow label="Incoterm" value={supplier.procurement?.incoterm || "-"} />
          </div>
        </SectionCard>
      </div>

      {supplier.tags?.length ? (
        <SectionCard title="Tags">
          <div className="flex flex-wrap gap-2">
            {supplier.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700"
              >
                {tag}
              </span>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {supplier.notes ? (
        <SectionCard title="Notes">
          <p className="text-sm font-semibold leading-6 text-gray-600">
            {supplier.notes}
          </p>
        </SectionCard>
      ) : null}
    </div>
  )
}

function SupplierContacts({ supplier }) {
  return (
    <div className="space-y-4">
      <SectionCard title="Contact persons">
        <div className="grid gap-3 md:grid-cols-2">
          {(supplier.contactPersons || []).map((contact) => (
            <div
              key={contact._id || contact.name}
              className="rounded-2xl border border-gray-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-gray-900">{contact.name}</p>
                  <p className="mt-1 text-xs font-semibold text-gray-500">
                    {[contact.designation, contact.department]
                      .filter(Boolean)
                      .join(" · ") || "No designation"}
                  </p>
                </div>
                {contact.isPrimary ? (
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-black text-indigo-700">
                    Primary
                  </span>
                ) : null}
              </div>
              <div className="mt-3 space-y-1 text-sm font-semibold text-gray-600">
                <p>{contact.email || "No email"}</p>
                <p>{contact.mobile || contact.phone || "No phone"}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Addresses">
        <div className="grid gap-3 md:grid-cols-2">
          {(supplier.addresses || []).map((address) => (
            <div
              key={address._id || formatAddress(address)}
              className="rounded-2xl border border-gray-200 bg-white p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-black text-gray-900">
                  {address.label || pretty(address.addressType)}
                </p>
                {address.isPrimary ? (
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-black text-indigo-700">
                    Primary
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-gray-600">
                {formatAddress(address)}
              </p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}

function SupplierFinancial({ supplier }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Tax and registration">
          <div className="space-y-3 text-sm">
            <DetailRow label="Tax treatment" value={pretty(supplier.tax?.taxTreatment || "unregistered")} />
            <DetailRow label="Trade licence" value={supplier.tax?.tradeLicenseNo || "-"} />
            <DetailRow label="TIN" value={supplier.tax?.tin || "-"} />
            <DetailRow label="BIN / VAT" value={supplier.tax?.bin || "-"} />
            <DetailRow label="Registration" value={supplier.tax?.registrationNo || "-"} />
          </div>
        </SectionCard>

        <SectionCard title="Approval and lifecycle">
          <div className="space-y-3 text-sm">
            <DetailRow label="Approved by" value={relationLabel(supplier.approvedBy, "-")} />
            <DetailRow label="Approved at" value={formatDate(supplier.approvedAt, true)} />
            <DetailRow label="Rejected at" value={formatDate(supplier.rejectedAt, true)} />
            <DetailRow label="Rejection reason" value={supplier.rejectionReason || "-"} />
            <DetailRow label="Hold reason" value={supplier.onHoldReason || "-"} />
            <DetailRow label="Hold date" value={formatDate(supplier.onHoldAt, true)} />
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Bank accounts">
        {(supplier.bankAccounts || []).length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {supplier.bankAccounts.map((bank) => (
              <div
                key={bank._id || bank.accountNumber}
                className="rounded-2xl border border-gray-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-gray-900">
                      {bank.bankName || "Bank account"}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-gray-500">
                      {bank.branchName || "No branch"}
                    </p>
                  </div>
                  {bank.isPrimary ? (
                    <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-black text-indigo-700">
                      Primary
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-sm font-black text-gray-700">
                  {bank.accountName || "-"}
                  {bank.beneficiaryName && bank.beneficiaryName !== bank.accountName ? (
                    <span className="ml-1.5 text-xs font-normal text-gray-500">
                      (Beneficiary: {bank.beneficiaryName})
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-600">
                  {bank.accountNumber || "-"} · {bank.currency || "BDT"}
                </p>
                {(bank.swiftCode || bank.bicCode || bank.iban || bank.routingNumber) ? (
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                    {bank.swiftCode ? (
                      <span>
                        SWIFT: <strong className="font-semibold text-gray-700">{bank.swiftCode}</strong>
                      </span>
                    ) : null}
                    {bank.bicCode ? (
                      <span>
                        BIC: <strong className="font-semibold text-gray-700">{bank.bicCode}</strong>
                      </span>
                    ) : null}
                    {bank.iban ? (
                      <span>
                        IBAN: <strong className="font-semibold text-gray-700">{bank.iban}</strong>
                      </span>
                    ) : null}
                    {bank.routingNumber ? (
                      <span>
                        Routing: <strong className="font-semibold text-gray-700">{bank.routingNumber}</strong>
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {(bank.bankCountry || bank.bankAddress) ? (
                  <p className="mt-1.5 text-xs text-gray-500">
                    {[bank.bankAddress, bank.bankCountry].filter(Boolean).join(", ")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyInline text="No bank accounts stored." />
        )}
      </SectionCard>

      <SectionCard title="Compliance documents">
        {(supplier.documents || []).length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {supplier.documents.map((document) => (
              <div
                key={document._id || document.documentNo}
                className="rounded-2xl border border-gray-200 bg-white p-4"
              >
                <p className="font-black text-gray-900">
                  {document.title || pretty(document.documentType)}
                </p>
                <p className="mt-1 text-xs font-semibold text-gray-500">
                  {document.documentNo || "No document number"}
                </p>
                <p className="mt-3 text-sm font-semibold text-gray-600">
                  Expires: {formatDate(document.expiresAt)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyInline text="No compliance documents stored." />
        )}
      </SectionCard>
    </div>
  )
}

function SupplierAudit({ audits, loading, hasMore, onLoadMore }) {
  return (
    <SectionCard title="Audit history" description="Immutable supplier and supplier-product activity records.">
      <div className="space-y-3">
        {audits.map((audit) => (
          <div
            key={audit._id}
            className="rounded-2xl border border-gray-200 bg-white p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-black text-gray-900">
                  {pretty(audit.action)}
                </p>
                <p className="mt-1 text-xs font-semibold text-gray-500">
                  {relationLabel(audit.actor)}
                </p>
              </div>
              <p className="text-xs font-semibold text-gray-500">
                {formatDate(audit.createdAt, true)}
              </p>
            </div>
            {audit.note ? (
              <p className="mt-3 text-sm font-semibold text-gray-600">
                {audit.note}
              </p>
            ) : null}
          </div>
        ))}

        {!audits.length ? (
          <EmptyInline
            text={loading ? "Loading audit history..." : "No audit records found."}
          />
        ) : null}

        {hasMore ? (
          <div className="flex justify-center">
            <button
              className={cn(button, ghostButton)}
              onClick={onLoadMore}
              disabled={loading}
              type="button"
            >
              <Icon
                icon={RefreshIcon}
                className={cn("h-4 w-4", loading ? "animate-spin" : "")}
              />
              Load more
            </button>
          </div>
        ) : null}
      </div>
    </SectionCard>
  )
}

function ConfirmActionModal({ state, onClose, onConfirm }) {
  return (
    <ModalShell
      open={state.open}
      onClose={onClose}
      title={state.title}
      subtitle={state.supplier?.businessName || ""}
      icon={<Icon icon={state.danger ? Archive02Icon : Tick02Icon} className="h-5 w-5" />}
      maxWidthClass="max-w-lg"
      footer={
        <div className="flex justify-end gap-2">
          <button className={cn(button, ghostButton)} type="button" onClick={onClose} disabled={state.loading}>Cancel</button>
          <button
            className={cn(button, state.danger ? dangerButton : primaryButton)}
            type="button"
            onClick={onConfirm}
            disabled={state.loading}
          >
            {state.loading ? <Spinner /> : <Icon icon={Tick02Icon} className="h-4 w-4" />}
            {state.loading ? "Processing..." : "Confirm"}
          </button>
        </div>
      }
    >
      {state.error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{state.error}</div>
      ) : null}
      <p className="text-sm font-semibold leading-6 text-gray-700">{state.message}</p>
    </ModalShell>
  )
}

function BulkActionModal({ state, count, setState, onClose, onSubmit }) {
  const labels = {
    active: "Activate suppliers",
    inactive: "Deactivate suppliers",
    on_hold: "Put suppliers on hold",
    archive: "Archive suppliers",
  }
  const needsReason = state.type === "on_hold"

  return (
    <ModalShell
      open={state.open}
      onClose={onClose}
      title={labels[state.type] || "Bulk update"}
      subtitle={`${count} selected`}
      icon={<Icon icon={Edit02Icon} className="h-5 w-5" />}
      maxWidthClass="max-w-lg"
      footer={
        <div className="flex justify-end gap-2">
          <button className={cn(button, ghostButton)} type="button" onClick={onClose} disabled={state.loading}>Cancel</button>
          <button
            className={cn(button, state.type === "archive" ? dangerButton : primaryButton)}
            type="submit"
            form="supplier-bulk-action-form"
            disabled={state.loading}
          >
            {state.loading ? <Spinner /> : <Icon icon={Tick02Icon} className="h-4 w-4" />}
            {state.loading ? "Updating..." : "Apply"}
          </button>
        </div>
      }
    >
      {state.error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{state.error}</div>
      ) : null}
      <form id="supplier-bulk-action-form" onSubmit={onSubmit} className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
          This action will update {count} selected supplier{count === 1 ? "" : "s"}.
        </div>
        {state.type !== "archive" ? (
          <Field label="Reason" required={needsReason}>
            <textarea
              className={cn(input, "min-h-[110px] resize-none")}
              value={state.reason}
              onChange={(event) => setState((previous) => ({ ...previous, reason: event.target.value, error: "" }))}
              placeholder={needsReason ? "Enter hold reason" : "Optional note"}
              required={needsReason}
            />
          </Field>
        ) : null}
      </form>
    </ModalShell>
  )
}

function DeleteSupplierModal({ state, setState, onClose, onSubmit }) {
  const count = state.suppliers?.length || 0
  const name = count === 1 ? state.suppliers?.[0]?.businessName : ""

  return (
    <ModalShell
      open={state.open}
      onClose={onClose}
      title={count > 1 ? `Delete ${count} suppliers` : "Delete supplier"}
      subtitle={name}
      icon={<Icon icon={Cancel01Icon} className="h-5 w-5" />}
      maxWidthClass="max-w-lg"
      footer={
        <div className="flex justify-end gap-2">
          <button className={cn(button, ghostButton)} type="button" onClick={onClose} disabled={state.loading}>Cancel</button>
          <button
            className={cn(button, dangerButton)}
            type="submit"
            form="supplier-delete-form"
            disabled={state.loading}
          >
            {state.loading ? <Spinner /> : <Icon icon={Cancel01Icon} className="h-4 w-4" />}
            {state.loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      }
    >
      {state.error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{state.error}</div>
      ) : null}
      <form id="supplier-delete-form" onSubmit={onSubmit} className="space-y-4">
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          Permanent delete cannot be undone.
        </div>
        <Field label="Your Password" required>
          <input
            className={input}
            type="password"
            autoComplete="current-password"
            value={state.password}
            onChange={(event) => setState((previous) => ({ ...previous, password: event.target.value, error: "" }))}
            placeholder="Enter password"
            required
            autoFocus
          />
        </Field>
      </form>
    </ModalShell>
  )
}

function ReasonModal({ state, setState, saving, onClose, onSubmit }) {
  const isReject = state.type === "reject"
  const target = state.targetStatus
  const title = isReject
    ? "Reject supplier"
    : `Mark supplier as ${pretty(target)}`
  const reasonRequired = isReject || target === "on_hold"

  return (
    <ModalShell
      open={state.open}
      onClose={onClose}
      title={title}
      subtitle={state.supplier?.businessName || ""}
      icon={<Icon icon={isReject ? Cancel01Icon : Edit02Icon} className="h-5 w-5" />}
      maxWidthClass="max-w-xl"
      footer={
        <div className="flex justify-end gap-2">
          <button
            className={cn(button, ghostButton)}
            onClick={onClose}
            disabled={saving}
            type="button"
          >
            Close
          </button>
          <button
            className={cn(
              button,
              isReject || target === "on_hold"
                ? warningButton
                : primaryButton
            )}
            type="submit"
            form="supplier-reason-form"
            disabled={saving}
          >
            <Icon
              icon={saving ? RefreshIcon : Tick02Icon}
              className={cn("h-4 w-4", saving ? "animate-spin" : "")}
            />
            {saving ? "Processing..." : "Confirm"}
          </button>
        </div>
      }
    >
      {state.error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {state.error}
        </div>
      ) : null}
      <form id="supplier-reason-form" onSubmit={onSubmit}>
        <Field
          label={isReject ? "Rejection Reason" : "Status Reason"}
          required={reasonRequired}
        >
          <FocusPlaceholderTextarea
            className={cn(input, "min-h-[130px] resize-none")}
            value={state.reason}
            onChange={(event) =>
              setState((previous) => ({
                ...previous,
                reason: event.target.value,
                error: "",
              }))
            }
            placeholder="Explain why this action is required..."
            maxLength={1000}
            required={reasonRequired}
          />
        </Field>
      </form>
    </ModalShell>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
      <span className="shrink-0 font-semibold text-gray-500">{label}</span>
      <span className="min-w-0 text-right font-black text-gray-800">
        {value}
      </span>
    </div>
  )
}
