"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import html2pdf from "html2pdf.js"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  Download04Icon,
  FolderLibraryIcon,
  PrinterIcon,
  RefreshIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const shell = "min-h-screen bg-gradient-to-b from-gray-100 to-gray-50 p-4 sm:p-6 lg:p-8"
const card = "rounded-2xl border border-gray-200 bg-white shadow-sm"
const button =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition active:scale-[0.99] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
const primaryButton =
  "bg-indigo-600 text-white shadow-sm shadow-indigo-600/10 hover:bg-indigo-700"
const ghostButton =
  "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
const input =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-300 focus:border-transparent focus-visible:ring-2 focus-visible:ring-indigo-500/40"

function cn(...classes) {
  return classes.filter(Boolean).join(" ")
}

function pretty(value) {
  return String(value || "-")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatNumber(value, maxDigits = 2) {
  return Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: maxDigits })
}

function formatMoney(value, currency = "BDT") {
  const num = formatNumber(value, 2)
  return `${currency} ${num}`
}

function formatDate(value) {
  if (!value) return "-"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "-"
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

function Icon({ icon, className = "h-4 w-4", ...props }) {
  return <HugeiconsIcon icon={icon} className={className} strokeWidth={1.8} {...props} />
}

function Spinner({ className = "h-4 w-4" }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full border-2 border-current border-r-transparent animate-spin",
        className
      )}
      aria-hidden="true"
    />
  )
}

async function api(path) {
  const token = localStorage.getItem("token")
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.message || data?.error || "Request failed")
  return data
}

