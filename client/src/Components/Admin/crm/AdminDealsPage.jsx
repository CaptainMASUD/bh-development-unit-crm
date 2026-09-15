"use client"
/* eslint-disable react/prop-types */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { createPortal } from "react-dom"
import toast, { Toaster } from "react-hot-toast"
import { getModuleBasePath } from "../../Navigation/moduleConfig"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  ArrowDown01Icon,
  Briefcase01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  CreditCardIcon,
  DeliveryTruck01Icon,
  DollarCircleIcon,
  File02Icon,
  PrinterIcon,
  InsertColumnIcon,
  Loading03Icon,
  MoreVerticalIcon,
  RefreshIcon,
  Search01Icon,
  ShoppingCart01Icon,
  Tick02Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons"

function createHugeIcon(icon) {
  return function HugeIconAdapter({ className, ...props }) {
    return <HugeiconsIcon icon={icon} className={className} strokeWidth={1.8} {...props} />
  }
}

const HAlertCircleIcon = createHugeIcon(AlertCircleIcon)
const HBriefcaseIcon = createHugeIcon(Briefcase01Icon)
const HCheckCircleIcon = createHugeIcon(CheckmarkCircle02Icon)
const HCheckIcon = createHugeIcon(Tick02Icon)
const HChevronDownIcon = createHugeIcon(ArrowDown01Icon)
const HColumnsIcon = createHugeIcon(InsertColumnIcon)
const HCreditCardIcon = createHugeIcon(CreditCardIcon)
const HMoneyIcon = createHugeIcon(DollarCircleIcon)
const HEyeIcon = createHugeIcon(ViewIcon)
const HFileTextIcon = createHugeIcon(File02Icon)
const HLoaderIcon = createHugeIcon(Loading03Icon)
const HMoreVerticalIcon = createHugeIcon(MoreVerticalIcon)
const HPrinterIcon = createHugeIcon(PrinterIcon)
const HRefreshIcon = createHugeIcon(RefreshIcon)
const HSearchIcon = createHugeIcon(Search01Icon)
const HShoppingCartIcon = createHugeIcon(ShoppingCart01Icon)
const HTruckIcon = createHugeIcon(DeliveryTruck01Icon)
const HCloseIcon = createHugeIcon(Cancel01Icon)

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const PAGE_SIZE = 25
const VIEW_KEY = "deals.accounting"
const COLUMN_LABELS = {
  title: "Deal",
  customer: "Client",
  leadNumber: "Lead No",
  stage: "Stage",
  budgetMin: "Budget Min",
  budgetMax: "Budget Max",
  expectedValue: "Expected Value",
  dealValue: "Deal Value",
  invoiceTotal: "Invoice Total",
  paidAmount: "Paid Amount",
  dueAmount: "Due Amount",
  invoiceStatus: "Invoice Status",
  invoiceNo: "Invoice No",
  closeDate: "Close Date",
}
const ALLOWED_COLUMNS = Object.keys(COLUMN_LABELS)
const DEFAULT_COLUMNS = ["title", "customer", "stage", "dealValue", "invoiceTotal", "paidAmount", "dueAmount"]

function normalizeColumns(columns) {
  const source = Array.isArray(columns) ? columns : []
  const safe = [...new Set(source)]
    .filter((column) => column !== "dealNo")
    .filter((column) => ALLOWED_COLUMNS.includes(column))
  return safe.length ? safe : DEFAULT_COLUMNS
}
const STAGE_COLORS = {
  negotiation: "bg-amber-50 text-amber-800 ring-amber-600/10",
  won: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
  lost: "bg-rose-50 text-rose-700 ring-rose-600/10",
  draft: "bg-gray-100 text-gray-700 ring-gray-600/10",
  sent: "bg-sky-50 text-sky-700 ring-sky-600/10",
  partially_paid: "bg-violet-50 text-violet-700 ring-violet-600/10",
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
  overdue: "bg-rose-50 text-rose-700 ring-rose-600/10",
}

const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_30px_-20px_rgba(15,23,42,0.25)]"
const button = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50"
const primaryButton = `${button} bg-indigo-600 text-white shadow-sm hover:bg-indigo-700`
const ghostButton = `${button} border border-gray-200 bg-white text-gray-800 hover:bg-gray-50`
const input = "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"

function cn(...classes) {
  return classes.filter(Boolean).join(" ")
}

function getAuthHeaders() {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function apiJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: { ...getAuthHeaders(), ...(options.headers || {}) },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data?.message || data?.error || "Request failed")
    error.status = response.status
    error.data = data
    throw error
  }
  return data
}

function formatMoney(value, currency = "BDT") {
  const amount = Number(value || 0)
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "BDT",
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency || "BDT"} ${amount.toLocaleString()}`
  }
}

function formatAmount(value) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function formatDate(value, withTime = false) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat(undefined, withTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" }).format(date)
}

function toDateInput(value = new Date()) {
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function addDays(value, days) {
  const date = new Date(value)
  date.setDate(date.getDate() + days)
  return date
}

function Badge({ value }) {
  const key = String(value || "").toLowerCase()
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ${STAGE_COLORS[key] || "bg-gray-100 text-gray-700 ring-gray-600/10"}`}>
      {String(value || "—").replaceAll("_", " ")}
    </span>
  )
}

function Modal({ open, onClose, title, subtitle, children, footer, maxWidth = "max-w-4xl" }) {
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => event.key === "Escape" && onClose?.()
    document.addEventListener("keydown", onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (typeof document === "undefined") return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-5"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <motion.button
            type="button"
            aria-label="Close modal"
            className="fixed inset-0 bg-gray-950/45 backdrop-blur-sm"
            onClick={onClose}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.16 }}
          />
          <motion.div
            className={cn("relative my-auto flex max-h-[94vh] w-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_30px_80px_-30px_rgba(15,23,42,0.60)]", maxWidth)}
            initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.992 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 8, scale: 0.995 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-gray-100 bg-white px-4 py-3.5 sm:px-5">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-black text-gray-950">{title}</h2>
                {subtitle ? <p className="mt-0.5 truncate text-xs font-medium text-gray-500">{subtitle}</p> : null}
              </div>
              <motion.button
                type="button"
                aria-label="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
                onClick={onClose}
                whileTap={reduceMotion ? undefined : { scale: 0.96 }}
              >
                <HCloseIcon className="h-[18px] w-[18px]" />
              </motion.button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
            {footer ? <div className="sticky bottom-0 z-20 border-t border-gray-100 bg-white px-4 py-3 sm:px-5">{footer}</div> : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  )
}

