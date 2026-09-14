"use client"
/* eslint-disable react/prop-types */

import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  FiAlertCircle,
  FiBriefcase,
  FiCheckCircle,
  FiCreditCard,
  FiDollarSign,
  FiExternalLink,
  FiFileText,
  FiLoader,
  FiRefreshCw,
  FiShoppingCart,
  FiTruck,
  FiUserCheck,
} from "react-icons/fi"
import { getModuleBasePath } from "../../Navigation/moduleConfig"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

function getAuthHeaders() {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function formatMoney(amount = 0, currency = "BDT") {
  const num = Number(amount || 0)
  return `${currency} ${num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatDate(date) {
  if (!date) return "—"
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

const statusBadgeStyles = {
  draft: "bg-gray-100 text-gray-700 border-gray-200",
  sent: "bg-sky-50 text-sky-700 border-sky-200",
  accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
  expired: "bg-amber-50 text-amber-800 border-amber-200",
  won: "bg-emerald-50 text-emerald-700 border-emerald-200",
  lost: "bg-rose-50 text-rose-700 border-rose-200",
  negotiation: "bg-indigo-50 text-indigo-700 border-indigo-200",
  proposal: "bg-purple-50 text-purple-700 border-purple-200",
  confirmed: "bg-indigo-50 text-indigo-700 border-indigo-200",
  delivered: "bg-teal-50 text-teal-700 border-teal-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  posted: "bg-indigo-50 text-indigo-700 border-indigo-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  partially_paid: "bg-amber-50 text-amber-800 border-amber-200",
  overdue: "bg-rose-50 text-rose-700 border-rose-200",
}

function StatusBadge({ status }) {
  const key = String(status || "").toLowerCase()
  const cls = statusBadgeStyles[key] || "bg-gray-50 text-gray-700 border-gray-200"
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${cls}`}>
      {String(status || "—").replace(/_/g, " ")}
    </span>
  )
}

function MetricCard({ label, value, subValue, icon, tone = "indigo" }) {
  const tones = {
    indigo: "border-indigo-100 bg-indigo-50/40 text-indigo-700",
    emerald: "border-emerald-100 bg-emerald-50/40 text-emerald-700",
    amber: "border-amber-100 bg-amber-50/40 text-amber-700",
    rose: "border-rose-100 bg-rose-50/40 text-rose-700",
    sky: "border-sky-100 bg-sky-50/40 text-sky-700",
  }
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${tones[tone] || tones.indigo}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">{label}</span>
        <div className="text-xl">{icon}</div>
      </div>
      <div className="mt-2 text-xl font-black text-gray-900">{value}</div>
      {subValue ? <div className="mt-0.5 text-xs font-semibold text-gray-500">{subValue}</div> : null}
    </div>
  )
}

