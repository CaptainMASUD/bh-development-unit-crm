"use client"

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { motion } from "framer-motion"
import toast, { Toaster } from "react-hot-toast"
import {
  FiBriefcase,
  FiEdit2,
  FiFilter,
  FiPlus,
  FiRefreshCcw,
  FiSave,
  FiSearch,
  FiTrash2,
  FiX,
} from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const shell = "min-h-screen bg-gradient-to-b from-gray-50 to-white"
const card =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]"
const btn =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
const btnPrimary = "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
const btnGhost = "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
const btnDanger = "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
const input =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-gray-300 focus:border-transparent focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
const chip = "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold ring-1"

const statuses = ["all", "pending", "approved", "paid", "rejected"]
const paymentMethods = ["cash", "bank", "card", "mobile_banking", "cheque", "online", "other"]

const emptyForm = {
  title: "",
  category: "",
  expenseDate: new Date().toISOString().slice(0, 10),
  amount: "",
  paymentMethod: "cash",
  payeeVendor: "",
  invoiceBillNo: "",
  referenceNo: "",
  description: "",
  attachment: { name: "", url: "" },
  branch: "",
  status: "pending",
}

function headers() {
  const token = localStorage.getItem("token")

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
    credentials: "include",
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) throw new Error(data?.message || "Request failed")

  return data
}

function money(value) {
  return new Intl.NumberFormat("en-BD", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function pretty(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function cn(...classes) {
  return classes.filter(Boolean).join(" ")
}

function dateInput(value) {
  if (!value) return ""

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ""

  return date.toISOString().slice(0, 10)
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-gray-800">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  )
}

function StatusBadge({ status }) {
  const styles = {
    paid: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    approved: "bg-indigo-50 text-indigo-700 ring-indigo-100",
    pending: "bg-amber-50 text-amber-700 ring-amber-100",
    rejected: "bg-rose-50 text-rose-700 ring-rose-100",
  }

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-black ring-1",
        styles[status] || "bg-gray-100 text-gray-600 ring-gray-200"
      )}
    >
      {pretty(status)}
    </span>
  )
}