export default function PurchaseOrderPrint({ initialOrderId = null, embedded = false, onClose = null }) {
  const [orders, setOrders] = useState([])
  const [selectedId, setSelectedId] = useState(initialOrderId || "")
  const [order, setOrder] = useState(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingOrder, setLoadingOrder] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")

  const printRef = useRef(null)

  // 1. Fetch available purchase orders
  const loadOrdersList = useCallback(async () => {
    setLoadingList(true)
    setError("")
    try {
      const res = await api("/purchase/purchase-orders?limit=100")
      const list = Array.isArray(res?.purchaseOrders) ? res.purchaseOrders : Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : []
      setOrders(list)
      if (!selectedId && list.length > 0) {
        setSelectedId(list[0]._id)
      }
    } catch (e) {
      setError(e.message || "Failed to load purchase orders.")
    } finally {
      setLoadingList(false)
    }
  }, [selectedId])

  useEffect(() => {
    loadOrdersList()
  }, [loadOrdersList])

  // 2. Fetch full purchase order details when selectedId changes
  useEffect(() => {
    if (!selectedId) return
    setLoadingOrder(true)
    setError("")
    api(`/purchase/purchase-orders/${selectedId}`)
      .then((data) => {
        setOrder(data?.purchaseOrder || data?.item || data)
      })
      .catch((e) => {
        setError(e.message || "Failed to load order details.")
      })
      .finally(() => setLoadingOrder(false))
  }, [selectedId])

  // Browser Print
  const handlePrint = () => {
    window.print()
  }

  // HTML2PDF Download
  const handleDownloadPdf = async () => {
    if (!printRef.current || !order) return
    setGeneratingPdf(true)
    try {
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `${order.orderNo || "purchase-order"}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      }
      await html2pdf().set(opt).from(printRef.current).save()
      toast.success("Purchase order PDF downloaded.")
    } catch (err) {
      toast.error(err.message || "Failed to generate PDF. You can also use Browser Print to Save as PDF.")
    } finally {
      setGeneratingPdf(false)
    }
  }

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return orders
    return orders.filter((o) =>
      [o.orderNo, o.supplier?.businessName, o.supplier?.name, o.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    )
  }, [orders, search])

  const currency = order?.currency || "BDT"
  const lines = Array.isArray(order?.lines) ? order.lines : []

  return (
    <div className={embedded ? "p-0" : shell}>
      <Toaster position="top-right" />

      {/* Embedded Print CSS Rules */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 15mm;
          }
          body {
            background: white !important;
            color: black !important;
            font-size: 11pt !important;
          }
          .no-print, [data-no-print] {
            display: none !important;
          }
          #po-print-sheet {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
          }
        }
      `}</style>

      {/* Top Action & Selector Bar (Screen Only) */}
      <div className="no-print mb-6 space-y-4">
        <div className={cn(card, "p-4 sm:p-5")}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
                <Icon icon={FolderLibraryIcon} className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-gray-900">
                  Purchase Order Print / PDF
                </h1>
                <p className="text-xs sm:text-sm font-semibold text-gray-500">
                  Preview, browser print or export high-resolution Purchase Order documents.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onClose ? (
                <button type="button" className={cn(button, ghostButton)} onClick={onClose}>
                  Close
                </button>
              ) : null}
              <button
                type="button"
                className={cn(button, ghostButton)}
                onClick={handlePrint}
                disabled={!order || loadingOrder}
              >
                <Icon icon={PrinterIcon} className="h-4 w-4 text-indigo-600" />
                Print Order
              </button>
              <button
                type="button"
                className={cn(button, primaryButton)}
                onClick={handleDownloadPdf}
                disabled={!order || loadingOrder || generatingPdf}
              >
                {generatingPdf ? (
                  <>
                    <Spinner /> Generating PDF...
                  </>
                ) : (
                  <>
                    <Icon icon={Download04Icon} className="h-4 w-4" />
                    Download PDF
                  </>
                )}
              </button>
            </div>
          </div>

          {/* PO Selector Dropdown */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center gap-3">
            <div className="w-full sm:w-80">
              <label className="block text-xs font-bold text-gray-700 mb-1">Select Purchase Order</label>
              <select
                className={input}
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                disabled={loadingList}
              >
                {loadingList ? (
                  <option value="">Loading purchase orders...</option>
                ) : orders.length ? (
                  orders.map((o) => (
                    <option key={o._id} value={o._id}>
                      {o.orderNo} — {o.supplier?.businessName || o.supplier?.name || "Supplier"} ({pretty(o.status)})
                    </option>
                  ))
                ) : (
                  <option value="">No purchase orders available</option>
                )}
              </select>
            </div>

            <div className="w-full sm:flex-1 sm:max-w-xs">
              <label className="block text-xs font-bold text-gray-700 mb-1">Quick Search</label>
              <div className="relative">
                <input
                  type="text"
                  className={cn(input, "pl-9")}
                  placeholder="Filter POs by number or vendor..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Icon icon={Search01Icon} className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              </div>
            </div>

            <div className="sm:self-end">
              <button
                type="button"
                className={cn(button, ghostButton, "h-[38px] px-3")}
                onClick={loadOrdersList}
                disabled={loadingList}
                title="Refresh POs"
              >
                <Icon icon={RefreshIcon} className={cn("h-4 w-4", loadingList ? "animate-spin" : "")} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="no-print mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700 flex items-center gap-3">
          <Icon icon={Alert02Icon} className="h-5 w-5 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* Main Printable Document Sheet (A4 Proportion) */}
      <div className="flex justify-center">
        {loadingOrder ? (
          <div className="p-16 text-center font-bold text-gray-400">
            <Spinner className="h-8 w-8 mx-auto text-indigo-600 mb-3" />
            Loading purchase order details...
          </div>
        ) : order ? (
          <div
            id="po-print-sheet"
            ref={printRef}
            className="w-full max-w-[850px] bg-white border border-gray-200 shadow-xl rounded-2xl p-8 sm:p-12 text-gray-900 font-sans"
            style={{ minHeight: "1050px" }}
          >
            {/* 1. Header Section */}
            <div className="flex justify-between items-start pb-6 border-b-2 border-gray-900">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-950 uppercase">
                  BH Development Unit
                </h1>
                <p className="text-xs font-semibold text-gray-500 mt-1">Enterprise Procurement & Supply Chain</p>
                <div className="mt-3 text-xs text-gray-600 space-y-0.5 font-medium leading-relaxed">
                  <p>Plot #12, Road #4, Industrial Area</p>
                  <p>Dhaka, Bangladesh</p>
                  <p>Email: procurement@bh-development.com · Tel: +880 2 9876543</p>
                  <p>BIN / VAT Reg No: 001928374-0101</p>
                </div>
              </div>

              <div className="text-right">
                <span className="inline-block bg-gray-900 text-white text-xs font-black uppercase tracking-widest px-3 py-1 rounded">
                  Purchase Order
                </span>
                <p className="mt-3 text-xl sm:text-2xl font-mono font-black text-gray-950">
                  {order.orderNo || "PO-DRAFT"}
                </p>
                <div className="mt-3 text-xs text-gray-600 space-y-1 font-medium">
                  <p>Order Date: <strong className="text-gray-900">{formatDate(order.orderDate)}</strong></p>
                  <p>Delivery Due: <strong className="text-gray-900">{formatDate(order.expectedDeliveryDate)}</strong></p>
                  <p>Trade Type: <strong className="text-gray-900 uppercase">{pretty(order.tradeType || "local")}</strong></p>
                  {order.tradeType === "import" && order.incoterm ? (
                    <p>Incoterm: <strong className="text-gray-900 uppercase">{order.incoterm}</strong></p>
                  ) : null}
                  <p>Status: <strong className="uppercase text-indigo-700">{pretty(order.status)}</strong></p>
                </div>
              </div>
            </div>

            {/* 2. Vendor & Ship-To Addresses */}
            <div className="grid grid-cols-2 gap-8 py-6 border-b border-gray-200 text-xs">
              <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Vendor / Supplier</p>
                <p className="mt-1 text-sm font-black text-gray-950">
                  {order.supplier?.businessName || order.supplier?.name || "Unknown Supplier"}
                </p>
                <div className="mt-2 text-gray-600 space-y-0.5 font-medium">
                  <p>{order.supplier?.primaryAddress?.street || "Registered Office Address"}</p>
                  <p>{[order.supplier?.primaryAddress?.city, order.supplier?.primaryAddress?.country || order.supplier?.country].filter(Boolean).join(", ")}</p>
                  <p>Contact: {order.supplier?.contacts?.[0]?.name || "Purchasing Agent"}</p>
                  <p>Phone: {order.supplier?.contacts?.[0]?.phone || order.supplier?.contacts?.[0]?.mobile || "-"}</p>
                  <p>Email: {order.supplier?.contacts?.[0]?.email || "-"}</p>
                  {order.supplier?.taxNumber ? <p>Tax ID / BIN: {order.supplier.taxNumber}</p> : null}
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Shipping & Delivery Destination</p>
                <p className="mt-1 text-sm font-black text-gray-950">
                  {order.warehouse?.name || "Central Warehouse"}
                </p>
                <div className="mt-2 text-gray-600 space-y-0.5 font-medium">
                  <p>{order.warehouse?.address?.street || "Central Receiving Dock, Gate 2"}</p>
                  <p>{[order.warehouse?.address?.city, order.warehouse?.address?.country].filter(Boolean).join(", ") || "Dhaka, Bangladesh"}</p>
                  <p>Payment Terms: <strong className="text-gray-900">{pretty(order.paymentTerms || "Net 30")}</strong></p>
                  <p>Currency: <strong className="text-gray-900">{currency}</strong></p>
                </div>
              </div>
            </div>

            {/* 3. Line Items Table */}
            <div className="py-6">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b-2 border-gray-900 text-[10px] font-black uppercase tracking-wider text-gray-600">
                    <th className="py-2.5 px-2 w-8">#</th>
                    <th className="py-2.5 px-2">Item Description & SKU</th>
                    <th className="py-2.5 px-2 text-center w-16">Unit</th>
                    <th className="py-2.5 px-2 text-right w-20">Qty</th>
                    <th className="py-2.5 px-2 text-right w-24">Unit Price</th>
                    <th className="py-2.5 px-2 text-right w-20">Discount</th>
                    <th className="py-2.5 px-2 text-right w-20">Tax</th>
                    <th className="py-2.5 px-2 text-right w-28">Total ({currency})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {lines.length ? (
                    lines.map((line, idx) => (
                      <tr key={line._id || idx} className="hover:bg-gray-50/50">
                        <td className="py-3 px-2 text-gray-500 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-3 px-2">
                          <p className="font-bold text-gray-950">{line.product?.name || line.productName || "Product"}</p>
                          <p className="text-[10px] text-gray-500 font-mono">{line.product?.sku || line.sku || "SKU-N/A"}</p>
                        </td>
                        <td className="py-3 px-2 text-center text-gray-600">{line.purchaseUnit || "PCS"}</td>
                        <td className="py-3 px-2 text-right font-bold text-gray-900">{formatNumber(line.orderedQuantity)}</td>
                        <td className="py-3 px-2 text-right font-medium text-gray-800">{formatNumber(line.unitPrice)}</td>
                        <td className="py-3 px-2 text-right text-gray-600">
                          {line.discountAmount ? formatNumber(line.discountAmount) : "-"}
                        </td>
                        <td className="py-3 px-2 text-right text-gray-600">
                          {line.taxAmount ? formatNumber(line.taxAmount) : "-"}
                        </td>
                        <td className="py-3 px-2 text-right font-black text-gray-950">{formatNumber(line.lineTotal)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-gray-400 font-semibold">
                        No purchase line items recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 4. Financial Summary & Notes */}
            <div className="grid grid-cols-2 gap-8 py-4 border-t-2 border-gray-900 text-xs">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Terms & Instructions</p>
                <div className="mt-2 text-gray-600 space-y-1.5 leading-relaxed font-medium">
                  <p>1. Please reference the PO Number on all invoices, bills of lading and packages.</p>
                  <p>2. Goods are subject to quality inspection upon arrival at the destination warehouse.</p>
                  <p>3. Submit commercial invoice and proof of delivery to finance@bh-development.com.</p>
                  {order.notes ? <p className="mt-2 font-semibold text-gray-800">Special Notes: {order.notes}</p> : null}
                </div>
              </div>

              <div>
                <div className="space-y-2 text-right">
                  <div className="flex justify-between py-1 border-b border-gray-100 text-gray-600 font-semibold">
                    <span>Subtotal:</span>
                    <span className="font-mono text-gray-900">{formatMoney(order.subtotal, currency)}</span>
                  </div>
                  {Number(order.discountTotal || 0) > 0 ? (
                    <div className="flex justify-between py-1 border-b border-gray-100 text-emerald-700 font-semibold">
                      <span>Total Discount:</span>
                      <span className="font-mono">-{formatMoney(order.discountTotal, currency)}</span>
                    </div>
                  ) : null}
                  {Number(order.taxTotal || 0) > 0 ? (
                    <div className="flex justify-between py-1 border-b border-gray-100 text-gray-600 font-semibold">
                      <span>Total VAT / Tax:</span>
                      <span className="font-mono text-gray-900">+{formatMoney(order.taxTotal, currency)}</span>
                    </div>
                  ) : null}
                  {Number(order.shippingCost || 0) > 0 ? (
                    <div className="flex justify-between py-1 border-b border-gray-100 text-gray-600 font-semibold">
                      <span>Shipping / Freight:</span>
                      <span className="font-mono text-gray-900">+{formatMoney(order.shippingCost, currency)}</span>
                    </div>
                  ) : null}
                  {Number(order.otherCost || 0) > 0 ? (
                    <div className="flex justify-between py-1 border-b border-gray-100 text-gray-600 font-semibold">
                      <span>Other Charges:</span>
                      <span className="font-mono text-gray-900">+{formatMoney(order.otherCost, currency)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between py-2 border-t-2 border-gray-900 text-base font-black text-gray-950">
                    <span>Grand Total:</span>
                    <span className="font-mono">{formatMoney(order.grandTotal, currency)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-xs font-bold text-gray-500">
                    <span>Paid Amount:</span>
                    <span className="font-mono text-emerald-700">{formatMoney(order.paidAmount || 0, currency)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-xs font-bold text-gray-500">
                    <span>Outstanding Due:</span>
                    <span className="font-mono text-rose-700">{formatMoney(order.dueAmount || order.grandTotal, currency)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Signatures Block */}
            <div className="mt-14 pt-8 border-t border-gray-200 grid grid-cols-3 gap-6 text-center text-xs font-semibold text-gray-600">
              <div>
                <div className="h-12 border-b border-gray-400 mb-2 flex items-end justify-center pb-1 text-[11px] text-gray-500 font-medium">
                  {order.createdBy?.name || "Procurement Officer"}
                </div>
                <p className="font-bold text-gray-900">Prepared By</p>
                <p className="text-[10px] text-gray-400">Date: {formatDate(order.createdAt)}</p>
              </div>

              <div>
                <div className="h-12 border-b border-gray-400 mb-2 flex items-end justify-center pb-1 text-[11px] text-gray-500 font-medium">
                  {order.approvedBy?.name || (order.status === "approved" ? "Authorized Signatory" : "")}
                </div>
                <p className="font-bold text-gray-900">Authorized Approval</p>
                <p className="text-[10px] text-gray-400">Date: {formatDate(order.approvedAt || order.orderDate)}</p>
              </div>

              <div>
                <div className="h-12 border-b border-gray-400 mb-2 flex items-end justify-center pb-1 text-[11px] text-gray-400 italic">
                  Signature & Seal
                </div>
                <p className="font-bold text-gray-900">Vendor Acceptance</p>
                <p className="text-[10px] text-gray-400">Authorized Signature</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-16 text-center text-gray-400 font-semibold">
            Select a purchase order above to view document preview.
          </div>
        )}
      </div>
    </div>
  )
}
