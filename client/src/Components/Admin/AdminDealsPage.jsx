"use client"
/* eslint-disable react/prop-types */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import toast, { Toaster } from "react-hot-toast"
import {
  FiAlertCircle,
  FiBriefcase,
  FiCheckCircle,
  FiCheck,
  FiChevronDown,
  FiColumns,
  FiCreditCard,
  FiDollarSign,
  FiEye,
  FiFileText,
  FiLoader,
  FiPrinter,
  FiRefreshCcw,
  FiSearch,
  FiX,
} from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const PAGE_SIZE = 25
const VIEW_KEY = "deals.accounting"
const COLUMN_LABELS = {
  title: "Deal",
  dealNo: "Deal No",
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
const DEFAULT_COLUMNS = ["title", "dealNo", "customer", "stage", "dealValue", "invoiceTotal", "paidAmount", "dueAmount", "invoiceStatus"]
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

const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_28px_-16px_rgba(0,0,0,0.22)]"
const button = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50"
const primaryButton = `${button} bg-indigo-600 text-white shadow-sm hover:bg-indigo-700`
const ghostButton = `${button} border border-gray-200 bg-white text-gray-800 hover:bg-gray-50`
const input = "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"

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
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => event.key === "Escape" && onClose?.()
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open || typeof document === "undefined") return null
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button type="button" aria-label="Close modal" className="absolute inset-0 bg-gray-950/45 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative flex max-h-[92vh] w-full ${maxWidth} flex-col overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl`}>
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-xl font-bold text-gray-950">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm font-medium text-gray-500">{subtitle}</p> : null}
          </div>
          <button type="button" className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900" onClick={onClose}>
            <FiX className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-5 sm:p-6">{children}</div>
        {footer ? <div className="border-t border-gray-100 bg-gray-50/70 px-5 py-4 sm:px-6">{footer}</div> : null}
      </div>
    </div>,
    document.body
  )
}