function FilterChip({ label, value, onClear }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
      title={`Remove ${label} filter`}
      aria-label={`Remove ${label} filter`}
    >
      <span className="text-indigo-400">{label}:</span>
      <span className="max-w-[180px] truncate sm:max-w-[220px]">{value}</span>
      <FiX className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
    </button>
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
  maxWidthClass = "max-w-3xl",
}) {
  useEffect(() => {
    if (!open) return

    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const onKey = (event) => {
      if (event.key === "Escape") onClose?.()
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 overflow-y-auto">
        <div className="flex min-h-full items-start justify-center p-4 sm:items-center sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-md"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className={cn(
              "relative w-full overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_30px_70px_-30px_rgba(0,0,0,0.65)]",
              maxWidthClass
            )}
          >
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-100 bg-gray-50/70 p-4 sm:p-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
                  {icon}
                </div>

                <div className="min-w-0">
                  <h2 className="truncate text-base font-bold text-gray-900 sm:text-lg">
                    {title}
                  </h2>
                  {subtitle ? (
                    <p className="truncate text-sm text-gray-600">{subtitle}</p>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 transition hover:bg-gray-100"
              >
                <FiX className="h-5 w-5 text-gray-700" />
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

function HeaderSearchFilters({
  filters,
  updateFilter,
  resetFilters,
  selectedCategory,
  selectedPaymentMethod,
  activeFilterCount,
  onOpenFilters,
}) {
  return (
    <div
      className={cn(
        "w-full transition-all duration-200",
        activeFilterCount
          ? "lg:min-w-[520px] lg:max-w-[72%] lg:flex-[0_1_72%]"
          : "lg:max-w-[46%] lg:flex-[0_1_46%]"
      )}
    >
      <div className="flex min-h-[42px] w-full flex-wrap items-center gap-1.5 rounded-2xl border border-gray-200 bg-[#f7f8fb] px-2.5 py-1 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.10)]">
        <FiSearch className="h-4 w-4 shrink-0 text-gray-400" />

        {filters.q.trim() ? (
          <FilterChip
            label="Search"
            value={filters.q.trim()}
            onClear={() => updateFilter("q", "")}
          />
        ) : null}

        {filters.status !== "all" ? (
          <FilterChip
            label="Status"
            value={pretty(filters.status)}
            onClear={() => updateFilter("status", "all")}
          />
        ) : null}

        {filters.category ? (
          <FilterChip
            label="Category"
            value={selectedCategory?.name || "Selected category"}
            onClear={() => updateFilter("category", "")}
          />
        ) : null}

        {filters.paymentMethod !== "all" ? (
          <FilterChip
            label="Method"
            value={selectedPaymentMethod}
            onClear={() => updateFilter("paymentMethod", "all")}
          />
        ) : null}

        <input
          className="min-w-[110px] flex-1 border-0 bg-transparent px-1 py-1 text-sm font-semibold text-gray-800 outline-none placeholder:text-gray-400 focus:outline-none focus:ring-0"
          value={filters.q}
          onChange={(event) => updateFilter("q", event.target.value)}
          placeholder={activeFilterCount ? "Search..." : "Search expense, vendor, ref..."}
          type="text"
        />

        <button
          type="button"
          onClick={onOpenFilters}
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-2 rounded-xl px-2.5 text-xs font-black transition",
            activeFilterCount
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"
          )}
        >
          <FiFilter className="h-3.5 w-3.5" />
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
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            title="Clear search and filters"
          >
            <FiX className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  )
}

export default function Expenses() {
  const [expenses, setExpenses] = useState([])
  const [categories, setCategories] = useState([])
  const [summary, setSummary] = useState({ total: { count: 0, amount: 0 } })
  const [filters, setFilters] = useState({
    q: "",
    status: "all",
    category: "",
    paymentMethod: "all",
  })
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [modal, setModal] = useState({ open: false, item: null })
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState("")

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: "20" })

    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== "all") params.set(key, value)
    })

    return params.toString()
  }, [filters, page])

  const selectedCategory = useMemo(() => {
    return categories.find((item) => String(item._id) === String(filters.category))
  }, [categories, filters.category])

  const selectedPaymentMethod = useMemo(() => {
    return filters.paymentMethod !== "all" ? pretty(filters.paymentMethod) : ""
  }, [filters.paymentMethod])

  const activeFilterCount = useMemo(() => {
    let count = 0

    if (filters.q.trim()) count += 1
    if (filters.status !== "all") count += 1
    if (filters.category) count += 1
    if (filters.paymentMethod !== "all") count += 1

    return count
  }, [filters])

  const loadLookups = async () => {
    try {
      const categoryRes = await api("/expenses/categories?active=true")
      setCategories(categoryRes.categories || [])
    } catch (error) {
      toast.error(error.message || "Failed to load setup data")
    }
  }

  const loadExpenses = async () => {
    setLoading(true)

    try {
      const data = await api(`/expenses?${query}`)
      setExpenses(data.expenses || [])
      setSummary(data.summary || { total: { count: 0, amount: 0 } })
      setTotal(data.total || 0)
      setTotalPages(data.totalPages || 1)
    } catch (error) {
      toast.error(error.message || "Failed to load expenses")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLookups()
  }, [])

  useEffect(() => {
    loadExpenses()
  }, [query])

  const openModal = (item = null) => {
    setFormError("")
    setModal({ open: true, item })

    setForm(
      item
        ? {
            title: item.title || "",
            category: item.category?._id || item.category || "",
            expenseDate: dateInput(item.expenseDate),
            amount: item.amount || "",
            paymentMethod: item.paymentMethod || "cash",
            payeeVendor: item.payeeVendor || "",
            invoiceBillNo: item.invoiceBillNo || "",
            referenceNo: item.referenceNo || "",
            description: item.description || "",
            attachment: item.attachment || { name: "", url: "" },
            branch: item.branch || "",
            status: item.status || "pending",
          }
        : emptyForm
    )
  }

  const closeModal = () => {
    setFormError("")
    setModal({ open: false, item: null })
  }

  const save = async (event) => {
    event.preventDefault()
    setFormError("")

    if (!form.title.trim()) return setFormError("Expense title is required.")
    if (!form.category) return setFormError("Expense category is required.")
    if (!form.expenseDate) return setFormError("Expense date is required.")
    if (Number(form.amount || 0) <= 0) return setFormError("Amount must be greater than 0.")
    if (!form.paymentMethod) return setFormError("Payment method is required.")
    if (!form.status) return setFormError("Status is required.")

    try {
      await api(modal.item?._id ? `/expenses/${modal.item._id}` : "/expenses", {
        method: modal.item?._id ? "PATCH" : "POST",
        body: JSON.stringify({ ...form, amount: Number(form.amount || 0) }),
      })

      toast.success(modal.item ? "Expense updated" : "Expense created")
      closeModal()
      await loadExpenses()
    } catch (error) {
      setFormError(error.message || "Save failed.")
    }
  }

  const remove = async (item) => {
    if (!window.confirm(`Delete ${item.title}?`)) return

    try {
      await api(`/expenses/${item._id}`, { method: "DELETE" })
      toast.success("Expense deleted")
      await loadExpenses()
    } catch (error) {
      toast.error(error.message || "Delete failed")
    }
  }

  const updateFilter = (key, value) => {
    setPage(1)
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const resetFilters = () => {
    setPage(1)
    setFilters({
      q: "",
      status: "all",
      category: "",
      paymentMethod: "all",
    })
  }

  const cards = [
    ["Total Expenses", summary.total?.amount || 0, summary.total?.count || 0],
    ["Pending", summary.pending?.amount || 0, summary.pending?.count || 0],
    ["Approved", summary.approved?.amount || 0, summary.approved?.count || 0],
    ["Paid", summary.paid?.amount || 0, summary.paid?.count || 0],
  ]

  return (
    <div className={`${shell} p-4 sm:p-6 lg:p-8`}>
      <Toaster position="top-right" />

      <section className={cn(card, "mb-6 p-4 sm:p-5")}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
              <FiBriefcase className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-2xl font-extrabold tracking-tight text-gray-900">
                Expenses
              </h1>
              <p className="mt-0.5 text-sm text-gray-500">
                Record and manage company expense payments.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button className={cn(btn, btnGhost)} onClick={loadExpenses} disabled={loading}>
              <FiRefreshCcw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
              Refresh
            </button>

            <button className={cn(btn, btnPrimary)} onClick={() => openModal()}>
              <FiPlus className="h-4 w-4" />
              Add Expense
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <HeaderSearchFilters
            filters={filters}
            updateFilter={updateFilter}
            resetFilters={resetFilters}
            selectedCategory={selectedCategory}
            selectedPaymentMethod={selectedPaymentMethod}
            activeFilterCount={activeFilterCount}
            onOpenFilters={() => setFilterOpen(true)}
          />

          <p className="text-sm font-bold text-gray-500">
            Showing <span className="text-gray-900">{expenses.length}</span> of{" "}
            <span className="text-gray-900">{total}</span> expenses
          </p>
        </div>
      </section>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, count]) => (
          <div key={label} className={`${card} p-5`}>
            <p className="text-sm font-semibold text-gray-500">{label}</p>
            <p className="mt-2 text-2xl font-black text-gray-950">{money(value)}</p>
            <p className="mt-2 text-sm font-semibold text-gray-500">
              {count} record{count === 1 ? "" : "s"}
            </p>
          </div>
        ))}
      </div>

      <div className={`${card} overflow-hidden`}>
        <div className="max-h-[560px] overflow-auto">
          <table className="min-w-full text-left">
            <thead className="sticky top-0 bg-gray-50 text-xs font-black uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Expense</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Amount</th>
                <th className="px-5 py-3">Method</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {expenses.map((item) => (
                <tr key={item._id} className="bg-white hover:bg-gray-50/70">
                  <td className="px-5 py-4">
                    <p className="text-sm font-black text-gray-900">{item.title}</p>
                    <p className="mt-0.5 text-xs font-semibold text-gray-500">
                      {item.payeeVendor || item.referenceNo || "-"}
                    </p>
                  </td>

                  <td className="px-5 py-4 text-sm font-semibold text-gray-700">
                    {item.category?.name || "-"}
                  </td>

                  <td className="px-5 py-4 text-sm font-semibold text-gray-700">
                    {dateInput(item.expenseDate) || "-"}
                  </td>

                  <td className="px-5 py-4 text-sm font-black text-gray-900">
                    {money(item.amount)}
                  </td>

                  <td className="px-5 py-4 text-sm font-semibold text-gray-700">
                    {pretty(item.paymentMethod)}
                  </td>

                  <td className="px-5 py-4">
                    <StatusBadge status={item.status} />
                  </td>

                  <td className="sticky right-0 bg-white px-5 py-4 shadow-[-16px_0_24px_-24px_rgba(15,23,42,0.7)]">
                    <div className="flex justify-end gap-2">
                      <button
                        className={`${btn} ${btnGhost} px-3`}
                        onClick={() => openModal(item)}
                      >
                        <FiEdit2 />
                      </button>

                      <button
                        className={`${btn} ${btnDanger} px-3`}
                        onClick={() => remove(item)}
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!expenses.length ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm font-bold text-gray-500">
                    No expenses found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 p-4">
          <button
            className={`${btn} ${btnGhost}`}
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>

          <span className="text-sm font-bold text-gray-500">
            Page {page} of {totalPages}
          </span>

          <button
            className={`${btn} ${btnGhost}`}
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>

      {filterOpen ? (
        <ModalShell
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          title="Expense filters"
          subtitle="Filter expense records by status, category and payment method."
          icon={<FiFilter className="h-5 w-5" />}
          maxWidthClass="max-w-4xl"
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
                {activeFilterCount} active filter{activeFilterCount === 1 ? "" : "s"}
              </span>

              <div className="flex justify-end gap-2">
                <button className={`${btn} ${btnGhost}`} onClick={resetFilters}>
                  Reset
                </button>

                <button className={`${btn} ${btnPrimary}`} onClick={() => setFilterOpen(false)}>
                  Apply filters
                </button>
              </div>
            </div>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Status">
              <select
                className={input}
                value={filters.status}
                onChange={(e) => updateFilter("status", e.target.value)}
              >
                {statuses.map((x) => (
                  <option key={x} value={x}>
                    {pretty(x)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Category">
              <select
                className={input}
                value={filters.category}
                onChange={(e) => updateFilter("category", e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map((x) => (
                  <option key={x._id} value={x._id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Payment Method">
              <select
                className={input}
                value={filters.paymentMethod}
                onChange={(e) => updateFilter("paymentMethod", e.target.value)}
              >
                <option value="all">All Methods</option>
                {paymentMethods.map((x) => (
                  <option key={x} value={x}>
                    {pretty(x)}
                  </option>
                ))}
              </select>
            </Field>

            <div className="md:col-span-2 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
              <p className="text-sm font-black text-gray-900">Active filters</p>

              <div className="mt-3 flex flex-wrap gap-2">
                {filters.q.trim() ? (
                  <FilterChip
                    label="Search"
                    value={filters.q.trim()}
                    onClear={() => updateFilter("q", "")}
                  />
                ) : null}

                {filters.status !== "all" ? (
                  <FilterChip
                    label="Status"
                    value={pretty(filters.status)}
                    onClear={() => updateFilter("status", "all")}
                  />
                ) : null}

                {filters.category ? (
                  <FilterChip
                    label="Category"
                    value={selectedCategory?.name || "Selected category"}
                    onClear={() => updateFilter("category", "")}
                  />
                ) : null}

                {filters.paymentMethod !== "all" ? (
                  <FilterChip
                    label="Method"
                    value={selectedPaymentMethod}
                    onClear={() => updateFilter("paymentMethod", "all")}
                  />
                ) : null}

                {!activeFilterCount ? (
                  <span className="text-sm font-semibold text-gray-500">
                    No active filter selected.
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </ModalShell>
      ) : null}

      <ExpenseModal
        open={modal.open}
        form={form}
        setForm={setForm}
        item={modal.item}
        categories={categories}
        error={formError}
        onClose={closeModal}
        onSubmit={save}
      />
    </div>
  )
}

function ExpenseModal({
  open,
  form,
  setForm,
  item,
  categories,
  error,
  onClose,
  onSubmit,
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={item ? "Update expense" : "Add expense"}
      subtitle={
        item
          ? form.title || "Edit company expense payment."
          : "Create a new company expense payment record."
      }
      icon={item ? <FiEdit2 className="h-5 w-5" /> : <FiPlus className="h-5 w-5" />}
      maxWidthClass="max-w-5xl"
      footer={
        <div className="flex flex-col justify-end gap-2 sm:flex-row">
          <button className={cn(btn, btnGhost)} type="button" onClick={onClose}>
            Cancel
          </button>

          <button className={cn(btn, btnPrimary)} type="submit" form="expense-form">
            <FiSave className="h-4 w-4" />
            {item ? "Update expense" : "Save expense"}
          </button>
        </div>
      }
    >
      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      <form id="expense-form" onSubmit={onSubmit}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Expense title *">
            <input
              className={input}
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              required
            />
          </Field>

          <Field label="Expense category *">
            <select
              className={input}
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              required
            >
              <option value="">Select category</option>
              {categories.map((x) => (
                <option key={x._id} value={x._id}>
                  {x.parent?.name ? `${x.parent.name} / ${x.name}` : x.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Expense date *">
            <input
              className={input}
              type="date"
              value={form.expenseDate}
              onChange={(e) => setForm((p) => ({ ...p, expenseDate: e.target.value }))}
              required
            />
          </Field>

          <Field label="Amount *">
            <input
              className={input}
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              required
            />
          </Field>

          <Field label="Payment method *">
            <select
              className={input}
              value={form.paymentMethod}
              onChange={(e) => setForm((p) => ({ ...p, paymentMethod: e.target.value }))}
              required
            >
              {paymentMethods.map((x) => (
                <option key={x} value={x}>
                  {pretty(x)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Payee / vendor">
            <input
              className={input}
              value={form.payeeVendor}
              onChange={(e) => setForm((p) => ({ ...p, payeeVendor: e.target.value }))}
            />
          </Field>

          <Field label="Invoice / bill no">
            <input
              className={input}
              value={form.invoiceBillNo}
              onChange={(e) => setForm((p) => ({ ...p, invoiceBillNo: e.target.value }))}
            />
          </Field>

          <Field label="Reference no">
            <input
              className={input}
              value={form.referenceNo}
              onChange={(e) => setForm((p) => ({ ...p, referenceNo: e.target.value }))}
            />
          </Field>

          <Field label="Branch">
            <input
              className={input}
              value={form.branch}
              onChange={(e) => setForm((p) => ({ ...p, branch: e.target.value }))}
            />
          </Field>

          <Field label="Status *">
            <select
              className={input}
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
              required
            >
              {statuses
                .filter((x) => x !== "all")
                .map((x) => (
                  <option key={x} value={x}>
                    {pretty(x)}
                  </option>
                ))}
            </select>
          </Field>

          <Field label="Attachment name">
            <input
              className={input}
              value={form.attachment?.name || ""}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  attachment: { ...(p.attachment || {}), name: e.target.value },
                }))
              }
            />
          </Field>

          <Field label="Attachment URL">
            <input
              className={input}
              value={form.attachment?.url || ""}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  attachment: { ...(p.attachment || {}), url: e.target.value },
                }))
              }
            />
          </Field>

          <div className="lg:col-span-3">
            <Field label="Description">
              <textarea
                className={cn(input, "min-h-[110px] resize-none")}
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </Field>
          </div>
        </div>
      </form>
    </ModalShell>
  )
}