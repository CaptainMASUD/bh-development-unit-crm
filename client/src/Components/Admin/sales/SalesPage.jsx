"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import PropTypes from "prop-types"
import toast, { Toaster } from "react-hot-toast"
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Download,
  Eye,
  FileText,
  PackageCheck,
  Plus,
  RefreshCcw,
  RotateCcw,
  Search,
  Send,
  ShoppingCart,
  Truck,
  Undo2,
  X,
  XCircle,
} from "lucide-react"
import { useSelector } from "react-redux"
import { hasPermission } from "../../Auth/permissions"
import {
  cleanId,
  formatDate,
  formatMoney,
  makeIdempotencyKey,
  pretty,
  salesHeaders,
  salesJson,
  salesRequest,
} from "./salesApi"

const CONFIG = {
  quotations: {
    title: "Sales Quotations",
    description: "Accept offers internally to move leads into Negotiation. Winning the lead creates its Customer, Won Deal and Sales Order.",
    resource: "quotations",
    number: "quotationNumber",
    date: "quotationDate",
    viewPermission: "sales-quotation:view",
    managePermission: "sales-quotation:manage",
    statuses: ["draft", "sent", "viewed", "under_negotiation", "accepted", "rejected", "expired", "cancelled"],
    icon: FileText,
  },
  orders: {
    title: "Sales Orders",
    description: "Approve customer commitments, enforce credit controls, and reserve inventory before fulfillment.",
    resource: "orders",
    number: "orderNumber",
    date: "orderDate",
    viewPermission: "sales-order:view",
    managePermission: "sales-order:manage",
    statuses: ["draft", "pending_approval", "approved", "confirmed", "partially_fulfilled", "fulfilled", "closed", "cancelled"],
    icon: ShoppingCart,
  },
  deliveries: {
    title: "Deliveries",
    description: "Coordinate picking, dispatch, proof of delivery, and atomic inventory issue posting.",
    resource: "deliveries",
    number: "deliveryNumber",
    date: "scheduledDate",
    viewPermission: "sales-delivery:view",
    managePermission: "sales-delivery:manage",
    statuses: ["draft", "picking", "picked", "packing", "packed", "ready_for_dispatch", "dispatched", "in_transit", "partially_delivered", "delivered", "failed", "cancelled"],
    icon: Truck,
  },
  invoices: {
    title: "Sales Invoices & Receipts",
    description: "Post receivables, revenue, VAT, COGS, customer collections, and payment reversals.",
    resource: "invoices",
    number: "invoiceNumber",
    date: "invoiceDate",
    viewPermission: "sales-invoice:view",
    managePermission: "sales-invoice:manage",
    statuses: ["draft", "posted", "sent", "partially_paid", "paid", "overdue", "void", "cancelled"],
    icon: CircleDollarSign,
  },
  returns: {
    title: "Sales Returns & Credit Notes",
    description: "Control return approvals, stock restoration, credit notes, and customer refunds.",
    resource: "returns",
    number: "returnNumber",
    date: "returnDate",
    viewPermission: "sales-return:view",
    managePermission: "sales-return:manage",
    statuses: ["draft", "pending_approval", "posted", "rejected", "cancelled", "refunded"],
    icon: Undo2,
  },
}

const STATUS_TONES = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-sky-50 text-sky-700",
  viewed: "bg-cyan-50 text-cyan-700",
  under_negotiation: "bg-amber-50 text-amber-700",
  accepted: "bg-emerald-50 text-emerald-700",
  approved: "bg-emerald-50 text-emerald-700",
  confirmed: "bg-indigo-50 text-indigo-700",
  posted: "bg-indigo-50 text-indigo-700",
  delivered: "bg-emerald-50 text-emerald-700",
  paid: "bg-emerald-50 text-emerald-700",
  partially_paid: "bg-amber-50 text-amber-700",
  pending_approval: "bg-amber-50 text-amber-700",
  rejected: "bg-rose-50 text-rose-700",
  cancelled: "bg-rose-50 text-rose-700",
  void: "bg-rose-50 text-rose-700",
  overdue: "bg-rose-50 text-rose-700",
}

const QUOTATION_TRANSITIONS = {
  draft: ["sent", "cancelled"],
  sent: ["viewed", "under_negotiation", "accepted", "rejected", "expired", "cancelled"],
  viewed: ["under_negotiation", "accepted", "rejected", "expired", "cancelled"],
  under_negotiation: ["sent", "accepted", "rejected", "expired", "cancelled"],
}

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-400"
const labelClass = "mb-1.5 block text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500"