function ColumnPickerModal({ open, onClose, selected, onSave }) {
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Choose columns"
      subtitle="Show, hide and arrange accounting columns."
      maxWidth="max-w-5xl"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <button className={ghostButton} onClick={() => setLocal(ALLOWED_COLUMNS)}>Show all</button>
            <button className={ghostButton} onClick={() => setLocal(DEFAULT_COLUMNS)}>Default</button>
          </div>
          <div className="flex justify-end gap-2">
            <button className={ghostButton} onClick={onClose}>Cancel</button>
            <button className={primaryButton} disabled={saving || !local.length} onClick={save}>{saving ? "Saving..." : "Apply"}</button>
          </div>
        </div>
      }
    >
      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</div> : null}
      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-gray-200 px-3 py-2">
        <FiSearch className="text-gray-400" />
        <input className="flex-1 border-0 bg-transparent text-sm outline-none" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search columns..." />
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">{local.length} selected</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="overflow-hidden rounded-2xl border border-gray-100 lg:col-span-7">
          <div className="border-b border-gray-100 bg-gray-50 px-4 py-3"><p className="text-sm font-semibold text-gray-900">Available columns</p></div>
          <div className="grid gap-2 p-3 sm:grid-cols-2">
            {filtered.map((column) => {
              const checked = local.includes(column)
              return (
                <button key={column} type="button" onClick={() => toggle(column)} className={`flex items-center justify-between rounded-2xl border p-3 text-left transition ${checked ? "border-indigo-200 bg-indigo-50" : "border-gray-100 hover:bg-gray-50"}`}>
                  <span className="text-sm font-bold text-gray-900">{COLUMN_LABELS[column]}</span>
                  <span className={`flex h-6 w-6 items-center justify-center rounded-lg border ${checked ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-200 text-transparent"}`}><FiCheck /></span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-gray-100 lg:col-span-5">
          <div className="border-b border-gray-100 bg-gray-50 px-4 py-3"><p className="text-sm font-semibold text-gray-900">Selected order</p></div>
          <div className="max-h-[430px] space-y-2 overflow-y-auto p-3">
            {local.map((column, index) => (
              <div key={column} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 p-3">
                <div className="flex min-w-0 items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold">{index + 1}</span><p className="truncate text-sm font-semibold">{COLUMN_LABELS[column]}</p></div>
                <div className="flex gap-1">
                  <button className="rounded-xl border p-2 disabled:opacity-30" disabled={index === 0} onClick={() => move(column, "up")}><FiChevronDown className="rotate-180" /></button>
                  <button className="rounded-xl border p-2 disabled:opacity-30" disabled={index === local.length - 1} onClick={() => move(column, "down")}><FiChevronDown /></button>
                  <button className="rounded-xl border p-2" onClick={() => toggle(column)}><FiX /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
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

function SummaryMetric({ label, value, hint, icon, tone, glow }) {
  return (
    <div className={`rounded-2xl border border-gray-100 bg-white p-5 ${glow || "shadow-[0_18px_50px_-34px_rgba(75,85,99,0.25)]"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-500">{label}</p>
          <p className="mt-1 whitespace-nowrap text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ring-black/5 ${tone}`}>{icon}</div>
      </div>
      <p className="mt-3 text-xs text-gray-500">{hint}</p>
    </div>
  )
}

function DealDetailsModal({ dealId, onClose, onCreateInvoice, onViewInvoice }) {
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

  return (
    <Modal
      open={Boolean(dealId)}
      onClose={onClose}
      title="Deal details"
      subtitle={deal?.dealNo || deal?.title || ""}
      footer={deal ? (
        <div className="flex flex-wrap justify-end gap-2">
          <button className={ghostButton} onClick={onClose}>Close</button>
          {deal.invoice ? <button className={primaryButton} onClick={() => onViewInvoice(deal.invoice)}><FiFileText />View invoice</button> : null}
          {!deal.invoice && deal.stage === "won" ? <button className={primaryButton} onClick={() => onCreateInvoice(deal)}><FiFileText />Invoice</button> : null}
        </div>
      ) : null}
    >
      {loading ? <div className="flex justify-center p-10"><FiLoader className="h-6 w-6 animate-spin text-indigo-600" /></div> : null}
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

function InvoiceModal({ deal, onClose, onCreated }) {
  const [fullDeal, setFullDeal] = useState(deal)
  const [issuedAt, setIssuedAt] = useState(toDateInput())
  const [dueAt, setDueAt] = useState(toDateInput(addDays(new Date(), 14)))
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!deal?._id) return
    setFullDeal(deal)
    setIssuedAt(toDateInput())
    setDueAt(toDateInput(addDays(new Date(), 14)))
    setNotes("")
    setError("")
    if (Array.isArray(deal.items)) return
    setFetching(true)
    apiJson(`/deals/${deal._id}`)
      .then((data) => setFullDeal(data?.deal || deal))
      .catch((err) => setError(err.message))
      .finally(() => setFetching(false))
  }, [deal])

  const submit = async () => {
    setLoading(true)
    setError("")
    try {
      const data = await apiJson(`/invoices/from-deal/${deal._id}`, {
        method: "POST",
        body: JSON.stringify({ issuedAt, dueAt, notes }),
      })
      toast.success("Invoice created.")
      onCreated?.(data?.invoice)
    } catch (err) {
      if (err.status === 409 && err.data?.invoice) {
        toast("Invoice already exists for this deal.")
        onCreated?.(err.data.invoice)
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={Boolean(deal)}
      onClose={onClose}
      title="Create invoice"
      subtitle={`${deal?.dealNo || deal?.title || "Deal"} • ${getClientName(deal)}`}
      footer={
        <div className="flex justify-end gap-2">
          <button className={ghostButton} onClick={onClose} disabled={loading}>Cancel</button>
          <button className={primaryButton} onClick={submit} disabled={loading || fetching || !dueAt}>
            {loading ? <FiLoader className="animate-spin" /> : <FiFileText />}
            {loading ? "Creating..." : "Create invoice"}
          </button>
        </div>
      }
    >
      {error ? <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div> : null}
      {fetching ? <div className="flex justify-center p-8"><FiLoader className="h-6 w-6 animate-spin text-indigo-600" /></div> : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold text-gray-800">
              Issue date
              <input type="date" className={`${input} mt-1.5`} value={issuedAt} onChange={(event) => setIssuedAt(event.target.value)} />
            </label>
            <label className="text-sm font-bold text-gray-800">
              Due date
              <input type="date" min={issuedAt} className={`${input} mt-1.5`} value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
            </label>
          </div>
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-indigo-600">Invoice amount</p>
                <p className="mt-1 text-2xl font-black text-indigo-950">{formatMoney(fullDeal?.grandTotal, fullDeal?.currency)}</p>
              </div>
              <FiDollarSign className="h-8 w-8 text-indigo-500" />
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-gray-200">
            <table className="w-full min-w-[600px] text-left">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-xs font-black text-gray-500">Item</th>
                  <th className="px-4 py-3 text-right text-xs font-black text-gray-500">Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-black text-gray-500">Price</th>
                  <th className="px-4 py-3 text-right text-xs font-black text-gray-500">Line total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(fullDeal?.items || []).map((item) => (
                  <tr key={item._id || item.nameSnapshot}>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">{item.nameSnapshot || "Item"}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">{item.qty}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">{formatMoney(item.unitPrice, fullDeal?.currency)}</td>
                    <td className="px-4 py-3 text-right text-sm font-black text-gray-950">{formatMoney(item.lineTotal, fullDeal?.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className="block text-sm font-bold text-gray-800">
            Notes <span className="font-medium text-gray-400">(optional)</span>
            <textarea className={`${input} mt-1.5 min-h-[100px] resize-y`} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Payment terms or invoice note" />
          </label>
        </div>
      )}
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
  const [method, setMethod] = useState("cash")
  const [transactionId, setTransactionId] = useState("")
  const [paidAt, setPaidAt] = useState(toDateInput())
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!invoice) return
    setAmount(String(invoice.dueTotal || ""))
    setMethod("cash")
    setTransactionId("")
    setPaidAt(toDateInput())
    setNote("")
    setError("")
  }, [invoice])

  const submit = async () => {
    setLoading(true)
    setError("")
    try {
      const data = await apiJson(`/invoices/${invoice._id}/payments`, {
        method: "POST",
        body: JSON.stringify({ amount: Number(amount), method, transactionId, paidAt, note }),
      })
      toast.success("Payment recorded.")
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
      footer={<div className="flex justify-end gap-2"><button className={ghostButton} onClick={onClose}>Cancel</button><button className={primaryButton} disabled={loading || !Number(amount)} onClick={submit}>{loading ? <FiLoader className="animate-spin" /> : <FiCreditCard />}{loading ? "Saving..." : "Save payment"}</button></div>}
    >
      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</div> : null}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-gray-50 p-3"><p className="text-xs font-black text-gray-500">Invoice</p><p className="mt-1 font-black">{formatMoney(invoice?.total, invoice?.currency)}</p></div>
        <div className="rounded-2xl bg-emerald-50 p-3"><p className="text-xs font-black text-emerald-600">Paid</p><p className="mt-1 font-black text-emerald-800">{formatMoney(invoice?.paidTotal, invoice?.currency)}</p></div>
        <div className="rounded-2xl bg-rose-50 p-3"><p className="text-xs font-black text-rose-600">Due</p><p className="mt-1 font-black text-rose-800">{formatMoney(invoice?.dueTotal, invoice?.currency)}</p></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold">Amount *<input type="number" min="0.01" max={invoice?.dueTotal} step="0.01" className={`${input} mt-1.5`} value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        <label className="text-sm font-bold">Method<select className={`${input} mt-1.5`} value={method} onChange={(event) => setMethod(event.target.value)}>{["cash", "bank", "bkash", "nagad", "rocket", "card", "other"].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="text-sm font-bold">Payment date<input type="date" className={`${input} mt-1.5`} value={paidAt} onChange={(event) => setPaidAt(event.target.value)} /></label>
        <label className="text-sm font-bold">Transaction ID <span className="font-medium text-gray-400">(optional)</span><input className={`${input} mt-1.5`} value={transactionId} onChange={(event) => setTransactionId(event.target.value)} /></label>
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
          {Number(invoice?.dueTotal || 0) > 0 ? <button className={ghostButton} onClick={() => onPayment(invoice)}><FiCreditCard />Add payment</button> : null}
          <button className={primaryButton} onClick={() => printInvoice(invoice)}><FiPrinter />Print invoice</button>
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

export default function AdminDealsPage() {
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
  const [invoiceDeal, setInvoiceDeal] = useState(null)
  const [invoiceView, setInvoiceView] = useState(null)
  const [paymentInvoice, setPaymentInvoice] = useState(null)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [selectedColumns, setSelectedColumns] = useState(DEFAULT_COLUMNS)
  const abortRef = useRef(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    apiJson(`/view-preferences/${encodeURIComponent(VIEW_KEY)}`)
      .then((data) => setSelectedColumns(Array.isArray(data?.columns) && data.columns.length ? data.columns : DEFAULT_COLUMNS))
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

  const handleInvoiceCreated = (invoice) => {
    setInvoiceDeal(null)
    setInvoiceView(invoice)
    loadDeals()
  }

  const saveColumns = async (columns) => {
    const safeColumns = columns.length ? columns : DEFAULT_COLUMNS
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
    const currency = deal.invoice?.currency || deal.currency
    const dueAmount = deal.invoice ? Number(deal.invoice.dueTotal || 0) : Number(deal.grandTotal || 0)
    const values = {
      title: deal.title || "—",
      dealNo: deal.dealNo || "—",
      customer: getClientName(deal),
      leadNumber: deal.leadId?.leadNumber || "—",
      stage: <Badge value={deal.stage} />,
      budgetMin: formatMoney(deal.requirementSnapshot?.budgetMin, deal.currency),
      budgetMax: formatMoney(deal.requirementSnapshot?.budgetMax, deal.currency),
      expectedValue: formatMoney(deal.requirementSnapshot?.expectedValue, deal.currency),
      dealValue: formatMoney(deal.grandTotal, deal.currency),
      invoiceTotal: deal.invoice ? formatMoney(deal.invoice.total, currency) : "—",
      paidAmount: <span className="font-semibold text-emerald-700">{formatMoney(deal.invoice?.paidTotal, currency)}</span>,
      dueAmount: <span className={`font-semibold ${dueAmount > 0 ? "text-rose-700" : "text-emerald-700"}`}>{formatMoney(dueAmount, currency)}</span>,
      invoiceStatus: deal.invoice ? <Badge value={deal.invoice.status} /> : <Badge value="uninvoiced" />,
      invoiceNo: deal.invoice?.invoiceNo || "—",
      closeDate: formatDate(deal.expectedCloseDate),
    }
    return values[column] ?? "—"
  }

  return (
    <div className="min-h-screen bg-gray-50/60">
      <Toaster position="top-right" toastOptions={{ duration: 2600, style: { borderRadius: "12px", fontWeight: 600 } }} />
      <div className="mx-auto max-w-[1550px] space-y-5 px-1 py-1 sm:px-3">
        <div className={`${card} p-5 sm:p-6`}>
          <div className="flex items-center gap-3 border-b border-gray-100 pb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm"><FiBriefcase className="h-6 w-6" /></div>
              <h1 className="text-2xl font-bold text-gray-950 sm:text-3xl">Deals</h1>
            </div>
          </div>
          <div className="flex flex-col gap-3 pt-5 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <FiSearch className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input className={`${input} h-12 pl-10`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search deals, numbers or clients..." />
              </div>
              <div className="flex gap-2">
                <button className={ghostButton} onClick={() => setColumnsOpen(true)}><FiColumns />Columns</button>
                <button className={ghostButton} onClick={() => loadDeals()} disabled={loading}><FiRefreshCcw className={loading ? "animate-spin" : ""} />Refresh</button>
              </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryMetric label="Won deals" value={accounting.wonDeals} hint="Closed successfully" icon={<FiCheckCircle />} tone="bg-emerald-50 text-emerald-700" glow="shadow-[0_18px_50px_-30px_rgba(34,197,94,0.28)]" />
          <SummaryMetric label="Won value" value={formatAmount(accounting.wonValue)} hint="Total confirmed value" icon={<FiBriefcase />} tone="bg-indigo-50 text-indigo-700" glow="shadow-[0_18px_50px_-30px_rgba(79,70,229,0.30)]" />
          <SummaryMetric label="Invoiced" value={formatAmount(accounting.invoicedAmount)} hint={`${formatAmount(accounting.uninvoicedAmount)} not invoiced`} icon={<FiFileText />} tone="bg-sky-50 text-sky-700" />
          <SummaryMetric label="Paid" value={formatAmount(accounting.paidAmount)} hint="Payments collected" icon={<FiDollarSign />} tone="bg-emerald-50 text-emerald-700" glow="shadow-[0_18px_50px_-30px_rgba(34,197,94,0.28)]" />
        </div>

        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white p-1.5 shadow-sm">
          <div className="flex min-w-max gap-1">
            {[["", "All", accounting.wonDeals], ["paid", "Paid", accounting.paidDeals], ["due", "Due", accounting.dueDeals]].map(([value, label, count]) => (
              <button key={label} type="button" onClick={() => setInvoiceState(value)} className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${invoiceState === value ? "bg-indigo-600 text-white shadow-sm" : "text-gray-700 hover:bg-gray-100"}`}>
                {label}<span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${invoiceState === value ? "bg-white/20" : "bg-gray-100"}`}>{count}</span>
              </button>
            ))}
          </div>
        </div>

        {error ? <div className="mb-4 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700"><FiAlertCircle className="mt-0.5 h-5 w-5" />{error}</div> : null}

        <div className={`${card} overflow-hidden`}>
          <div className="h-[620px] overflow-auto [scrollbar-gutter:stable]">
            <table className="w-full min-w-[1200px] border-separate border-spacing-0 text-left">
              <thead className="sticky top-0 z-20">
                <tr>
                  {selectedColumns.map((column) => <th key={column} className="whitespace-nowrap border-b border-gray-200 bg-gray-50 px-5 py-4 text-xs font-semibold uppercase text-gray-600">{COLUMN_LABELS[column]}</th>)}
                  <th className="sticky right-0 z-30 whitespace-nowrap border-b border-gray-200 bg-gray-50 px-5 py-4 text-right text-xs font-semibold uppercase text-gray-600 shadow-[-12px_0_20px_-20px_rgba(15,23,42,0.35)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {loading ? (
                  <tr><td colSpan={selectedColumns.length + 1} className="p-12 text-center"><FiLoader className="mx-auto h-7 w-7 animate-spin text-indigo-600" /></td></tr>
                ) : deals.length ? deals.map((deal) => (
                    <tr key={deal._id} className="group">
                      {selectedColumns.map((column) => <td key={column} className="max-w-[240px] whitespace-nowrap bg-white px-5 py-3.5 text-sm font-medium text-gray-800 transition group-hover:bg-indigo-50/40"><div className="truncate">{renderCell(deal, column)}</div></td>)}
                      <td className="sticky right-0 z-10 bg-white px-5 py-2.5 text-right shadow-[-14px_0_24px_-22px_rgba(15,23,42,0.45)] group-hover:bg-indigo-50/40">
                        <div className="flex justify-end gap-2">
                          <button className={ghostButton} onClick={() => setViewDealId(deal._id)}><FiEye />View</button>
                          <button className={primaryButton} disabled={!deal.customerId} onClick={() => deal.invoice ? viewInvoice(deal.invoice) : setInvoiceDeal(deal)}><FiFileText />Invoice</button>
                        </div>
                      </td>
                    </tr>
                )) : (
                  <tr><td colSpan={selectedColumns.length + 1} className="p-12 text-center"><FiBriefcase className="mx-auto h-9 w-9 text-gray-300" /><p className="mt-3 font-semibold text-gray-900">No deals found</p><p className="mt-1 text-sm text-gray-500">No won deals match this accounting tab.</p></td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-gray-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-sm font-semibold text-gray-800">{deals.length} of {pageInfo.total || 0} deals loaded</p><p className="mt-0.5 text-xs text-gray-500">Newest deals appear first.</p></div>
            <button className={pageInfo.hasNextPage ? primaryButton : `${ghostButton} cursor-not-allowed text-gray-400`} disabled={!pageInfo.hasNextPage || loadingMore} onClick={() => loadDeals({ nextPage: pageInfo.page + 1, append: true })}>{loadingMore ? <FiLoader className="animate-spin" /> : null}{loadingMore ? "Loading..." : pageInfo.hasNextPage ? "Load more" : "All deals loaded"}</button>
          </div>
        </div>
      </div>

      <DealDetailsModal dealId={viewDealId} onClose={() => setViewDealId("")} onCreateInvoice={(deal) => { setViewDealId(""); setInvoiceDeal(deal) }} onViewInvoice={viewInvoice} />
      <InvoiceModal deal={invoiceDeal} onClose={() => setInvoiceDeal(null)} onCreated={handleInvoiceCreated} />
      <InvoiceDetailsModal invoice={invoiceView} onClose={() => setInvoiceView(null)} onPayment={(invoice) => setPaymentInvoice(invoice)} />
      <PaymentModal invoice={paymentInvoice} onClose={() => setPaymentInvoice(null)} onSaved={handlePaymentSaved} />
      <ColumnPickerModal open={columnsOpen} onClose={() => setColumnsOpen(false)} selected={selectedColumns} onSave={saveColumns} />
    </div>
  )
}