function ColumnPickerModal({ open, onClose, selected, onSave }) {
  const reduceMotion = useReducedMotion()
  const [local, setLocal] = useState([])
  const [search, setSearch] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setLocal(selected?.length ? selected : DEFAULT_COLUMNS)
    setSearch("")
    setError("")
  }, [open, selected])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return query
      ? ALLOWED_COLUMNS.filter((column) => COLUMN_LABELS[column].toLowerCase().includes(query))
      : ALLOWED_COLUMNS
  }, [search])

  const toggle = (column) => {
    setLocal((previous) => previous.includes(column)
      ? previous.filter((item) => item !== column)
      : [...previous, column])
  }

  const move = (column, direction) => {
    setLocal((previous) => {
      const index = previous.indexOf(column)
      const nextIndex = direction === "up" ? index - 1 : index + 1
      if (index < 0 || nextIndex < 0 || nextIndex >= previous.length) return previous
      const next = [...previous]
      ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    setError("")
    try {
      await onSave(local)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const tap = reduceMotion ? undefined : { scale: 0.98 }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Choose columns"
      subtitle={`${local.length} selected`}
      maxWidth="max-w-5xl"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <motion.button whileTap={tap} className={cn(ghostButton, "h-10 px-3.5")} onClick={() => setLocal(ALLOWED_COLUMNS)}>Show all</motion.button>
            <motion.button whileTap={tap} className={cn(ghostButton, "h-10 px-3.5")} onClick={() => setLocal(DEFAULT_COLUMNS)}>Default</motion.button>
          </div>
          <div className="flex justify-end gap-2">
            <motion.button whileTap={tap} className={cn(ghostButton, "h-10 px-3.5")} onClick={onClose}>Cancel</motion.button>
            <motion.button whileTap={tap} className={cn(primaryButton, "h-10 px-4")} disabled={saving || !local.length} onClick={save}>{saving ? "Saving..." : "Apply"}</motion.button>
          </div>
        </div>
      }
    >
      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</div> : null}

      <div className="mb-4 flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/70 px-3 focus-within:border-indigo-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10">
        <HSearchIcon className="h-4 w-4 shrink-0 text-gray-400" />
        <input className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search columns..." />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <section className="overflow-hidden rounded-2xl border border-gray-100 lg:col-span-7">
          <div className="border-b border-gray-100 bg-gray-50/70 px-4 py-3">
            <p className="text-sm font-bold text-gray-900">Available columns</p>
          </div>
          <div className="grid gap-2 p-3 sm:grid-cols-2">
            {filtered.map((column) => {
              const checked = local.includes(column)
              return (
                <motion.button
                  key={column}
                  type="button"
                  whileTap={tap}
                  onClick={() => toggle(column)}
                  className={cn(
                    "flex min-h-[52px] items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors duration-150",
                    checked
                      ? "border-indigo-200 bg-indigo-50/70"
                      : "border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50/70"
                  )}
                >
                  <span className="truncate text-sm font-bold text-gray-900">{COLUMN_LABELS[column]}</span>
                  <span
                    className={cn(
                      "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] border transition-colors duration-150",
                      checked ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-200 bg-white text-transparent"
                    )}
                    aria-hidden="true"
                  >
                    <AnimatePresence initial={false}>
                      {checked ? (
                        <motion.span
                          key="checked"
                          initial={reduceMotion ? false : { opacity: 0, scale: 0.75 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={reduceMotion ? undefined : { opacity: 0, scale: 0.75 }}
                          transition={{ duration: 0.14 }}
                          className="flex items-center justify-center"
                        >
                          <HCheckIcon className="h-3.5 w-3.5" />
                        </motion.span>
                      ) : null}
                    </AnimatePresence>
                  </span>
                </motion.button>
              )
            })}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-100 lg:col-span-5">
          <div className="border-b border-gray-100 bg-gray-50/70 px-4 py-3">
            <p className="text-sm font-bold text-gray-900">Selected order</p>
          </div>
          <div className="max-h-[430px] space-y-2 overflow-y-auto p-3">
            {local.map((column, index) => (
              <motion.div layout={!reduceMotion} key={column} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-200 text-[11px] font-bold text-gray-600">{index + 1}</span>
                  <p className="truncate text-sm font-semibold text-gray-900">{COLUMN_LABELS[column]}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <motion.button whileTap={tap} type="button" aria-label={`Move ${COLUMN_LABELS[column]} up`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 disabled:opacity-30" disabled={index === 0} onClick={() => move(column, "up")}><HChevronDownIcon className="h-3.5 w-3.5 rotate-180" /></motion.button>
                  <motion.button whileTap={tap} type="button" aria-label={`Move ${COLUMN_LABELS[column]} down`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 disabled:opacity-30" disabled={index === local.length - 1} onClick={() => move(column, "down")}><HChevronDownIcon className="h-3.5 w-3.5" /></motion.button>
                  <motion.button whileTap={tap} type="button" aria-label={`Remove ${COLUMN_LABELS[column]}`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600" onClick={() => toggle(column)}><HCloseIcon className="h-3.5 w-3.5" /></motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </div>
    </Modal>
  )
}

function getClientName(deal) {
  return deal?.customerId?.companyName
    || deal?.customerId?.name
    || deal?.leadId?.contact?.companyName
    || deal?.leadId?.contact?.name
    || "—"
}

function SummaryMetric({ label, value, hint, icon, tone }) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.div
      className="rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_12px_32px_-24px_rgba(15,23,42,0.30)]"
      whileHover={reduceMotion ? undefined : { y: -2 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-1 truncate text-2xl font-black tracking-tight text-gray-950">{value}</p>
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-black/5", tone)}>{icon}</div>
      </div>
      <p className="mt-2 truncate text-xs font-medium text-gray-500">{hint}</p>
    </motion.div>
  )
}

function DealDetailsModal({ dealId, onClose, onCreateSalesOrder, onViewInvoice, creatingOrderId = "", canManage = true }) {
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const tap = reduceMotion ? undefined : { scale: 0.98 }
  const [deal, setDeal] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!dealId) return
    const controller = new AbortController()
    setLoading(true)
    setError("")
    apiJson(`/deals/${dealId}`, { signal: controller.signal })
      .then((data) => setDeal(data?.deal || null))
      .catch((err) => {
        if (err?.name !== "AbortError") setError(err.message)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [dealId])

  const directRole = typeof window !== "undefined" ? localStorage.getItem("role") : null
  const role = directRole ? String(directRole).toLowerCase() : "admin"

  return (
    <Modal
      open={Boolean(dealId)}
      onClose={onClose}
      title="Deal details"
      subtitle={deal?.dealNo || deal?.title || ""}
      footer={deal ? (
        <div className="flex flex-wrap justify-end gap-2">
          <motion.button whileTap={tap} className={ghostButton} onClick={onClose}>Close</motion.button>
          {deal.salesOrderId ? (
            <motion.button whileTap={tap} className={primaryButton} onClick={() => { navigate(`${getModuleBasePath(role, "sales")}/sales-orders?search=${encodeURIComponent(deal.dealNo || "")}`) }}>
              <HShoppingCartIcon className="h-4 w-4" />View Sales Order
            </motion.button>
          ) : canManage && deal.stage === "won" ? (
            <motion.button whileTap={tap} className={primaryButton} disabled={creatingOrderId === deal._id || !deal.customerId} onClick={() => onCreateSalesOrder?.(deal)}>
              {creatingOrderId === deal._id ? <HLoaderIcon className="h-4 w-4 animate-spin" /> : <HShoppingCartIcon className="h-4 w-4" />}
              Create Sales Order
            </motion.button>
          ) : null}
          {deal.salesOrderId ? (
            <motion.button whileTap={tap} className={ghostButton} onClick={() => { navigate(`${getModuleBasePath(role, "sales")}/deliveries?search=${encodeURIComponent(deal.dealNo || "")}`) }}>
              <HTruckIcon className="h-4 w-4" />Deliveries
            </motion.button>
          ) : null}
          {deal.invoice ? (
            <motion.button whileTap={tap} className={ghostButton} onClick={() => { navigate(`${getModuleBasePath(role, "sales")}/invoices?search=${encodeURIComponent(deal.invoice?.invoiceNo || deal.invoice?.invoiceNumber || "")}`) }}>
              <HFileTextIcon className="h-4 w-4" />View invoice
            </motion.button>
          ) : null}
          {deal.salesOrderId ? (
            <motion.button whileTap={tap} className={ghostButton} onClick={() => { navigate(`${getModuleBasePath(role, "sales")}/payments?search=${encodeURIComponent(deal.dealNo || "")}`) }}>
              <HCreditCardIcon className="h-4 w-4" />Payments
            </motion.button>
          ) : null}
        </div>
      ) : null}
    >
      {loading ? <div className="flex justify-center p-10"><HLoaderIcon className="h-6 w-6 animate-spin text-indigo-600" /></div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div> : null}
      {deal ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Stage", <Badge key="stage" value={deal.stage} />],
              ["Deal value", formatMoney(deal.grandTotal, deal.currency)],
              ["Expected revenue", formatMoney(deal.expectedRevenue, deal.currency)],
              ["Probability", `${deal.probability || 0}%`],
              ["Customer", getClientName(deal)],
              ["Owner", deal.ownerId?.name || "—"],
              ["Expected close", formatDate(deal.expectedCloseDate)],
              ["Health", <Badge key="health" value={deal.dealHealth} />],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
                <div className="mt-1.5 text-sm font-bold text-gray-900">{value}</div>
              </div>
            ))}
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Deal items</h3>
            <div className="overflow-hidden rounded-2xl border border-gray-200">
              <table className="w-full min-w-[650px] text-left">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-xs font-black text-gray-500">Item</th>
                    <th className="px-4 py-3 text-right text-xs font-black text-gray-500">Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-black text-gray-500">Unit price</th>
                    <th className="px-4 py-3 text-right text-xs font-black text-gray-500">Discount</th>
                    <th className="px-4 py-3 text-right text-xs font-black text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(deal.items || []).map((item) => (
                    <tr key={item._id || item.nameSnapshot}>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900">{item.nameSnapshot || "Item"}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{item.qty}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{formatMoney(item.unitPrice, deal.currency)}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{formatMoney(item.discount, deal.currency)}</td>
                      <td className="px-4 py-3 text-right text-sm font-black text-gray-950">{formatMoney(item.lineTotal, deal.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function printInvoice(invoice) {
  const popup = window.open("", "_blank", "width=900,height=760")
  if (!popup) {
    toast.error("Allow pop-ups to print the invoice.")
    return
  }
  const customer = invoice?.customerId || {}
  const rows = (invoice?.items || []).map((item) => `
    <tr>
      <td>${escapeHtml(item.nameSnapshot || "Item")}</td>
      <td class="right">${Number(item.qty || 0)}</td>
      <td class="right">${escapeHtml(formatMoney(item.unitPrice, invoice.currency))}</td>
      <td class="right">${escapeHtml(formatMoney(item.discount, invoice.currency))}</td>
      <td class="right strong">${escapeHtml(formatMoney(item.lineTotal, invoice.currency))}</td>
    </tr>
  `).join("")
  popup.document.write(`<!doctype html><html><head><title>${escapeHtml(invoice.invoiceNo)}</title><style>
    body{font-family:Arial,sans-serif;color:#111827;margin:40px}h1{margin:0;font-size:30px}.muted{color:#6b7280}.top{display:flex;justify-content:space-between;gap:30px}.right{text-align:right}.strong{font-weight:700}table{width:100%;border-collapse:collapse;margin-top:30px}th,td{padding:12px;border-bottom:1px solid #e5e7eb;text-align:left}th{background:#f9fafb;font-size:12px;text-transform:uppercase;color:#4b5563}.totals{margin-left:auto;margin-top:24px;width:320px}.line{display:flex;justify-content:space-between;padding:7px 0}.grand{font-size:20px;font-weight:800;border-top:2px solid #111827;margin-top:6px;padding-top:12px}@media print{body{margin:18px}}
  </style></head><body>
    <div class="top"><div><h1>INVOICE</h1><p class="muted">${escapeHtml(invoice.invoiceNo)}</p></div><div class="right"><p><b>Status:</b> ${escapeHtml(invoice.status)}</p><p><b>Issued:</b> ${escapeHtml(formatDate(invoice.issuedAt))}</p><p><b>Due:</b> ${escapeHtml(formatDate(invoice.dueAt))}</p></div></div>
    <div style="margin-top:34px"><p class="muted">Bill to</p><h2>${escapeHtml(customer.companyName || customer.name || "Customer")}</h2><p>${escapeHtml(customer.email || customer.contactPerson?.email || "")}<br>${escapeHtml(customer.phone || customer.contactPerson?.phone || "")}</p></div>
    <table><thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Price</th><th class="right">Discount</th><th class="right">Total</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="totals"><div class="line"><span>Subtotal</span><b>${escapeHtml(formatMoney(invoice.subtotal, invoice.currency))}</b></div><div class="line"><span>Discount</span><b>${escapeHtml(formatMoney(invoice.discountTotal, invoice.currency))}</b></div><div class="line grand"><span>Total</span><span>${escapeHtml(formatMoney(invoice.total, invoice.currency))}</span></div></div>
    ${invoice.notes ? `<div style="margin-top:36px"><p class="muted">Notes</p><p>${escapeHtml(invoice.notes)}</p></div>` : ""}
    <script>window.onload=()=>window.print()</script>
  </body></html>`)
  popup.document.close()
}

function PaymentModal({ invoice, onClose, onSaved }) {
  const [amount, setAmount] = useState("")
  const [treasuryAccounts, setTreasuryAccounts] = useState([])
  const [treasuryAccount, setTreasuryAccount] = useState("")
  const [transactionId, setTransactionId] = useState("")
  const [paidAt, setPaidAt] = useState(toDateInput())
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingTreasury, setLoadingTreasury] = useState(false)
  const [invoicePosted, setInvoicePosted] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!invoice) return
    let active = true
    setAmount(String(invoice.dueTotal || ""))
    setTreasuryAccount("")
    setTreasuryAccounts([])
    setTransactionId("")
    setPaidAt(toDateInput())
    setNote("")
    setError("")
    setInvoicePosted(Boolean(invoice.journalEntry && invoice.status !== "draft"))
    setLoadingTreasury(true)
    const loadTreasury = async () => {
      let data = await apiJson("/banking/treasury-accounts")
      if (data.requiresSynchronization) {
        await apiJson("/banking/treasury-accounts/synchronize", { method: "POST", body: "{}" })
        data = await apiJson("/banking/treasury-accounts")
      }
      return data
    }
    loadTreasury()
      .then((data) => {
        if (!active) return
        const currency = String(invoice.currency || "BDT").toUpperCase()
        setTreasuryAccounts((data.accounts || []).filter((account) => String(account.currency || "BDT").toUpperCase() === currency))
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
      .finally(() => {
        if (active) setLoadingTreasury(false)
      })
    return () => {
      active = false
    }
  }, [invoice])

  const submit = async () => {
    const [treasuryType, treasuryId] = treasuryAccount.split(":")
    if (!treasuryType || !treasuryId) {
      setError("Select the cash or bank account that received this money.")
      return
    }
    setLoading(true)
    setError("")
    try {
      if (!invoicePosted) {
        await apiJson(`/accounting/invoices/${invoice._id}/post`, {
          method: "PATCH",
          body: "{}",
        })
        setInvoicePosted(true)
      }
      const data = await apiJson(`/invoices/${invoice._id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(amount),
          treasuryType,
          treasuryAccount: treasuryId,
          reference: transactionId,
          paidAt,
          note,
        }),
      })
      toast.success("Receipt posted and connected to the deal invoice.")
      onSaved(data?.invoice)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={Boolean(invoice)}
      onClose={onClose}
      title="Record payment"
      subtitle={invoice?.invoiceNo || ""}
      maxWidth="max-w-2xl"
      footer={<div className="flex justify-end gap-2"><button className={ghostButton} onClick={onClose}>Cancel</button><button className={primaryButton} disabled={loading || loadingTreasury || !Number(amount) || !treasuryAccount} onClick={submit}>{loading ? <HLoaderIcon className="animate-spin" /> : <HCreditCardIcon />}{loading ? "Posting..." : !invoicePosted ? "Post invoice & receive" : "Post receipt"}</button></div>}
    >
      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</div> : null}
      {!invoicePosted ? <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">This invoice is still a draft. The system will first post Accounts Receivable and Sales Revenue, then post the cash/bank receipt.</div> : null}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-gray-50 p-3"><p className="text-xs font-black text-gray-500">Invoice</p><p className="mt-1 font-black">{formatMoney(invoice?.total, invoice?.currency)}</p></div>
        <div className="rounded-2xl bg-emerald-50 p-3"><p className="text-xs font-black text-emerald-600">Paid</p><p className="mt-1 font-black text-emerald-800">{formatMoney(invoice?.paidTotal, invoice?.currency)}</p></div>
        <div className="rounded-2xl bg-rose-50 p-3"><p className="text-xs font-black text-rose-600">Due</p><p className="mt-1 font-black text-rose-800">{formatMoney(invoice?.dueTotal, invoice?.currency)}</p></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold">Amount *<input type="number" min="0.01" max={invoice?.dueTotal} step="0.01" className={`${input} mt-1.5`} value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        <label className="text-sm font-bold">Received in *<select className={`${input} mt-1.5`} value={treasuryAccount} onChange={(event) => setTreasuryAccount(event.target.value)} disabled={loadingTreasury}><option value="">{loadingTreasury ? "Loading cash and bank accounts..." : "Select cash or bank account"}</option>{treasuryAccounts.map((account) => <option key={`${account.treasuryType}-${account._id}`} value={`${account.treasuryType}:${account._id}`}>{account.name} · {account.detail} · {formatMoney(account.currentBalance, account.currency)}</option>)}</select></label>
        <label className="text-sm font-bold">Payment date<input type="date" className={`${input} mt-1.5`} value={paidAt} onChange={(event) => setPaidAt(event.target.value)} /></label>
        <label className="text-sm font-bold">Receipt reference <span className="font-medium text-gray-400">(optional)</span><input className={`${input} mt-1.5`} value={transactionId} onChange={(event) => setTransactionId(event.target.value)} /></label>
        <label className="text-sm font-bold sm:col-span-2">Note <span className="font-medium text-gray-400">(optional)</span><textarea className={`${input} mt-1.5 min-h-[90px]`} value={note} onChange={(event) => setNote(event.target.value)} /></label>
      </div>
    </Modal>
  )
}

function InvoiceDetailsModal({ invoice, onClose, onPayment }) {
  return (
    <Modal
      open={Boolean(invoice)}
      onClose={onClose}
      title="Invoice"
      subtitle={invoice?.invoiceNo || ""}
      footer={
        <div className="flex justify-end gap-2">
          <button className={ghostButton} onClick={onClose}>Close</button>
          {Number(invoice?.dueTotal || 0) > 0 ? <button className={ghostButton} onClick={() => onPayment(invoice)}><HCreditCardIcon />Add payment</button> : null}
          <button className={primaryButton} onClick={() => printInvoice(invoice)}><HPrinterIcon />Print invoice</button>
        </div>
      }
    >
      {invoice ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Status", <Badge key="status" value={invoice.status} />],
              ["Total", formatMoney(invoice.total, invoice.currency)],
              ["Paid", formatMoney(invoice.paidTotal, invoice.currency)],
              ["Due", formatMoney(invoice.dueTotal, invoice.currency)],
              ["Issued", formatDate(invoice.issuedAt)],
              ["Due date", formatDate(invoice.dueAt)],
              ["Customer", invoice.customerId?.companyName || invoice.customerId?.name || "—"],
              ["Deal", invoice.dealId?.dealNo || invoice.dealId?.title || "—"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-gray-500">{label}</p>
                <div className="mt-1.5 text-sm font-bold text-gray-900">{value}</div>
              </div>
            ))}
          </div>
          <div className="overflow-hidden rounded-2xl border border-gray-200">
            <table className="w-full min-w-[600px] text-left">
              <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-xs font-black text-gray-500">Item</th><th className="px-4 py-3 text-right text-xs font-black text-gray-500">Qty</th><th className="px-4 py-3 text-right text-xs font-black text-gray-500">Price</th><th className="px-4 py-3 text-right text-xs font-black text-gray-500">Total</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {(invoice.items || []).map((item) => <tr key={item._id || item.nameSnapshot}><td className="px-4 py-3 text-sm font-bold text-gray-900">{item.nameSnapshot || "Item"}</td><td className="px-4 py-3 text-right text-sm text-gray-700">{item.qty}</td><td className="px-4 py-3 text-right text-sm text-gray-700">{formatMoney(item.unitPrice, invoice.currency)}</td><td className="px-4 py-3 text-right text-sm font-black text-gray-950">{formatMoney(item.lineTotal, invoice.currency)}</td></tr>)}
              </tbody>
            </table>
          </div>
          {invoice.payments?.length ? <div><h3 className="mb-3 text-sm font-black uppercase tracking-wide text-gray-600">Payments</h3><div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200">{invoice.payments.map((payment) => <div key={payment._id} className="grid grid-cols-2 gap-3 px-4 py-3 sm:grid-cols-4"><span className="text-sm font-black text-emerald-700">{formatMoney(payment.amount, invoice.currency)}</span><span className="text-sm font-bold capitalize text-gray-700">{payment.method}</span><span className="text-sm text-gray-600">{formatDate(payment.paidAt)}</span><span className="truncate text-sm text-gray-500">{payment.transactionId || "—"}</span></div>)}</div></div> : null}
        </div>
      ) : null}
    </Modal>
  )
}


function DealRowActions({ deal, onView, onCreateSalesOrder, creatingOrderId = "", employeeMode = false, role = "admin" }) {
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState({ top: 0, left: 0 })
  const wrapperRef = useRef(null)
  const buttonRef = useRef(null)
  const menuRef = useRef(null)

  const updatePosition = useCallback(() => {
    if (typeof window === "undefined" || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const width = 230
    const gap = 8
    const estimatedHeight = 230
    const openUp = window.innerHeight - rect.bottom < estimatedHeight
    setMenuStyle({
      top: openUp ? Math.max(12, rect.top - estimatedHeight - gap) : rect.bottom + gap,
      left: Math.min(Math.max(12, rect.right - width), window.innerWidth - width - 12),
    })
  }, [])

  useEffect(() => {
    if (!open) return undefined
    updatePosition()
    const closeOutside = (event) => {
      if (wrapperRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return
      setOpen(false)
    }
    const closeOnEscape = (event) => event.key === "Escape" && setOpen(false)
    const reposition = () => updatePosition()
    document.addEventListener("mousedown", closeOutside)
    document.addEventListener("keydown", closeOnEscape)
    window.addEventListener("resize", reposition)
    window.addEventListener("scroll", reposition, true)
    return () => {
      document.removeEventListener("mousedown", closeOutside)
      document.removeEventListener("keydown", closeOnEscape)
      window.removeEventListener("resize", reposition)
      window.removeEventListener("scroll", reposition, true)
    }
  }, [open, updatePosition])

  const closeAndRun = (fn) => {
    setOpen(false)
    fn?.()
  }

  const tap = reduceMotion ? undefined : { scale: 0.97 }
  const menuItemClass = "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-gray-800 transition hover:bg-gray-50"

  const menu = !employeeMode && typeof document !== "undefined"
    ? createPortal(
        <AnimatePresence>
          {open ? (
            <motion.div
              ref={menuRef}
              role="menu"
              style={{ top: menuStyle.top, left: menuStyle.left }}
              className="fixed z-[9999] w-[230px] rounded-2xl border border-gray-100 bg-white p-2 shadow-[0_24px_60px_-22px_rgba(15,23,42,0.50)]"
              initial={reduceMotion ? false : { opacity: 0, y: -4, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -3, scale: 0.99 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              {deal.salesOrderId ? (
                <motion.button whileTap={tap} type="button" role="menuitem" className={menuItemClass} onClick={() => closeAndRun(() => navigate(`${getModuleBasePath(role, "sales")}/sales-orders?search=${encodeURIComponent(deal.dealNo || "")}`))}>
                  <HShoppingCartIcon className="h-4 w-4 text-gray-500" />View Sales Order
                </motion.button>
              ) : deal.stage === "won" ? (
                <motion.button whileTap={tap} type="button" role="menuitem" disabled={creatingOrderId === deal._id || !deal.customerId} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => closeAndRun(() => onCreateSalesOrder?.(deal))}>
                  {creatingOrderId === deal._id ? <HLoaderIcon className="h-4 w-4 animate-spin" /> : <HShoppingCartIcon className="h-4 w-4" />}
                  {creatingOrderId === deal._id ? "Creating order..." : "Create Sales Order"}
                </motion.button>
              ) : null}
              {deal.invoice ? (
                <motion.button whileTap={tap} type="button" role="menuitem" className={menuItemClass} onClick={() => closeAndRun(() => navigate(`${getModuleBasePath(role, "sales")}/invoices?search=${encodeURIComponent(deal.invoice?.invoiceNo || deal.invoice?.invoiceNumber || "")}`))}>
                  <HFileTextIcon className="h-4 w-4 text-gray-500" />View Invoice
                </motion.button>
              ) : null}
              {deal.salesOrderId ? (
                <>
                  <motion.button whileTap={tap} type="button" role="menuitem" className={menuItemClass} onClick={() => closeAndRun(() => navigate(`${getModuleBasePath(role, "sales")}/deliveries?search=${encodeURIComponent(deal.dealNo || "")}`))}>
                    <HTruckIcon className="h-4 w-4 text-gray-500" />Deliveries
                  </motion.button>
                  <motion.button whileTap={tap} type="button" role="menuitem" className={menuItemClass} onClick={() => closeAndRun(() => navigate(`${getModuleBasePath(role, "sales")}/payments?search=${encodeURIComponent(deal.dealNo || "")}`))}>
                    <HCreditCardIcon className="h-4 w-4 text-gray-500" />Payments
                  </motion.button>
                </>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body
      )
    : null

  return (
    <div ref={wrapperRef} className="flex items-center justify-end gap-2">
      <motion.button
        type="button"
        whileTap={tap}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
        onClick={onView}
      >
        <HEyeIcon className="h-4 w-4" />View
      </motion.button>
      {!employeeMode ? (
        <motion.button
          ref={buttonRef}
          type="button"
          whileTap={tap}
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-xl border bg-white text-gray-700 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30",
            open ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-gray-200 hover:bg-gray-50"
          )}
          onClick={() => { if (!open) updatePosition(); setOpen((value) => !value) }}
          aria-label="More deal actions"
          title="More actions"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <HMoreVerticalIcon className="h-4 w-4" />
        </motion.button>
      ) : null}
      {menu}
    </div>
  )
}

export default function AdminDealsPage({ employeeMode = false }) {
  const reduceMotion = useReducedMotion()
  const directRole = typeof window !== "undefined" ? localStorage.getItem("role") : null
  const role = directRole ? String(directRole).toLowerCase() : (employeeMode ? "employee" : "admin")
  const [deals, setDeals] = useState([])
  const [accounting, setAccounting] = useState({ wonDeals: 0, wonValue: 0, invoicedAmount: 0, paidAmount: 0, invoiceDueAmount: 0, uninvoicedAmount: 0, outstandingAmount: 0, paidDeals: 0, dueDeals: 0 })
  const [pageInfo, setPageInfo] = useState({ page: 1, total: 0, hasNextPage: false })
  const [invoiceState, setInvoiceState] = useState("")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState("")
  const [viewDealId, setViewDealId] = useState("")
  const [creatingOrderId, setCreatingOrderId] = useState("")
  const [invoiceView, setInvoiceView] = useState(null)
  const [paymentInvoice, setPaymentInvoice] = useState(null)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [selectedColumns, setSelectedColumns] = useState(DEFAULT_COLUMNS)
  const abortRef = useRef(null)

  const handleCreateSalesOrder = async (deal) => {
    if (!deal?._id) return
    setCreatingOrderId(deal._id)
    try {
      const data = await apiJson(`/sales/orders/from-deal/${deal._id}`, {
        method: "POST",
        body: JSON.stringify({}),
      })
      toast.success(`Sales Order ${data?.data?.orderNumber || ""} created! Manage fulfillment in Sales Operations.`)
      loadDeals()
    } catch (err) {
      toast.error(err.message || "Failed to create sales order.")
    } finally {
      setCreatingOrderId("")
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    apiJson(`/view-preferences/${encodeURIComponent(VIEW_KEY)}`)
      .then((data) => setSelectedColumns(normalizeColumns(data?.columns)))
      .catch(() => setSelectedColumns(DEFAULT_COLUMNS))
  }, [])

  const loadDeals = useCallback(async ({ nextPage = 1, append = false } = {}) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    append ? setLoadingMore(true) : setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        page: String(nextPage),
        stage: "won",
      })
      if (debouncedSearch) params.set("q", debouncedSearch)
      if (invoiceState) params.set("invoiceState", invoiceState)
      const data = await apiJson(`/deals?${params.toString()}`, { signal: controller.signal })
      const items = Array.isArray(data?.items) ? data.items : []
      setDeals((previous) => append ? [...previous, ...items] : items)
      setAccounting(data?.accounting || { wonDeals: 0, wonValue: 0, invoicedAmount: 0, paidAmount: 0, invoiceDueAmount: 0, uninvoicedAmount: 0, outstandingAmount: 0, paidDeals: 0, dueDeals: 0 })
      setPageInfo(data?.pageInfo || { page: nextPage, total: items.length, hasNextPage: false })
    } catch (err) {
      if (err?.name !== "AbortError") setError(err.message)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [debouncedSearch, invoiceState])

  useEffect(() => {
    loadDeals()
    return () => abortRef.current?.abort()
  }, [loadDeals])

  const viewInvoice = async (invoice) => {
    if (!invoice?._id) return
    try {
      const data = await apiJson(`/invoices/${invoice._id}`)
      setInvoiceView(data?.invoice || invoice)
    } catch (err) {
      toast.error(err.message)
    }
  }



  const saveColumns = async (columns) => {
    const safeColumns = normalizeColumns(columns)
    await apiJson(`/view-preferences/${encodeURIComponent(VIEW_KEY)}`, {
      method: "PUT",
      body: JSON.stringify({ columns: safeColumns }),
    })
    setSelectedColumns(safeColumns)
  }

  const handlePaymentSaved = (invoice) => {
    setPaymentInvoice(null)
    setInvoiceView(invoice)
    loadDeals()
  }

  const renderCell = (deal, column) => {
    const dueAmount = deal.invoice ? Number(deal.invoice.dueTotal || 0) : Number(deal.grandTotal || 0)
    const values = {
      title: (
        <div className="min-w-0">
          <p className="truncate font-bold text-gray-950">{deal.title || "Untitled deal"}</p>
          <p className="mt-0.5 truncate text-xs font-medium text-gray-400">{deal.dealNo || "—"}</p>
        </div>
      ),
      customer: <span className="font-semibold text-gray-900">{getClientName(deal)}</span>,
      leadNumber: deal.leadId?.leadNumber || "—",
      stage: <Badge value={deal.stage} />,
      budgetMin: formatAmount(deal.requirementSnapshot?.budgetMin),
      budgetMax: formatAmount(deal.requirementSnapshot?.budgetMax),
      expectedValue: formatAmount(deal.requirementSnapshot?.expectedValue),
      dealValue: <span className="font-bold tabular-nums text-gray-950">{formatAmount(deal.grandTotal)}</span>,
      invoiceTotal: deal.invoice
        ? <span className="font-semibold tabular-nums text-gray-800">{formatAmount(deal.invoice.total)}</span>
        : <span className="text-xs font-semibold text-gray-400">Not invoiced</span>,
      paidAmount: <span className="font-semibold tabular-nums text-emerald-700">{formatAmount(deal.invoice?.paidTotal)}</span>,
      dueAmount: <span className={cn("font-semibold tabular-nums", dueAmount > 0 ? "text-rose-700" : "text-emerald-700")}>{formatAmount(dueAmount)}</span>,
      invoiceStatus: deal.invoice ? <Badge value={deal.invoice.status} /> : <Badge value="uninvoiced" />,
      invoiceNo: deal.invoice?.invoiceNo || "—",
      closeDate: formatDate(deal.expectedCloseDate),
    }
    return values[column] ?? "—"
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <Toaster position="top-right" toastOptions={{ duration: 2600, style: { borderRadius: "14px", fontWeight: 700 } }} />

      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <motion.div
          className="mb-4 rounded-3xl border border-gray-100 bg-white/95 p-4 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.45)] backdrop-blur sm:p-5"
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
              <HBriefcaseIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-black tracking-tight text-gray-950 sm:text-3xl">Deals</h1>
              <p className="mt-0.5 text-xs font-medium text-gray-500">Won deals, orders and accounting progress</p>
            </div>
          </div>

          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="w-full xl:flex-1">
                <div className="flex min-h-[48px] items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50/80 px-3 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.10)]">
                  <HSearchIcon className="h-4 w-4 shrink-0 text-gray-400" />
                  <input
                    className="min-w-0 flex-1 border-0 bg-transparent py-3 text-sm font-medium text-gray-900 outline-none placeholder:text-gray-400"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search deals, numbers or clients..."
                  />
                  {search ? (
                    <button type="button" aria-label="Clear search" className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700" onClick={() => setSearch("")}>
                      <HCloseIcon className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 xl:justify-end">
                <motion.button whileTap={reduceMotion ? undefined : { scale: 0.98 }} className={cn(ghostButton, "h-11 px-3.5")} onClick={() => setColumnsOpen(true)}><HColumnsIcon className="h-4 w-4" />Columns</motion.button>
                <motion.button whileTap={reduceMotion ? undefined : { scale: 0.98 }} className={cn(ghostButton, "h-11 px-3.5")} onClick={() => loadDeals()} disabled={loading}><HRefreshIcon className={cn("h-4 w-4", loading && "animate-spin")} />Refresh</motion.button>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryMetric label="Won deals" value={accounting.wonDeals} hint="Closed successfully" icon={<HCheckCircleIcon className="h-5 w-5" />} tone="bg-emerald-50 text-emerald-700" />
          <SummaryMetric label="Won value" value={formatAmount(accounting.wonValue)} hint="Confirmed deal value" icon={<HBriefcaseIcon className="h-5 w-5" />} tone="bg-indigo-50 text-indigo-700" />
          <SummaryMetric label="Invoiced" value={formatAmount(accounting.invoicedAmount)} hint={`${formatAmount(accounting.uninvoicedAmount)} not invoiced`} icon={<HFileTextIcon className="h-5 w-5" />} tone="bg-sky-50 text-sky-700" />
          <SummaryMetric label="Paid" value={formatAmount(accounting.paidAmount)} hint="Payments collected" icon={<HMoneyIcon className="h-5 w-5" />} tone="bg-emerald-50 text-emerald-700" />
        </div>

        <div className="mb-4 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-1.5 shadow-[0_10px_30px_-22px_rgba(15,23,42,0.25)]">
          <div className="flex min-w-max gap-1" role="tablist" aria-label="Deal invoice state">
            {[["", "All", accounting.wonDeals], ["paid", "Paid", accounting.paidDeals], ["due", "Due", accounting.dueDeals]].map(([value, label, count]) => {
              const active = invoiceState === value
              return (
                <motion.button
                  key={label}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                  onClick={() => setInvoiceState(value)}
                  className={cn(
                    "relative inline-flex h-9 items-center gap-2 overflow-hidden rounded-xl px-4 text-sm font-bold transition-colors",
                    active ? "text-white" : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="deal-filter-active"
                      className="absolute inset-0 rounded-xl bg-indigo-600 shadow-sm"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  ) : null}
                  <span className="relative z-10">{label}</span>
                  <span className={cn("relative z-10 rounded-full px-2 py-0.5 text-[11px] font-black", active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500")}>{count}</span>
                </motion.button>
              )
            })}
          </div>
        </div>

        {error ? (
          <div className="mb-4 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-sm font-semibold text-rose-700">
            <HAlertCircleIcon className="mt-0.5 h-5 w-5 shrink-0" />{error}
          </div>
        ) : null}

        <div className={`${card} overflow-hidden`}>
          <div className="max-h-[640px] overflow-auto [scrollbar-gutter:stable]">
            <table className="w-full min-w-[1050px] border-separate border-spacing-0 text-left">
              <thead className="sticky top-0 z-20">
                <tr>
                  {selectedColumns.map((column) => (
                    <th key={column} className="whitespace-nowrap border-b border-gray-200 bg-gray-50 px-4 py-3 text-[11px] font-black uppercase tracking-wide text-gray-500">
                      {COLUMN_LABELS[column]}
                    </th>
                  ))}
                  <th className="sticky right-0 z-30 w-[210px] whitespace-nowrap border-b border-gray-200 bg-gray-50 px-4 py-3 text-right text-[11px] font-black uppercase tracking-wide text-gray-500 shadow-[-12px_0_20px_-20px_rgba(15,23,42,0.35)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={selectedColumns.length + 1} className="p-12 text-center">
                      <HLoaderIcon className="mx-auto h-7 w-7 animate-spin text-indigo-600" />
                      <p className="mt-3 text-sm font-semibold text-gray-500">Loading deals...</p>
                    </td>
                  </tr>
                ) : deals.length ? deals.map((deal) => (
                  <tr key={deal._id} className="group">
                    {selectedColumns.map((column) => (
                      <td key={column} className="max-w-[250px] whitespace-nowrap bg-white px-4 py-3 text-sm font-medium text-gray-700 transition group-hover:bg-indigo-50/40">
                        <div className="truncate">{renderCell(deal, column)}</div>
                      </td>
                    ))}
                    <td className="sticky right-0 z-10 bg-white px-4 py-2.5 text-right shadow-[-14px_0_24px_-22px_rgba(15,23,42,0.45)] transition group-hover:bg-indigo-50/40">
                      <DealRowActions
                        deal={deal}
                        onView={() => setViewDealId(deal._id)}
                        onCreateSalesOrder={handleCreateSalesOrder}
                        creatingOrderId={creatingOrderId}
                        employeeMode={employeeMode}
                        role={role}
                      />
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={selectedColumns.length + 1} className="bg-white p-10">
                      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 px-6 py-10 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-gray-500 shadow-sm ring-1 ring-gray-100">
                          <HBriefcaseIcon className="h-5 w-5" />
                        </div>
                        <p className="mt-3 text-sm font-black text-gray-950">No deals found</p>
                        <p className="mt-1 text-sm font-medium text-gray-500">Try another search or deal state.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-gray-200 bg-white px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-gray-800">{deals.length} of {pageInfo.total || 0} deals loaded</p>
              <p className="mt-0.5 text-xs font-medium text-gray-500">Newest won deals appear first.</p>
            </div>
            <button
              className={cn(pageInfo.hasNextPage ? primaryButton : ghostButton, "min-w-[145px]", !pageInfo.hasNextPage && "cursor-not-allowed text-gray-400")}
              disabled={!pageInfo.hasNextPage || loadingMore}
              onClick={() => loadDeals({ nextPage: pageInfo.page + 1, append: true })}
            >
              {loadingMore ? <HLoaderIcon className="h-4 w-4 animate-spin" /> : null}
              {loadingMore ? "Loading..." : pageInfo.hasNextPage ? "Load more" : "All deals loaded"}
            </button>
          </div>
        </div>
      </div>

      <DealDetailsModal
        dealId={viewDealId}
        onClose={() => setViewDealId("")}
        onCreateSalesOrder={handleCreateSalesOrder}
        onViewInvoice={viewInvoice}
        creatingOrderId={creatingOrderId}
        canManage={!employeeMode}
      />
      {!employeeMode ? <InvoiceDetailsModal invoice={invoiceView} onClose={() => setInvoiceView(null)} onPayment={(invoice) => setPaymentInvoice(invoice)} /> : null}
      {!employeeMode ? <PaymentModal invoice={paymentInvoice} onClose={() => setPaymentInvoice(null)} onSaved={handlePaymentSaved} /> : null}
      <ColumnPickerModal open={columnsOpen} onClose={() => setColumnsOpen(false)} selected={selectedColumns} onSave={saveColumns} />
    </div>
  )
}