function StatusBadge({ value }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold ${STATUS_TONES[value] || "bg-slate-100 text-slate-700"}`}>{pretty(value)}</span>
}

StatusBadge.propTypes = { value: PropTypes.string }

function Field({ label, children }) {
  return <label className="block"><span className={labelClass}>{label}</span>{children}</label>
}

Field.propTypes = { label: PropTypes.string.isRequired, children: PropTypes.node.isRequired }

function Modal({ title, subtitle, children, onClose, wide = false }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className={`max-h-[92vh] w-full overflow-hidden rounded-3xl border border-white/40 bg-white shadow-2xl ${wide ? "max-w-5xl" : "max-w-2xl"}`}>
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div><h3 className="text-xl font-black tracking-tight text-slate-950">{title}</h3>{subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}</div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-800" aria-label="Close"><X size={20} /></button>
        </div>
        <div className="max-h-[calc(92vh-88px)] overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  )
}

Modal.propTypes = { title: PropTypes.string.isRequired, subtitle: PropTypes.string, children: PropTypes.node.isRequired, onClose: PropTypes.func.isRequired, wide: PropTypes.bool }

function PrimaryButton({ children, ...props }) {
  return <button type="button" {...props} className={`inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 ${props.className || ""}`}>{children}</button>
}

PrimaryButton.propTypes = { children: PropTypes.node.isRequired, className: PropTypes.string }

function SecondaryButton({ children, ...props }) {
  return <button type="button" {...props} className={`inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 ${props.className || ""}`}>{children}</button>
}

SecondaryButton.propTypes = { children: PropTypes.node.isRequired, className: PropTypes.string }

function customerName(value, maps) {
  if (!value) return "—"
  if (typeof value === "object") {
    if (value.leadContact?.companyName || value.leadContact?.name) {
      return `${value.leadContact.companyName || value.leadContact.name} (Lead)`
    }
    if (value.customerId) {
      return customerName(value.customerId, maps)
    }
    return value.companyName || value.name || "Customer"
  }
  const customer = maps?.customers?.get(String(value))
  return customer?.companyName || customer?.name || "Customer"
}

function newLine(product = null) {
  return {
    key: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    productId: cleanId(product),
    quantity: 1,
    unitPrice: Number(product?.sellingPrice || 0),
    discountType: "fixed",
    discountValue: 0,
    taxRate: Number(product?.taxRate || 0),
  }
}

function QuotationForm({ options, record, busy, onSubmit, onCancel }) {
  const availableCustomers = options.customers.filter((item) => !item.creditHold)
  const availableLeads = options.leads || []

  const queryLeadId = useMemo(() => {
    if (typeof window === "undefined") return ""
    const params = new URLSearchParams(window.location.search)
    return params.get("createQuotationForLead") || ""
  }, [])

  const initialTargetType = record?.leadId || (!record?.customerId && (queryLeadId || availableLeads.length > 0 && availableCustomers.length === 0)) ? "lead" : "customer"
  const [targetType, setTargetType] = useState(initialTargetType)

  const [form, setForm] = useState(() => {
    const defaultLeadId = cleanId(record?.leadId || queryLeadId || availableLeads[0]?._id)
    const defaultCustomerId = cleanId(record?.customerId || availableCustomers[0]?._id)
    return {
      branchId: cleanId(record?.branchId || options.branches.find((item) => item.isDefault || item.isMain) || options.branches[0]),
      customerId: initialTargetType === "customer" ? defaultCustomerId : "",
      leadId: initialTargetType === "lead" ? defaultLeadId : "",
      salespersonId: cleanId(record?.salespersonId || options.salespeople[0]),
      quotationDate: record?.quotationDate ? new Date(record.quotationDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      validUntil: record?.validUntil ? new Date(record.validUntil).toISOString().slice(0, 10) : "",
      paymentTermsDays: record?.paymentTermsDays ?? (initialTargetType === "customer" ? availableCustomers[0]?.paymentTermsDays ?? 0 : 0),
      notes: record?.notes || "",
      lines: record?.lines?.length ? record.lines.map((line) => ({ ...newLine(), ...line, productId: cleanId(line.productId) })) : [newLine(options.products[0])],
    }
  })
  const updateLine = (key, patch) => setForm((current) => ({ ...current, lines: current.lines.map((line) => line.key === key ? { ...line, ...patch } : line) }))
  const chooseProduct = (line, productId) => {
    const product = options.products.find((item) => String(item._id) === String(productId))
    updateLine(line.key, { productId, unitPrice: Number(product?.sellingPrice || 0), taxRate: Number(product?.taxRate || 0) })
  }
  const estimated = form.lines.reduce((sum, line) => {
    const base = Number(line.quantity || 0) * Number(line.unitPrice || 0)
    const discount = line.discountType === "percentage" ? base * Number(line.discountValue || 0) / 100 : Number(line.discountValue || 0)
    const taxable = Math.max(base - discount, 0)
    return sum + taxable + taxable * Number(line.taxRate || 0) / 100
  }, 0)
  const submit = () => onSubmit({
    ...form,
    customerId: targetType === "customer" ? (form.customerId || undefined) : undefined,
    leadId: targetType === "lead" ? (form.leadId || undefined) : undefined,
    lines: form.lines.map((line) => ({
      productId: line.productId,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
      discountType: line.discountType,
      discountValue: Number(line.discountValue),
      taxRate: Number(line.taxRate),
    })),
  })
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Field label="Quotation For">
          <div className="flex h-10 items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 px-3">
            <label className="flex items-center gap-1.5 text-xs font-black text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="targetType"
                checked={targetType === "customer"}
                onChange={() => {
                  setTargetType("customer")
                  setForm((current) => ({
                    ...current,
                    customerId: cleanId(availableCustomers[0]?._id),
                    leadId: "",
                    paymentTermsDays: availableCustomers[0]?.paymentTermsDays ?? 0,
                  }))
                }}
              />
              Existing Customer
            </label>
            <label className="flex items-center gap-1.5 text-xs font-black text-indigo-700 cursor-pointer">
              <input
                type="radio"
                name="targetType"
                checked={targetType === "lead"}
                onChange={() => {
                  setTargetType("lead")
                  setForm((current) => ({
                    ...current,
                    leadId: cleanId(availableLeads[0]?._id || queryLeadId),
                    customerId: "",
                    paymentTermsDays: 0,
                  }))
                }}
              />
              CRM Lead
            </label>
          </div>
        </Field>
        <Field label="Branch"><select className={inputClass} value={form.branchId} onChange={(event) => setForm({ ...form, branchId: event.target.value })}>{options.branches.map((item) => <option key={item._id} value={item._id}>{item.name} ({item.code})</option>)}</select></Field>
        {targetType === "customer" ? (
          <Field label="Customer">
            <select
              className={inputClass}
              value={form.customerId}
              onChange={(event) => {
                const customer = availableCustomers.find((item) => String(item._id) === event.target.value)
                setForm({ ...form, customerId: event.target.value, leadId: "", paymentTermsDays: customer?.paymentTermsDays || 0 })
              }}
            >
              {availableCustomers.map((item) => <option key={item._id} value={item._id}>{item.companyName || item.name}</option>)}
            </select>
          </Field>
        ) : (
          <Field label="CRM Lead">
            <select
              className={inputClass}
              value={form.leadId}
              onChange={(event) => setForm({ ...form, leadId: event.target.value, customerId: "" })}
            >
              {availableLeads.length ? availableLeads.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.contact?.companyName || item.contact?.name || item.leadNumber} ({item.pipelineStage})
                </option>
              )) : <option value="">No active unconverted leads</option>}
            </select>
          </Field>
        )}
        <Field label="Salesperson"><select className={inputClass} value={form.salespersonId} onChange={(event) => setForm({ ...form, salespersonId: event.target.value })}>{options.salespeople.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></Field>
        <Field label="Quotation date"><input className={inputClass} type="date" value={form.quotationDate} onChange={(event) => setForm({ ...form, quotationDate: event.target.value })} /></Field>
        <Field label="Valid until"><input className={inputClass} type="date" value={form.validUntil} onChange={(event) => setForm({ ...form, validUntil: event.target.value })} /></Field>
        <Field label="Payment terms (days)"><input className={inputClass} type="number" min="0" value={form.paymentTermsDays} onChange={(event) => setForm({ ...form, paymentTermsDays: Number(event.target.value) })} /></Field>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="flex items-center justify-between bg-slate-50 px-4 py-3"><p className="text-sm font-black text-slate-800">Quotation lines</p><SecondaryButton onClick={() => setForm({ ...form, lines: [...form.lines, newLine(options.products[0])] })}><Plus size={16} /> Add line</SecondaryButton></div>
        <div className="divide-y divide-slate-100">
          {form.lines.map((line, index) => <div key={line.key} className="grid gap-3 p-4 md:grid-cols-[2fr_.7fr_1fr_.8fr_.8fr_auto]">
            <Field label={`Product ${index + 1}`}><select className={inputClass} value={line.productId} onChange={(event) => chooseProduct(line, event.target.value)}>{options.products.map((item) => <option key={item._id} value={item._id}>{item.sku} — {item.name}</option>)}</select></Field>
            <Field label="Quantity"><input className={inputClass} type="number" min="0.000001" step="any" value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: event.target.value })} /></Field>
            <Field label="Unit price"><input className={inputClass} type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => updateLine(line.key, { unitPrice: event.target.value })} /></Field>
            <Field label="Discount"><input className={inputClass} type="number" min="0" step="0.01" value={line.discountValue} onChange={(event) => updateLine(line.key, { discountValue: event.target.value })} /></Field>
            <Field label="Tax %"><input className={inputClass} type="number" min="0" max="100" step="0.01" value={line.taxRate} onChange={(event) => updateLine(line.key, { taxRate: event.target.value })} /></Field>
            <button type="button" disabled={form.lines.length === 1} onClick={() => setForm({ ...form, lines: form.lines.filter((item) => item.key !== line.key) })} className="mt-6 h-10 rounded-xl p-2 text-rose-500 hover:bg-rose-50 disabled:opacity-30"><X size={18} /></button>
          </div>)}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <Field label="Notes"><textarea className={inputClass} rows="3" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
        <div className="min-w-52 rounded-2xl bg-indigo-50 p-4 text-right"><p className="text-xs font-extrabold uppercase tracking-wider text-indigo-500">Estimated total</p><p className="mt-1 text-2xl font-black text-indigo-950">{formatMoney(estimated)}</p></div>
      </div>
      <div className="flex justify-end gap-3"><SecondaryButton onClick={onCancel}>Cancel</SecondaryButton><PrimaryButton disabled={busy || (!form.customerId && !form.leadId) || !form.lines.every((line) => line.productId)} onClick={submit}>{busy ? "Saving…" : record ? "Update quotation" : "Create quotation"}</PrimaryButton></div>
    </div>
  )
}

QuotationForm.propTypes = { options: PropTypes.object.isRequired, record: PropTypes.object, busy: PropTypes.bool, onSubmit: PropTypes.func.isRequired, onCancel: PropTypes.func.isRequired }

function OrderEditForm({ record, busy, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    promisedDeliveryDate: record?.promisedDeliveryDate ? new Date(record.promisedDeliveryDate).toISOString().slice(0, 10) : "",
    customerReference: record?.customerReference || "",
    notes: record?.notes || "",
  })
  return <div className="space-y-5">
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Promised delivery"><input className={inputClass} type="date" value={form.promisedDeliveryDate} onChange={(event) => setForm({ ...form, promisedDeliveryDate: event.target.value })} /></Field>
      <Field label="Customer reference"><input className={inputClass} value={form.customerReference} onChange={(event) => setForm({ ...form, customerReference: event.target.value })} /></Field>
    </div>
    <Field label="Customer notes"><textarea className={inputClass} rows="3" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
    <div className="flex justify-end gap-3"><SecondaryButton onClick={onCancel}>Cancel</SecondaryButton><PrimaryButton disabled={busy} onClick={() => onSubmit({ ...form, promisedDeliveryDate: form.promisedDeliveryDate || null })}>{busy ? "Saving…" : "Update order"}</PrimaryButton></div>
  </div>
}

OrderEditForm.propTypes = { record: PropTypes.object.isRequired, busy: PropTypes.bool, onSubmit: PropTypes.func.isRequired, onCancel: PropTypes.func.isRequired }

function SimpleActionForm({ action, record, options, lookups, busy, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => ({
    status: QUOTATION_TRANSITIONS[record?.status]?.[0] || "sent",
    warehouseId: cleanId(options.warehouses.find((item) => item.isDefault) || options.warehouses[0]),
    salesOrderId: cleanId(lookups.orders?.[0]),
    dueDate: "",
    paymentTermsDays: 0,
    amount: record?.dueAmount || record?.refundDue || 0,
    method: "bank_transfer",
    treasuryType: options.bankAccounts.length ? "bank" : "cash",
    treasuryAccount: cleanId(options.bankAccounts[0] || options.cashAccounts[0]),
    reason: "",
    reference: "",
  }))
  const statusOptions = QUOTATION_TRANSITIONS[record?.status] || []
  const confirmationCopy = {
    submit: "Submit this document for approval?",
    approve: "Approve this document and continue its workflow?",
    confirmOrder: "Confirm this order and reserve its inventory?",
    close: "Close this fulfilled sales order?",
    deliveryStatus: "Move this delivery to its next status?",
    confirmDelivery: "Confirm delivery and post the received quantities to the sales order?",
    postInvoice: "Post this invoice to accounting? This creates the receivable and revenue entries.",
    sendInvoice: "Mark this posted invoice as sent to the customer?",
  }
  const treasury = form.treasuryType === "bank" ? options.bankAccounts : options.cashAccounts
  useEffect(() => {
    if (!treasury.some((item) => String(item._id) === String(form.treasuryAccount))) {
      setForm((current) => ({ ...current, treasuryAccount: cleanId(treasury[0]) }))
    }
  }, [form.treasuryAccount, treasury])
  return <div className="space-y-5">
    {confirmationCopy[action] ? <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm font-semibold leading-6 text-indigo-950">{confirmationCopy[action]}</div> : null}
    {action === "quotationStatus" ? <Field label="New status"><select className={inputClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{statusOptions.map((item) => <option key={item} value={item}>{pretty(item)}</option>)}</select></Field> : null}
    {action === "convert" ? <Field label="Fulfillment warehouse"><select className={inputClass} value={form.warehouseId} onChange={(event) => setForm({ ...form, warehouseId: event.target.value })}>{options.warehouses.map((item) => <option key={item._id} value={item._id}>{item.name} ({item.code})</option>)}</select></Field> : null}
    {["createDelivery", "createInvoice"].includes(action) ? <Field label="Sales order"><select className={inputClass} value={form.salesOrderId} onChange={(event) => setForm({ ...form, salesOrderId: event.target.value })}>{(lookups.orders || []).map((item) => <option key={item._id} value={item._id}>{item.orderNumber} — {pretty(item.status)}</option>)}</select></Field> : null}
    {action === "createDelivery" ? <Field label="Warehouse"><select className={inputClass} value={form.warehouseId} onChange={(event) => setForm({ ...form, warehouseId: event.target.value })}>{options.warehouses.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></Field> : null}
    {action === "createInvoice" ? <div className="grid gap-4 md:grid-cols-2"><Field label="Due date"><input className={inputClass} type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></Field><Field label="Payment terms (days)"><input className={inputClass} type="number" min="0" value={form.paymentTermsDays} onChange={(event) => setForm({ ...form, paymentTermsDays: Number(event.target.value) })} /></Field></div> : null}
    {["payment", "refund"].includes(action) ? <>
      <div className="grid gap-4 md:grid-cols-2"><Field label="Amount"><input className={inputClass} type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></Field><Field label="Reference"><input className={inputClass} value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} /></Field></div>
      <div className="grid gap-4 md:grid-cols-2"><Field label="Treasury type"><select className={inputClass} value={form.treasuryType} onChange={(event) => setForm({ ...form, treasuryType: event.target.value })}><option value="bank">Bank account</option><option value="cash">Cash account</option></select></Field><Field label="Account"><select className={inputClass} value={form.treasuryAccount} onChange={(event) => setForm({ ...form, treasuryAccount: event.target.value })}>{treasury.map((item) => <option key={item._id} value={item._id}>{item.accountName || item.name} {item.accountNumber ? `••${String(item.accountNumber).slice(-4)}` : ""}</option>)}</select></Field></div>
    </> : null}
    {["reject", "cancel", "void", "reversePayment"].includes(action) ? <Field label="Reason"><textarea className={inputClass} rows="3" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="A reason is required for the audit trail" /></Field> : null}
    <div className="flex justify-end gap-3"><SecondaryButton onClick={onCancel}>Cancel</SecondaryButton><PrimaryButton disabled={busy} onClick={() => onSubmit(form)}>{busy ? "Processing…" : "Continue"}<ArrowRight size={16} /></PrimaryButton></div>
  </div>
}

SimpleActionForm.propTypes = { action: PropTypes.string.isRequired, record: PropTypes.object, options: PropTypes.object.isRequired, lookups: PropTypes.object.isRequired, busy: PropTypes.bool, onSubmit: PropTypes.func.isRequired, onCancel: PropTypes.func.isRequired }

function ReturnForm({ invoices, busy, onSubmit, onCancel }) {
  const eligible = invoices.filter((item) => ["posted", "sent", "partially_paid", "paid", "overdue"].includes(item.status))
  const [invoiceId, setInvoiceId] = useState(cleanId(eligible[0]))
  const [invoice, setInvoice] = useState(null)
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!invoiceId) return
    const controller = new AbortController()
    setLoading(true)
    salesRequest(`/sales/invoices/${invoiceId}`, { signal: controller.signal })
      .then((payload) => { setInvoice(payload.data); setLines((payload.data?.lines || []).map((line) => ({ invoiceLineId: line._id, name: line.name, maximum: line.quantity, quantity: 0, reason: "", condition: "resalable", restock: true }))) })
      .catch((error) => { if (error.name !== "AbortError") toast.error(error.message) })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [invoiceId])
  const update = (id, patch) => setLines((current) => current.map((line) => line.invoiceLineId === id ? { ...line, ...patch } : line))
  const selected = lines.filter((line) => Number(line.quantity) > 0)
  return <div className="space-y-5">
    <Field label="Posted invoice"><select className={inputClass} value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)}>{eligible.map((item) => <option key={item._id} value={item._id}>{item.invoiceNumber} — {formatMoney(item.totals?.grandTotal, item.currency)}</option>)}</select></Field>
    {loading ? <div className="h-32 animate-pulse rounded-2xl bg-slate-100" /> : invoice ? <div className="overflow-hidden rounded-2xl border border-slate-200"><div className="bg-slate-50 px-4 py-3 text-sm font-black text-slate-800">Select quantities to return</div>{lines.map((line) => <div key={line.invoiceLineId} className="grid gap-3 border-t border-slate-100 p-4 md:grid-cols-[1.5fr_.6fr_1.2fr_.8fr]">
      <div><p className="text-sm font-extrabold text-slate-800">{line.name}</p><p className="text-xs text-slate-500">Maximum {line.maximum}</p></div>
      <input className={inputClass} type="number" min="0" max={line.maximum} step="any" value={line.quantity} onChange={(event) => update(line.invoiceLineId, { quantity: event.target.value })} />
      <input className={inputClass} placeholder="Return reason" value={line.reason} onChange={(event) => update(line.invoiceLineId, { reason: event.target.value })} />
      <select className={inputClass} value={line.condition} onChange={(event) => update(line.invoiceLineId, { condition: event.target.value, restock: event.target.value === "resalable" })}><option value="resalable">Resalable</option><option value="damaged">Damaged</option><option value="defective">Defective</option><option value="expired">Expired</option></select>
    </div>)}</div> : <p className="rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">No posted invoices are available.</p>}
    <div className="flex justify-end gap-3"><SecondaryButton onClick={onCancel}>Cancel</SecondaryButton><PrimaryButton disabled={busy || !selected.length || selected.some((line) => !line.reason.trim())} onClick={() => onSubmit({ salesInvoiceId: invoiceId, lines: selected.map(({ invoiceLineId, quantity, reason, condition, restock }) => ({ invoiceLineId, quantity: Number(quantity), reason, condition, restock })) })}>{busy ? "Saving…" : "Create return"}</PrimaryButton></div>
  </div>
}

ReturnForm.propTypes = { invoices: PropTypes.array.isRequired, busy: PropTypes.bool, onSubmit: PropTypes.func.isRequired, onCancel: PropTypes.func.isRequired }

function DetailView({ record, config, maps, onClose, onReversePayment }) {
  const totals = record.totals || {}
  return <Modal title={record[config.number] || config.title} subtitle={`${customerName(record.customerId, maps)} · ${pretty(record.status)}`} onClose={onClose} wide>
    <div className="grid gap-4 md:grid-cols-4">
      {[ ["Status", <StatusBadge key="status" value={record.status} />], ["Document date", formatDate(record[config.date])], ["Grand total", formatMoney(totals.grandTotal ?? record.totalAmount, record.currency)], ["Amount due", formatMoney(record.dueAmount ?? record.refundDue, record.currency)] ].map(([label, value]) => <div key={label} className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><div className="mt-2 text-sm font-black text-slate-900">{value}</div></div>)}
    </div>
    {record.lines?.length ? <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Item</th><th className="px-4 py-3">Quantity</th><th className="px-4 py-3">Unit price</th><th className="px-4 py-3 text-right">Total</th></tr></thead><tbody className="divide-y divide-slate-100">{record.lines.map((line) => <tr key={line._id}><td className="px-4 py-3 font-bold text-slate-800">{line.name || line.productId}</td><td className="px-4 py-3">{line.quantity ?? line.orderedQty}</td><td className="px-4 py-3">{formatMoney(line.unitPrice, record.currency)}</td><td className="px-4 py-3 text-right font-extrabold">{formatMoney(line.lineTotal ?? line.totalAmount, record.currency)}</td></tr>)}</tbody></table></div> : null}
    {record.paymentAllocations?.length ? <div className="mt-6"><h4 className="mb-3 text-sm font-black text-slate-900">Payment allocations</h4><div className="space-y-2">{record.paymentAllocations.map((payment) => <div key={payment._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div><p className="font-extrabold text-slate-800">{formatMoney(payment.amount, record.currency)}</p><p className="text-xs text-slate-500">{formatDate(payment.paymentDate)} · {pretty(payment.method)} · {payment.reference || "No reference"}</p></div>{onReversePayment ? <SecondaryButton onClick={() => onReversePayment(payment)}><RotateCcw size={15} /> Reverse</SecondaryButton> : null}</div>)}</div></div> : null}
  </Modal>
}

DetailView.propTypes = { record: PropTypes.object.isRequired, config: PropTypes.object.isRequired, maps: PropTypes.object.isRequired, onClose: PropTypes.func.isRequired, onReversePayment: PropTypes.func }

export default function SalesPage({ kind }) {
  const config = CONFIG[kind]
  const Icon = config.icon
  const currentUser = useSelector((state) => state.user?.currentUser)
  const [rows, setRows] = useState([])
  const [options, setOptions] = useState({ customers: [], leads: [], products: [], warehouses: [], branches: [], salespeople: [], cashAccounts: [], bankAccounts: [] })
  const [lookups, setLookups] = useState({ orders: [], invoices: [] })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [detail, setDetail] = useState(null)
  const [modal, setModal] = useState(null)
  const canManage = hasPermission(currentUser, config.managePermission)
  const canApproveOrders = hasPermission(currentUser, "sales-order:approve")
  const canPostDelivery = hasPermission(currentUser, "sales-delivery:post")

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    if (params.get("createQuotationForLead") && kind === "quotations" && canManage) {
      setModal({ action: "createQuotation" })
    }
  }, [kind, canManage])
  const canPostInvoice = hasPermission(currentUser, "sales-invoice:post")
  const canManagePayment = hasPermission(currentUser, "sales-payment:manage")
  const canApproveReturn = hasPermission(currentUser, "sales-return:approve")

  const maps = useMemo(() => ({
    customers: new Map(options.customers.map((item) => [String(item._id), item])),
    products: new Map(options.products.map((item) => [String(item._id), item])),
  }), [options])

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const supportsPagination = ["quotations", "orders", "returns"].includes(kind)
      const params = new URLSearchParams({ limit: supportsPagination ? "20" : "100" })
      if (supportsPagination) params.set("page", String(page))
      if (status) params.set("status", status)
      if (query && ["quotations", "orders"].includes(kind)) params.set("search", query)
      const requests = [salesRequest(`/sales/${config.resource}?${params}`)]
      if (canManage || canManagePayment) requests.push(salesRequest("/sales/options"))
      else requests.push(Promise.resolve({ data: null }))
      if (["deliveries", "invoices"].includes(kind)) requests.push(salesRequest("/sales/orders?limit=100"))
      else requests.push(Promise.resolve({ data: [] }))
      if (kind === "returns") requests.push(salesRequest("/sales/invoices?limit=100"))
      else requests.push(Promise.resolve({ data: [] }))
      const [listPayload, optionPayload, orderPayload, invoicePayload] = await Promise.all(requests)
      setRows(Array.isArray(listPayload.data) ? listPayload.data : [])
      setPagination(listPayload.pagination || { page, pages: 1, total: (listPayload.data || []).length })
      if (optionPayload?.data && !Array.isArray(optionPayload.data)) setOptions(optionPayload.data)
      setLookups({ orders: orderPayload.data || [], invoices: invoicePayload.data || [] })
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [canManage, canManagePayment, config.resource, kind, page, query, status])

  useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer) }, [load])
  useEffect(() => { setPage(1) }, [kind, query, status])

  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return rows
    return rows.filter((row) => [row[config.number], row.status, customerName(row, maps)].some((value) => String(value || "").toLowerCase().includes(normalized)))
  }, [config.number, maps, query, rows])

  const openDetail = async (row) => {
    try {
      const payload = await salesRequest(`/sales/${config.resource}/${row._id}`)
      setDetail(payload.data)
    } catch (requestError) { toast.error(requestError.message) }
  }

  const mutate = async (path, body = {}, extra = {}) => {
    setBusy(true)
    try {
      const payload = await salesRequest(path, { ...salesJson("POST", body), ...extra, headers: { ...salesJson("POST", body).headers, ...extra.headers } })
      toast.success(payload.message || "Sales document updated successfully.")
      setModal(null)
      setDetail(null)
      await load()
      return payload
    } catch (requestError) {
      toast.error(requestError.message)
      return null
    } finally { setBusy(false) }
  }

  const create = async (body) => mutate(`/sales/${config.resource}`, body)
  const update = async (path, body) => {
    setBusy(true)
    try {
      const payload = await salesRequest(path, salesJson("PATCH", body))
      toast.success("Sales document updated successfully.")
      setModal(null)
      setDetail(null)
      await load()
      return payload
    } catch (requestError) {
      toast.error(requestError.message)
      return null
    } finally { setBusy(false) }
  }

  const downloadPdf = async (record) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/sales/invoices/${record._id}/pdf`, { credentials: "include", headers: salesHeaders() })
      if (!response.ok) { const payload = await response.json().catch(() => ({})); throw new Error(payload.message || "Invoice PDF could not be downloaded.") }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `${record.invoiceNumber}.pdf`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (requestError) { toast.error(requestError.message) }
  }

  const executeModal = async (form) => {
    const { action, record, payment } = modal
    if (action === "createQuotation") return create(form)
    if (action === "editQuotation") return update(`/sales/quotations/${record._id}`, form)
    if (action === "editOrder") return update(`/sales/orders/${record._id}`, form)
    if (action === "createDelivery") return create({ salesOrderId: form.salesOrderId, warehouseId: form.warehouseId })
    if (action === "createInvoice") return create({ salesOrderId: form.salesOrderId, dueDate: form.dueDate || undefined, paymentTermsDays: form.paymentTermsDays })
    if (action === "createReturn") return create(form)
    if (action === "quotationStatus") return mutate(`/sales/quotations/${record._id}/status`, { status: form.status })
    if (action === "convert") return mutate(`/sales/quotations/${record._id}/convert-to-order`, { warehouseId: form.warehouseId })
    if (action === "submit") return mutate(`/sales/${config.resource}/${record._id}/submit`)
    if (action === "approve") return mutate(`/sales/${config.resource}/${record._id}/approve`)
    if (action === "reject") return mutate(`/sales/${config.resource}/${record._id}/reject`, { reason: form.reason })
    if (action === "confirmOrder") return mutate(`/sales/orders/${record._id}/confirm`)
    if (action === "cancel") return mutate(`/sales/${config.resource}/${record._id}/cancel`, { reason: form.reason })
    if (action === "close") return mutate(`/sales/orders/${record._id}/close`)
    if (action === "deliveryStatus") return mutate(`/sales/deliveries/${record._id}/status`, { status: modal.nextStatus })
    if (action === "confirmDelivery") return mutate(`/sales/deliveries/${record._id}/confirm-delivery`)
    if (action === "postInvoice") return mutate(`/sales/invoices/${record._id}/post`)
    if (action === "sendInvoice") return mutate(`/sales/invoices/${record._id}/send`)
    if (action === "payment") return mutate(`/sales/invoices/${record._id}/payments`, { amount: Number(form.amount), method: form.treasuryType === "cash" ? "cash" : "bank_transfer", reference: form.reference, treasuryType: form.treasuryType, treasuryAccount: form.treasuryAccount }, { headers: { "Idempotency-Key": makeIdempotencyKey("customer-payment") } })
    if (action === "reversePayment") return mutate(`/sales/invoices/${record._id}/payments/${payment._id}/reverse`, { reason: form.reason })
    if (action === "void") return mutate(`/sales/invoices/${record._id}/void`, { reason: form.reason })
    if (action === "refund") return mutate(`/sales/returns/${record._id}/refund`, { amount: Number(form.amount), reference: form.reference, treasuryType: form.treasuryType, treasuryAccount: form.treasuryAccount })
  }

  const actionsFor = (record) => {
    const actions = []
    if (kind === "quotations" && canManage && ["draft", "sent", "under_negotiation"].includes(record.status)) actions.push(["Edit quotation", FileText, () => setModal({ action: "editQuotation", record })])
    if (kind === "quotations" && canManage && ["draft", "sent", "viewed", "under_negotiation"].includes(record.status)) actions.push(["Update status", Send, () => setModal({ action: "quotationStatus", record })])
    if (kind === "quotations" && record.status === "accepted" && !record.leadId && hasPermission(currentUser, "sales-order:manage")) actions.push(["Convert to order", ArrowRight, () => setModal({ action: "convert", record })])
    if (kind === "orders" && canManage && ["draft", "pending_approval"].includes(record.status)) actions.push(["Edit order", FileText, () => setModal({ action: "editOrder", record })])
    if (kind === "orders" && canManage && record.status === "draft") actions.push(["Submit", Send, () => setModal({ action: "submit", record })])
    if (kind === "orders" && canApproveOrders && record.status === "pending_approval") actions.push(["Approve", CheckCircle2, () => setModal({ action: "approve", record })], ["Reject", XCircle, () => setModal({ action: "reject", record })])
    if (kind === "orders" && canApproveOrders && record.status === "approved") actions.push(["Confirm & reserve", PackageCheck, () => setModal({ action: "confirmOrder", record })])
    if (kind === "orders" && canApproveOrders && record.status === "fulfilled") actions.push(["Close", CheckCircle2, () => setModal({ action: "close", record })])
    if (kind === "orders" && canManage && ["draft", "pending_approval", "approved", "confirmed"].includes(record.status)) actions.push(["Cancel", XCircle, () => setModal({ action: "cancel", record })])
    const deliveryTransitions = { draft: "picking", picking: "picked", picked: "packing", packing: "packed", packed: "ready_for_dispatch", ready_for_dispatch: "dispatched", dispatched: "in_transit", in_transit: "delivered", failed: "ready_for_dispatch" }
    if (kind === "deliveries" && canManage && deliveryTransitions[record.status]) actions.push([`Move to ${pretty(deliveryTransitions[record.status])}`, ChevronRight, () => setModal({ action: "deliveryStatus", record, nextStatus: deliveryTransitions[record.status] })])
    if (kind === "deliveries" && canPostDelivery && ["dispatched", "in_transit"].includes(record.status)) actions.push(["Confirm delivery", PackageCheck, () => setModal({ action: "confirmDelivery", record })])
    if (kind === "invoices" && canPostInvoice && record.status === "draft") actions.push(["Post invoice", CheckCircle2, () => setModal({ action: "postInvoice", record })])
    if (kind === "invoices" && canManage && ["posted", "sent", "partially_paid"].includes(record.status)) actions.push(["Mark sent", Send, () => setModal({ action: "sendInvoice", record })])
    if (kind === "invoices" && canManagePayment && Number(record.dueAmount || 0) > 0 && !["draft", "void", "cancelled"].includes(record.status)) actions.push(["Receive payment", Banknote, () => setModal({ action: "payment", record })])
    if (kind === "invoices") actions.push(["Download PDF", Download, () => downloadPdf(record)])
    if (kind === "invoices" && canPostInvoice && ["posted", "sent"].includes(record.status) && !record.paidAmount && !record.creditedAmount) actions.push(["Void", XCircle, () => setModal({ action: "void", record })])
    if (kind === "returns" && canManage && record.status === "draft") actions.push(["Submit", Send, () => setModal({ action: "submit", record })])
    if (kind === "returns" && canApproveReturn && record.status === "pending_approval") actions.push(["Approve & post", CheckCircle2, () => setModal({ action: "approve", record })], ["Reject", XCircle, () => setModal({ action: "reject", record })])
    if (kind === "returns" && canManage && ["draft", "pending_approval"].includes(record.status)) actions.push(["Cancel", XCircle, () => setModal({ action: "cancel", record })])
    if (kind === "returns" && canManagePayment && record.status === "posted" && Number(record.refundDue || 0) > Number(record.refundedAmount || 0)) actions.push(["Refund customer", RotateCcw, () => setModal({ action: "refund", record })])
    return actions
  }

  const createAction = kind === "quotations" ? "createQuotation" : kind === "deliveries" ? "createDelivery" : kind === "invoices" ? "createInvoice" : kind === "returns" ? "createReturn" : ""

  return <div className="min-h-full bg-[#f7f8fc] p-1 md:p-3">
    <Toaster position="top-right" />
    <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_22px_60px_-40px_rgba(15,23,42,.35)]">
      <div className="relative overflow-hidden border-b border-slate-100 px-6 py-7 md:px-8">
        <div className="absolute right-0 top-0 h-40 w-72 bg-gradient-to-bl from-indigo-100/70 via-violet-50/30 to-transparent" />
        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="flex items-start gap-4"><div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200"><Icon size={24} /></div><div><p className="text-xs font-black uppercase tracking-[.2em] text-indigo-600">Sales operations</p><h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">{config.title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{config.description}</p></div></div>
          {createAction && canManage ? <PrimaryButton onClick={() => setModal({ action: createAction })}><Plus size={18} /> New {kind === "quotations" ? "quotation" : kind === "deliveries" ? "delivery" : kind === "invoices" ? "invoice" : "return"}</PrimaryButton> : null}
        </div>
      </div>
      <div className="flex flex-col gap-3 border-b border-slate-100 p-5 md:flex-row md:items-center">
        <div className="relative flex-1"><Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input className={`${inputClass} pl-10`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${config.title.toLowerCase()}…`} /></div>
        <select className={`${inputClass} md:w-52`} value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{config.statuses.map((item) => <option key={item} value={item}>{pretty(item)}</option>)}</select>
        <SecondaryButton onClick={load}><RefreshCcw size={16} /> Refresh</SecondaryButton>
      </div>
      {error ? <div className="m-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50/80 text-[11px] font-black uppercase tracking-[.14em] text-slate-500"><tr><th className="px-6 py-4">Document</th><th className="px-6 py-4">Customer</th><th className="px-6 py-4">Date</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-right">Amount</th><th className="px-6 py-4 text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? Array.from({ length: 5 }).map((_, index) => <tr key={index}>{Array.from({ length: 6 }).map((__, cell) => <td key={cell} className="px-6 py-5"><div className="h-4 animate-pulse rounded bg-slate-100" /></td>)}</tr>) : visibleRows.length ? visibleRows.map((row) => <tr key={row._id} className="transition hover:bg-indigo-50/30">
              <td className="px-6 py-4"><button type="button" onClick={() => openDetail(row)} className="font-black text-slate-900 hover:text-indigo-700">{row[config.number] || "—"}</button><p className="mt-1 text-xs text-slate-400">{row.currency || "BDT"}</p></td>
              <td className="px-6 py-4 font-semibold text-slate-700">{customerName(row, maps)}</td>
              <td className="px-6 py-4 text-slate-500">{formatDate(row[config.date] || row.createdAt)}</td>
              <td className="px-6 py-4"><StatusBadge value={row.status} /></td>
              <td className="px-6 py-4 text-right font-black text-slate-900">{formatMoney(row.totals?.grandTotal ?? row.totalAmount ?? 0, row.currency)}</td>
              <td className="px-6 py-4"><div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => openDetail(row)} className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-white hover:text-indigo-700" title="View"><Eye size={16} /></button>{actionsFor(row).map(([label, ActionIcon, handler]) => <button type="button" key={label} onClick={handler} title={label} aria-label={label} className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"><ActionIcon size={16} /></button>)}</div></td>
            </tr>) : <tr><td colSpan="6" className="px-6 py-20 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Icon size={24} /></div><p className="mt-4 font-black text-slate-800">No {kind} found</p><p className="mt-1 text-sm text-slate-500">Create the first document or adjust your filters.</p></td></tr>}
          </tbody>
        </table>
      </div>
      {pagination.pages > 1 ? <div className="flex items-center justify-between gap-4 border-t border-slate-100 px-5 py-4"><p className="text-sm font-semibold text-slate-500">Page {pagination.page} of {pagination.pages} · {pagination.total} records</p><div className="flex gap-2"><SecondaryButton disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(current - 1, 1))}>Previous</SecondaryButton><SecondaryButton disabled={page >= pagination.pages || loading} onClick={() => setPage((current) => current + 1)}>Next</SecondaryButton></div></div> : null}
    </section>

    {detail ? <DetailView record={detail} config={config} maps={maps} onClose={() => setDetail(null)} onReversePayment={kind === "invoices" && canManagePayment ? (payment) => { setDetail(null); setModal({ action: "reversePayment", record: detail, payment }) } : undefined} /> : null}
    {modal ? <Modal title={pretty(modal.action)} subtitle={modal.record?.[config.number]} onClose={() => setModal(null)} wide={["createQuotation", "createReturn"].includes(modal.action)}>
      {["createQuotation", "editQuotation"].includes(modal.action) ? <QuotationForm options={options} record={modal.record} busy={busy} onSubmit={executeModal} onCancel={() => setModal(null)} /> : modal.action === "editOrder" ? <OrderEditForm record={modal.record} busy={busy} onSubmit={executeModal} onCancel={() => setModal(null)} /> : modal.action === "createReturn" ? <ReturnForm invoices={lookups.invoices} busy={busy} onSubmit={executeModal} onCancel={() => setModal(null)} /> : <SimpleActionForm action={modal.action} record={modal.record} options={options} lookups={lookups} busy={busy} onSubmit={executeModal} onCancel={() => setModal(null)} />}
    </Modal> : null}
  </div>
}

SalesPage.propTypes = { kind: PropTypes.oneOf(Object.keys(CONFIG)).isRequired }