export default function CustomerCommercialHistory({ customerId }) {
  const navigate = useNavigate()
  const directRole = typeof window !== "undefined" ? localStorage.getItem("role") : null
  const role = directRole ? String(directRole).toLowerCase() : "admin"

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [activeSubTab, setActiveSubTab] = useState("orders")

  const loadHistory = async () => {
    if (!customerId) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`${API_BASE}/customers/${customerId}/commercial-history`, {
        headers: getAuthHeaders(),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.message || `Error ${res.status}: Failed to load commercial history`)
      }
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [customerId])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-3xl border border-gray-100 bg-white shadow-sm">
        <FiLoader className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50/70 p-6 text-sm font-semibold text-rose-700">
        <div className="flex items-center gap-2">
          <FiAlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
        <button
          onClick={loadHistory}
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-3.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50"
        >
          <FiRefreshCw /> Retry
        </button>
      </div>
    )
  }

  const {
    originatingLead,
    deals = [],
    quotations = [],
    orders = [],
    deliveries = [],
    invoices = [],
    summary = {},
  } = data || {}

  return (
    <div className="space-y-6">
      {/* Credit Hold Banner */}
      {summary.creditHold ? (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-rose-800 shadow-sm">
          <FiAlertCircle className="h-6 w-6 shrink-0 text-rose-600" />
          <div>
            <h4 className="font-black text-rose-900">Customer on Credit Hold</h4>
            <p className="text-xs font-semibold text-rose-700">
              New sales order confirmation and fulfillment are restricted until outstanding receivables are resolved.
            </p>
          </div>
        </div>
      ) : null}

      {/* Commercial Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard
          label="Total Orders"
          value={summary.totalOrders || 0}
          subValue={formatMoney(summary.totalOrderValue)}
          icon={<FiShoppingCart />}
          tone="indigo"
        />
        <MetricCard
          label="Total Invoices"
          value={summary.totalInvoices || 0}
          subValue={formatMoney(summary.totalInvoiced)}
          icon={<FiFileText />}
          tone="sky"
        />
        <MetricCard
          label="Total Paid"
          value={formatMoney(summary.totalPaid)}
          subValue="Collected"
          icon={<FiCheckCircle />}
          tone="emerald"
        />
        <MetricCard
          label="AR Outstanding"
          value={formatMoney(summary.totalDue)}
          subValue="Due from customer"
          icon={<FiDollarSign />}
          tone={summary.totalDue > 0 ? "rose" : "emerald"}
        />
        <MetricCard
          label="Credit Limit"
          value={formatMoney(summary.creditLimit)}
          subValue="Approved ceiling"
          icon={<FiCreditCard />}
          tone="indigo"
        />
        <MetricCard
          label="Available Credit"
          value={formatMoney(summary.availableCredit)}
          subValue={summary.availableCredit <= 0 ? "Credit limit reached" : "Healthy margin"}
          icon={<FiCheckCircle />}
          tone={summary.availableCredit <= 0 ? "rose" : "emerald"}
        />
      </div>

      {/* Originating Lead Information */}
      <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2 font-black text-gray-900">
            <FiUserCheck className="text-indigo-600" />
            <span>Originating CRM Lead Lineage</span>
          </div>
          {originatingLead ? (
            <button
              type="button"
              onClick={() => navigate(`/${role}/crm/leads`)}
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700"
            >
              View in CRM <FiExternalLink />
            </button>
          ) : null}
        </div>
        {originatingLead ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <span className="text-xs font-semibold text-gray-400">Lead Number</span>
              <div className="mt-0.5 font-black text-gray-900">{originatingLead.leadNumber || "—"}</div>
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-400">Primary Contact</span>
              <div className="mt-0.5 font-bold text-gray-900">{originatingLead.contact?.name || "—"}</div>
              <div className="text-xs text-gray-500">{originatingLead.contact?.phone || ""}</div>
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-400">Pipeline Stage</span>
              <div className="mt-0.5">
                <StatusBadge status={originatingLead.pipelineStage} />
              </div>
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-400">CRM Status</span>
              <div className="mt-0.5">
                <StatusBadge status={originatingLead.status} />
              </div>
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-400">Lead Created</span>
              <div className="mt-0.5 text-sm font-semibold text-gray-700">
                {formatDate(originatingLead.createdAt)}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3 text-sm font-semibold text-gray-500">
            Direct customer creation — no originating lead recorded.
          </div>
        )}
      </div>

      {/* Commercial Documents Section */}
      <div className="rounded-3xl border border-gray-100 bg-white shadow-sm">
        {/* Navigation tabs */}
        <div className="flex border-b border-gray-100 p-2">
          {[
            { key: "orders", label: `Sales Orders (${orders.length})`, icon: <FiShoppingCart /> },
            { key: "invoices", label: `Sales Invoices (${invoices.length})`, icon: <FiFileText /> },
            { key: "quotations", label: `Quotations (${quotations.length})`, icon: <FiFileText /> },
            { key: "deals", label: `Won Deals (${deals.length})`, icon: <FiBriefcase /> },
            { key: "deliveries", label: `Deliveries (${deliveries.length})`, icon: <FiTruck /> },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveSubTab(t.key)}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black transition-all ${
                activeSubTab === t.key
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Tab contents */}
        <div className="overflow-x-auto p-4">
          {activeSubTab === "orders" && (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/50 text-xs font-black uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Order Number</th>
                  <th className="px-4 py-3">Order Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Grand Total</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.length ? (
                  orders.map((order) => (
                    <tr key={order._id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3 font-black text-gray-900">{order.orderNumber}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(order.orderDate)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-black text-gray-900">
                        {formatMoney(order.totals?.grandTotal, order.currency)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => navigate(`${getModuleBasePath(role, "sales")}/sales-orders?search=${encodeURIComponent(order.orderNumber)}`)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700"
                        >
                          View <FiExternalLink />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm font-semibold text-gray-400">
                      No sales orders found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {activeSubTab === "invoices" && (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/50 text-xs font-black uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Invoice Number</th>
                  <th className="px-4 py-3">Invoice Date</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Due</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.length ? (
                  invoices.map((inv) => (
                    <tr key={inv._id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3 font-black text-gray-900">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(inv.invoiceDate)}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(inv.dueDate)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-black text-gray-900">
                        {formatMoney(inv.totals?.grandTotal, inv.currency)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">
                        {formatMoney(inv.paidAmount, inv.currency)}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-rose-600">
                        {formatMoney(inv.dueAmount, inv.currency)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => navigate(`${getModuleBasePath(role, "sales")}/invoices?search=${encodeURIComponent(inv.invoiceNumber)}`)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700"
                        >
                          View <FiExternalLink />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-sm font-semibold text-gray-400">
                      No sales invoices found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {activeSubTab === "quotations" && (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/50 text-xs font-black uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Quotation Number</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Valid Until</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {quotations.length ? (
                  quotations.map((q) => (
                    <tr key={q._id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3 font-black text-gray-900">{q.quotationNumber}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(q.quotationDate)}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(q.validUntil)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={q.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-black text-gray-900">
                        {formatMoney(q.totals?.grandTotal, q.currency)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => navigate(`${getModuleBasePath(role, "sales")}/quotations?search=${encodeURIComponent(q.quotationNumber)}`)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700"
                        >
                          View <FiExternalLink />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm font-semibold text-gray-400">
                      No quotations found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {activeSubTab === "deals" && (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/50 text-xs font-black uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Deal Number</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Close Date</th>
                  <th className="px-4 py-3 text-right">Value</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {deals.length ? (
                  deals.map((deal) => (
                    <tr key={deal._id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3 font-black text-gray-900">{deal.dealNo || "—"}</td>
                      <td className="px-4 py-3 font-bold text-gray-800">{deal.title}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={deal.stage} />
                      </td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(deal.expectedCloseDate)}</td>
                      <td className="px-4 py-3 text-right font-black text-gray-900">
                        {formatMoney(deal.grandTotal, deal.currency)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => navigate(`/${role}/crm/deals?search=${encodeURIComponent(deal.dealNo || deal.title)}`)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700"
                        >
                          View <FiExternalLink />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm font-semibold text-gray-400">
                      No deals found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {activeSubTab === "deliveries" && (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/50 text-xs font-black uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Delivery Note #</th>
                  <th className="px-4 py-3">Delivery Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {deliveries.length ? (
                  deliveries.map((del) => (
                    <tr key={del._id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3 font-black text-gray-900">{del.deliveryNumber}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(del.deliveryDate)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={del.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => navigate(`${getModuleBasePath(role, "sales")}/deliveries?search=${encodeURIComponent(del.deliveryNumber)}`)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700"
                        >
                          View <FiExternalLink />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-sm font-semibold text-gray-400">
                      No deliveries found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
