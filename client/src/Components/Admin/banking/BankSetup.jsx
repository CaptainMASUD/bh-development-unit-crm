"use client"

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { motion } from "framer-motion"
import toast, { Toaster } from "react-hot-toast"
import {
  FiCreditCard,
  FiEdit2,
  FiFilter,
  FiGlobe,
  FiLink,
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

const emptyBankForm = {
  bankName: "",
  shortName: "",
  bankType: "private",
  country: "Bangladesh",
  swiftCode: "",
  website: "",
  status: "active",
}

const emptyAccountForm = {
  bank: "",
  ledgerAccount: "",
  accountName: "",
  accountNumber: "",
  accountType: "current",
  openingBalance: "",
  status: "active",
  branchName: "",
  routingNumber: "",
  swiftCode: "",
  currency: "BDT",
  description: "",
}

const BANK_TYPES = [
  ["private", "Private"],
  ["public", "Public"],
  ["state_owned", "State Owned"],
  ["foreign", "Foreign"],
  ["specialized", "Specialized"],
  ["microfinance", "Microfinance"],
  ["other", "Other"],
]

const ACCOUNT_TYPES = [
  ["current", "Current Account"],
  ["savings", "Savings Account"],
  ["fixed_deposit", "Fixed Deposit"],
  ["loan", "Loan Account"],
  ["credit_card", "Credit Card"],
  ["mobile_banking", "Mobile Banking"],
  ["other", "Other"],
]

function headers() {
  const token = localStorage.getItem("token")

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) throw new Error(data?.message || data?.error || "Request failed")

  return data
}

function cn(...classes) {
  return classes.filter(Boolean).join(" ")
}

function pretty(value) {
  return String(value || "-")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function normalizeWebsite(value) {
  const text = String(value || "").trim()

  if (!text) return ""

  return /^https?:\/\//i.test(text) ? text : `https://${text}`
}

function formatMoney(value, currency = "BDT") {
  const amount = Number(value || 0)

  return `${String(currency || "BDT").toUpperCase()} ${amount.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })}`
}

function RequiredMark() {
  return <span className="ml-1 text-rose-500">*</span>
}

function Field({ label, children, hint, required = false }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-gray-800">
        {label}
        {required ? <RequiredMark /> : null}
      </label>

      {children}

      {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  )
}

function Badge({ value }) {
  const key = String(value || "").toLowerCase()

  const style =
    key === "active"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : key === "inactive"
        ? "bg-gray-100 text-gray-700 ring-gray-200"
        : key === "current" || key === "savings" || key === "private"
          ? "bg-indigo-50 text-indigo-700 ring-indigo-100"
          : key === "loan" || key === "credit_card"
            ? "bg-amber-50 text-amber-700 ring-amber-100"
            : "bg-slate-100 text-slate-700 ring-slate-200"

  return (
    <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-black ring-1", style)}>
      {pretty(value)}
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
                aria-label="Close modal"
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

function ActiveFilterChips({
  filters,
  activeTab,
  updateFilter,
  selectedBankName,
  activeFilterCount,
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {filters.q.trim() ? (
        <FilterChip label="Search" value={filters.q.trim()} onClear={() => updateFilter("q", "")} />
      ) : null}

      {filters.status !== "all" ? (
        <FilterChip
          label="Status"
          value={pretty(filters.status)}
          onClear={() => updateFilter("status", "all")}
        />
      ) : null}

      {activeTab === "banks" && filters.bankType !== "all" ? (
        <FilterChip
          label="Type"
          value={pretty(filters.bankType)}
          onClear={() => updateFilter("bankType", "all")}
        />
      ) : null}

      {activeTab === "accounts" && filters.accountType !== "all" ? (
        <FilterChip
          label="Account Type"
          value={pretty(filters.accountType)}
          onClear={() => updateFilter("accountType", "all")}
        />
      ) : null}

      {activeTab === "accounts" && filters.bank !== "all" ? (
        <FilterChip
          label="Bank"
          value={selectedBankName || "Selected bank"}
          onClear={() => updateFilter("bank", "all")}
        />
      ) : null}

      {!activeFilterCount ? (
        <span className="text-sm font-semibold text-gray-500">No active filter selected.</span>
      ) : null}
    </div>
  )
}

function HeaderSearchFilters({
  filters,
  activeTab,
  updateFilter,
  resetFilters,
  selectedBankName,
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
          <FilterChip label="Search" value={filters.q.trim()} onClear={() => updateFilter("q", "")} />
        ) : null}

        {filters.status !== "all" ? (
          <FilterChip
            label="Status"
            value={pretty(filters.status)}
            onClear={() => updateFilter("status", "all")}
          />
        ) : null}

        {activeTab === "banks" && filters.bankType !== "all" ? (
          <FilterChip
            label="Type"
            value={pretty(filters.bankType)}
            onClear={() => updateFilter("bankType", "all")}
          />
        ) : null}

        {activeTab === "accounts" && filters.accountType !== "all" ? (
          <FilterChip
            label="Account Type"
            value={pretty(filters.accountType)}
            onClear={() => updateFilter("accountType", "all")}
          />
        ) : null}

        {activeTab === "accounts" && filters.bank !== "all" ? (
          <FilterChip
            label="Bank"
            value={selectedBankName || "Selected bank"}
            onClear={() => updateFilter("bank", "all")}
          />
        ) : null}

        <input
          className="min-w-[110px] flex-1 border-0 bg-transparent px-1 py-1 text-sm font-semibold text-gray-800 outline-none placeholder:text-gray-400 focus:outline-none focus:ring-0"
          value={filters.q}
          onChange={(event) => updateFilter("q", event.target.value)}
          placeholder={
            activeFilterCount
              ? "Search..."
              : activeTab === "banks"
                ? "Search bank name, short name, country, SWIFT..."
                : "Search account name, number, branch, routing..."
          }
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

export default function BankSetup() {
  const [activeTab, setActiveTab] = useState("banks")
  const [banks, setBanks] = useState([])
  const [accounts, setAccounts] = useState([])
  const [ledgerAccounts, setLedgerAccounts] = useState([])
  const [loading, setLoading] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [modal, setModal] = useState({ open: false, mode: "bank", item: null })
  const [bankForm, setBankForm] = useState(emptyBankForm)
  const [accountForm, setAccountForm] = useState(emptyAccountForm)
  const [formError, setFormError] = useState("")

  const [filters, setFilters] = useState({
    q: "",
    status: "all",
    bankType: "all",
    accountType: "all",
    bank: "all",
  })

  const activeBanks = useMemo(() => {
    return banks.filter((bank) => bank.status === "active")
  }, [banks])

  const selectedBankRecord = useMemo(() => {
    return banks.find((bank) => String(bank._id) === String(filters.bank))
  }, [banks, filters.bank])

  const selectedBankName = useMemo(() => {
    if (!selectedBankRecord) return ""
    return selectedBankRecord.shortName || selectedBankRecord.bankName || "Selected bank"
  }, [selectedBankRecord])

  const activeFilterCount = useMemo(() => {
    let count = 0

    if (filters.q.trim()) count += 1
    if (filters.status !== "all") count += 1

    if (activeTab === "banks" && filters.bankType !== "all") count += 1

    if (activeTab === "accounts" && filters.accountType !== "all") count += 1
    if (activeTab === "accounts" && filters.bank !== "all") count += 1

    return count
  }, [activeTab, filters])

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const resetFilters = () => {
    setFilters({
      q: "",
      status: "all",
      bankType: "all",
      accountType: "all",
      bank: "all",
    })
  }

  const loadBanks = async (showLoader = true) => {
    if (showLoader) setLoading(true)

    try {
      const params = new URLSearchParams({ limit: "150" })

      if (activeTab === "banks" && filters.q.trim()) params.set("q", filters.q.trim())
      if (activeTab === "banks" && filters.status !== "all") params.set("status", filters.status)
      if (activeTab === "banks" && filters.bankType !== "all") {
        params.set("bankType", filters.bankType)
      }

      const data = await api(`/banks?${params.toString()}`)
      setBanks(data.banks || [])
    } catch (error) {
      toast.error(error.message || "Failed to load banks")
    } finally {
      if (showLoader) setLoading(false)
    }
  }

  const loadAccounts = async () => {
    setLoading(true)

    try {
      const params = new URLSearchParams({ limit: "150" })

      if (filters.q.trim()) params.set("q", filters.q.trim())
      if (filters.status !== "all") params.set("status", filters.status)
      if (filters.accountType !== "all") params.set("accountType", filters.accountType)
      if (filters.bank !== "all") params.set("bank", filters.bank)

      const data = await api(`/banks/accounts?${params.toString()}`)
      setAccounts(data.accounts || [])
    } catch (error) {
      toast.error(error.message || "Failed to load bank accounts")
    } finally {
      setLoading(false)
    }
  }

  const loadLedgerAccounts = async () => {
    try {
      const data = await api("/accounting/accounts?limit=200")
      setLedgerAccounts((data.accounts || []).filter((item) => !item.isGroup && item.isActive !== false && ["asset", "liability"].includes(item.type)))
    } catch (error) {
      toast.error(error.message || "Failed to load accounting ledgers")
    }
  }

  const refresh = async () => {
    if (activeTab === "banks") {
      await loadBanks()
      return
    }

    await Promise.all([loadBanks(false), loadAccounts(), loadLedgerAccounts()])
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === "banks") {
        loadBanks()
      } else {
        loadBanks(false)
        loadAccounts()
        loadLedgerAccounts()
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [activeTab, filters])

  const switchTab = (tab) => {
    setActiveTab(tab)
    setFilterOpen(false)
    resetFilters()
  }

  const openBankModal = (item = null) => {
    setFormError("")
    setModal({ open: true, mode: "bank", item })

    setBankForm(
      item
        ? {
            bankName: item.bankName || "",
            shortName: item.shortName || "",
            bankType: item.bankType || "private",
            country: item.country || "Bangladesh",
            swiftCode: item.swiftCode || "",
            website: item.website || "",
            status: item.status || "active",
          }
        : emptyBankForm
    )
  }

  const openAccountModal = (item = null) => {
    setFormError("")
    setModal({ open: true, mode: "account", item })

    setAccountForm(
      item
        ? {
            bank: item.bank?._id || item.bank || "",
            ledgerAccount: item.ledgerAccount?._id || item.ledgerAccount || "",
            accountName: item.accountName || "",
            accountNumber: item.accountNumber || "",
            accountType: item.accountType || "current",
            openingBalance: item.openingBalance ?? "",
            status: item.status || "active",
            branchName: item.branchName || "",
            routingNumber: item.routingNumber || "",
            swiftCode: item.swiftCode || "",
            currency: item.currency || "BDT",
            description: item.description || "",
          }
        : {
            ...emptyAccountForm,
            bank: activeBanks[0]?._id || banks[0]?._id || "",
          }
    )
  }

  const closeModal = () => {
    setFormError("")
    setModal({ open: false, mode: "bank", item: null })
  }

  const saveBank = async (event) => {
    event.preventDefault()
    setFormError("")

    if (!bankForm.bankName.trim()) return setFormError("Bank name is required.")
    if (!bankForm.shortName.trim()) return setFormError("Short name is required.")
    if (!bankForm.bankType) return setFormError("Bank type is required.")
    if (!bankForm.country.trim()) return setFormError("Country is required.")
    if (!bankForm.status) return setFormError("Status is required.")

    try {
      const payload = {
        ...bankForm,
        shortName: bankForm.shortName.toUpperCase(),
        swiftCode: bankForm.swiftCode.toUpperCase(),
        website: normalizeWebsite(bankForm.website),
      }

      await api(modal.item?._id ? `/banks/${modal.item._id}` : "/banks", {
        method: modal.item?._id ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      })

      toast.success(modal.item ? "Bank updated" : "Bank created")
      closeModal()
      setBankForm(emptyBankForm)
      await loadBanks()
    } catch (error) {
      setFormError(error.message || "Save failed.")
    }
  }

  const saveAccount = async (event) => {
    event.preventDefault()
    setFormError("")

    if (!accountForm.bank) return setFormError("Bank is required.")
    if (!accountForm.accountName.trim()) return setFormError("Account name is required.")
    if (!accountForm.accountNumber.trim()) return setFormError("Account number is required.")
    if (!accountForm.accountType) return setFormError("Account type is required.")
    if (Number(accountForm.openingBalance || 0) < 0) {
      return setFormError("Opening balance cannot be negative.")
    }
    if (!accountForm.status) return setFormError("Status is required.")

    try {
      const payload = {
        ...accountForm,
        openingBalance: Number(accountForm.openingBalance || 0),
        swiftCode: accountForm.swiftCode.toUpperCase(),
        currency: accountForm.currency.toUpperCase() || "BDT",
      }

      await api(modal.item?._id ? `/banks/accounts/${modal.item._id}` : "/banks/accounts", {
        method: modal.item?._id ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      })

      toast.success(modal.item ? "Bank account updated" : "Bank account created")
      closeModal()
      setAccountForm(emptyAccountForm)
      await loadAccounts()
    } catch (error) {
      setFormError(error.message || "Save failed.")
    }
  }

  const removeBank = async (item) => {
    if (!window.confirm(`Delete ${item.bankName}?`)) return

    try {
      await api(`/banks/${item._id}`, { method: "DELETE" })
      toast.success("Bank deleted")
      await loadBanks()
    } catch (error) {
      toast.error(error.message || "Delete failed")
    }
  }

  const removeAccount = async (item) => {
    if (!window.confirm(`Delete ${item.accountName}?`)) return

    try {
      await api(`/banks/accounts/${item._id}`, { method: "DELETE" })
      toast.success("Bank account deleted")
      await loadAccounts()
    } catch (error) {
      toast.error(error.message || "Delete failed")
    }
  }

  const connectLedgers = async () => {
    try {
      const data = await api("/banks/accounts/connect-ledgers", { method: "POST" })
      toast.success(data.message || "Bank accounts connected to accounting")
      await Promise.all([loadAccounts(), loadLedgerAccounts()])
    } catch (error) {
      toast.error(error.message || "Connection failed")
    }
  }

  const showingCount = activeTab === "banks" ? banks.length : accounts.length

  return (
    <div className={`${shell} p-4 sm:p-6 lg:p-8`}>
      <Toaster position="top-right" />

      <section className={cn(card, "mb-6 p-4 sm:p-5")}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
              <FiCreditCard className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-2xl font-extrabold tracking-tight text-gray-900">
                Bank Setup
              </h1>
              <p className="mt-0.5 text-sm text-gray-500">
                Create banks and maintain company accounts under each bank.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {activeTab === "accounts" && accounts.some((account) => !account.ledgerAccount) ? (
              <button className={cn(btn, btnGhost)} onClick={connectLedgers} disabled={loading}>
                <FiLink className="h-4 w-4" /> Connect Accounting
              </button>
            ) : null}
            <button className={cn(btn, btnGhost)} onClick={refresh} disabled={loading}>
              <FiRefreshCcw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
              Refresh
            </button>

            <button
              className={cn(btn, btnPrimary)}
              onClick={() => (activeTab === "banks" ? openBankModal() : openAccountModal())}
            >
              <FiPlus className="h-4 w-4" />
              {activeTab === "banks" ? "Add Bank" : "Add Account"}
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <HeaderSearchFilters
            filters={filters}
            activeTab={activeTab}
            updateFilter={updateFilter}
            resetFilters={resetFilters}
            selectedBankName={selectedBankName}
            activeFilterCount={activeFilterCount}
            onOpenFilters={() => setFilterOpen(true)}
          />

          <p className="text-sm font-bold text-gray-500">
            Showing <span className="text-gray-900">{showingCount}</span>{" "}
            {activeTab === "banks" ? "banks" : "accounts"}
          </p>
        </div>
      </section>

      <div className={`${card} mb-6 p-2`}>
        <div className="flex flex-wrap gap-2">
          {[
            ["banks", "Banks"],
            ["accounts", "Accounts"],
          ].map(([key, title]) => (
            <button
              key={key}
              className={cn(
                "rounded-xl px-5 py-3 text-sm font-extrabold transition",
                activeTab === key
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-700 hover:bg-gray-50"
              )}
              onClick={() => switchTab(key)}
              type="button"
            >
              {title}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "banks" ? (
        <BankTable
          banks={banks}
          loading={loading}
          openBankModal={openBankModal}
          removeBank={removeBank}
        />
      ) : (
        <AccountTable
          accounts={accounts}
          loading={loading}
          openAccountModal={openAccountModal}
          removeAccount={removeAccount}
        />
      )}

      <FilterModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        activeTab={activeTab}
        filters={filters}
        updateFilter={updateFilter}
        resetFilters={resetFilters}
        activeFilterCount={activeFilterCount}
        banks={banks}
        selectedBankName={selectedBankName}
      />

      <BankFormModal
        open={modal.open && modal.mode === "bank"}
        item={modal.item}
        form={bankForm}
        setForm={setBankForm}
        error={formError}
        onClose={closeModal}
        onSubmit={saveBank}
      />

      <AccountFormModal
        open={modal.open && modal.mode === "account"}
        item={modal.item}
        form={accountForm}
        setForm={setAccountForm}
        banks={banks}
        ledgerAccounts={ledgerAccounts}
        error={formError}
        onClose={closeModal}
        onSubmit={saveAccount}
      />
    </div>
  )
}

function FilterModal({
  open,
  onClose,
  activeTab,
  filters,
  updateFilter,
  resetFilters,
  activeFilterCount,
  banks,
  selectedBankName,
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={activeTab === "banks" ? "Bank filters" : "Account filters"}
      subtitle={
        activeTab === "banks"
          ? "Filter banks by type and status."
          : "Filter bank accounts by bank, account type and status."
      }
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
            <button className={cn(btn, btnGhost)} onClick={resetFilters}>
              Reset
            </button>

            <button className={cn(btn, btnPrimary)} onClick={onClose}>
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
            onChange={(event) => updateFilter("status", event.target.value)}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>

        {activeTab === "banks" ? (
          <Field label="Bank Type">
            <select
              className={input}
              value={filters.bankType}
              onChange={(event) => updateFilter("bankType", event.target.value)}
            >
              <option value="all">All Bank Types</option>
              {BANK_TYPES.map(([value, labelText]) => (
                <option key={value} value={value}>
                  {labelText}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <>
            <Field label="Account Type">
              <select
                className={input}
                value={filters.accountType}
                onChange={(event) => updateFilter("accountType", event.target.value)}
              >
                <option value="all">All Account Types</option>
                {ACCOUNT_TYPES.map(([value, labelText]) => (
                  <option key={value} value={value}>
                    {labelText}
                  </option>
                ))}
              </select>
            </Field>

            <div className="md:col-span-2">
              <Field label="Bank">
                <select
                  className={input}
                  value={filters.bank}
                  onChange={(event) => updateFilter("bank", event.target.value)}
                >
                  <option value="all">All Banks</option>
                  {banks.map((bank) => (
                    <option key={bank._id} value={bank._id}>
                      {bank.bankName} ({bank.shortName})
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </>
        )}

        <div className="md:col-span-2 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
          <p className="text-sm font-black text-gray-900">Active filters</p>

          <ActiveFilterChips
            filters={filters}
            activeTab={activeTab}
            updateFilter={updateFilter}
            selectedBankName={selectedBankName}
            activeFilterCount={activeFilterCount}
          />
        </div>
      </div>
    </ModalShell>
  )
}

function BankTable({ banks, loading, openBankModal, removeBank }) {
  return (
    <div className={`${card} overflow-hidden`}>
      <div className="max-h-[560px] overflow-auto">
        <table className="min-w-full text-left">
          <thead className="sticky top-0 z-10 bg-gray-50 text-xs font-black uppercase text-gray-500">
            <tr>
              <th className="px-5 py-3">Bank Name</th>
              <th className="px-5 py-3">Short Name</th>
              <th className="px-5 py-3">Bank Type</th>
              <th className="px-5 py-3">Country</th>
              <th className="px-5 py-3">SWIFT</th>
              <th className="px-5 py-3">Website</th>
              <th className="px-5 py-3">Status</th>
              <th className="sticky right-0 bg-gray-50 px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {banks.map((bank) => (
              <tr key={bank._id} className="group bg-white hover:bg-gray-50/70">
                <td className="px-5 py-4">
                  <p className="text-sm font-black text-gray-900">{bank.bankName}</p>
                  <p className="mt-0.5 text-xs font-semibold text-gray-500">
                    {bank.country || "-"}
                  </p>
                </td>

                <td className="px-5 py-4 text-sm font-black text-indigo-700">
                  {bank.shortName || "-"}
                </td>

                <td className="px-5 py-4">
                  <Badge value={bank.bankType} />
                </td>

                <td className="px-5 py-4 text-sm font-semibold text-gray-700">
                  {bank.country || "-"}
                </td>

                <td className="px-5 py-4 text-sm font-semibold text-gray-600">
                  {bank.swiftCode || "-"}
                </td>

                <td className="px-5 py-4 text-sm font-semibold text-gray-600">
                  {bank.website ? (
                    <a
                      className="inline-flex items-center gap-1 text-indigo-700 hover:underline"
                      href={bank.website}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FiGlobe className="h-4 w-4" />
                      Website
                    </a>
                  ) : (
                    "-"
                  )}
                </td>

                <td className="px-5 py-4">
                  <Badge value={bank.status} />
                </td>

                <td className="sticky right-0 bg-white px-5 py-4 shadow-[-16px_0_24px_-24px_rgba(15,23,42,0.7)] group-hover:bg-gray-50/70">
                  <div className="flex justify-end gap-2">
                    <button
                      className={cn(btn, btnGhost, "px-3")}
                      onClick={() => openBankModal(bank)}
                      type="button"
                      aria-label="Edit bank"
                    >
                      <FiEdit2 className="h-4 w-4" />
                    </button>

                    <button
                      className={cn(btn, btnDanger, "px-3")}
                      onClick={() => removeBank(bank)}
                      type="button"
                      aria-label="Delete bank"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!banks.length ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-sm font-bold text-gray-500">
                  {loading ? "Loading banks..." : "No banks found."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AccountTable({ accounts, loading, openAccountModal, removeAccount }) {
  return (
    <div className={`${card} overflow-hidden`}>
      <div className="max-h-[560px] overflow-auto">
        <table className="min-w-full text-left">
          <thead className="sticky top-0 z-10 bg-gray-50 text-xs font-black uppercase text-gray-500">
            <tr>
              <th className="px-5 py-3">Bank</th>
              <th className="px-5 py-3">Account Name</th>
              <th className="px-5 py-3">Account Number</th>
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Accounting Ledger</th>
              <th className="px-5 py-3">Opening Balance</th>
              <th className="px-5 py-3">Branch</th>
              <th className="px-5 py-3">Status</th>
              <th className="sticky right-0 bg-gray-50 px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {accounts.map((account) => (
              <tr key={account._id} className="group bg-white hover:bg-gray-50/70">
                <td className="px-5 py-4">
                  <p className="text-sm font-black text-gray-900">
                    {account.bank?.shortName || "-"}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-gray-500">
                    {account.bank?.bankName || "-"}
                  </p>
                </td>

                <td className="px-5 py-4 text-sm font-black text-gray-900">
                  {account.accountName}
                </td>

                <td className="px-5 py-4 text-sm font-black text-indigo-700">
                  {account.accountNumber}
                </td>

                <td className="px-5 py-4">
                  <Badge value={account.accountType} />
                </td>

                <td className="px-5 py-4">
                  {account.ledgerAccount ? <div><p className="text-sm font-black text-emerald-700">{account.ledgerAccount.code}</p><p className="text-xs font-semibold text-gray-500">{account.ledgerAccount.name}</p></div> : <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">Not connected</span>}
                </td>

                <td className="px-5 py-4 text-sm font-black text-gray-900">
                  {formatMoney(account.openingBalance, account.currency)}
                </td>

                <td className="px-5 py-4 text-sm font-semibold text-gray-600">
                  {account.branchName || "-"}
                </td>

                <td className="px-5 py-4">
                  <Badge value={account.status} />
                </td>

                <td className="sticky right-0 bg-white px-5 py-4 shadow-[-16px_0_24px_-24px_rgba(15,23,42,0.7)] group-hover:bg-gray-50/70">
                  <div className="flex justify-end gap-2">
                    <button
                      className={cn(btn, btnGhost, "px-3")}
                      onClick={() => openAccountModal(account)}
                      type="button"
                      aria-label="Edit account"
                    >
                      <FiEdit2 className="h-4 w-4" />
                    </button>

                    <button
                      className={cn(btn, btnDanger, "px-3")}
                      onClick={() => removeAccount(account)}
                      type="button"
                      aria-label="Delete account"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!accounts.length ? (
              <tr>
                <td colSpan={9} className="px-5 py-12 text-center text-sm font-bold text-gray-500">
                  {loading ? "Loading bank accounts..." : "No bank accounts found."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BankFormModal({ open, item, form, setForm, error, onClose, onSubmit }) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={item ? "Update bank" : "Add bank"}
      subtitle={item ? form.bankName || "Edit bank information." : "Create a new bank for future account setup."}
      icon={item ? <FiEdit2 className="h-5 w-5" /> : <FiPlus className="h-5 w-5" />}
      maxWidthClass="max-w-5xl"
      footer={
        <div className="flex flex-col justify-end gap-2 sm:flex-row">
          <button className={cn(btn, btnGhost)} type="button" onClick={onClose}>
            Cancel
          </button>

          <button className={cn(btn, btnPrimary)} type="submit" form="bank-form">
            <FiSave className="h-4 w-4" />
            {item ? "Update bank" : "Save bank"}
          </button>
        </div>
      }
    >
      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      <form id="bank-form" onSubmit={onSubmit}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Bank Name" required>
            <input
              className={input}
              value={form.bankName}
              onChange={(event) => setForm((prev) => ({ ...prev, bankName: event.target.value }))}
              placeholder="Dutch-Bangla Bank Limited"
              required
            />
          </Field>

          <Field label="Short Name" required>
            <input
              className={input}
              value={form.shortName}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, shortName: event.target.value.toUpperCase() }))
              }
              placeholder="DBBL"
              required
            />
          </Field>

          <Field label="Bank Type" required>
            <select
              className={input}
              value={form.bankType}
              onChange={(event) => setForm((prev) => ({ ...prev, bankType: event.target.value }))}
              required
            >
              {BANK_TYPES.map(([value, labelText]) => (
                <option key={value} value={value}>
                  {labelText}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Country" required>
            <input
              className={input}
              value={form.country}
              onChange={(event) => setForm((prev) => ({ ...prev, country: event.target.value }))}
              required
            />
          </Field>

          <Field label="SWIFT Code" hint="Optional">
            <input
              className={input}
              value={form.swiftCode}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, swiftCode: event.target.value.toUpperCase() }))
              }
              placeholder="DBBLBDDH"
            />
          </Field>

          <Field label="Website" hint="Optional">
            <input
              className={input}
              value={form.website}
              onChange={(event) => setForm((prev) => ({ ...prev, website: event.target.value }))}
              placeholder="https://www.dutchbanglabank.com"
            />
          </Field>

          <Field label="Status" required>
            <select
              className={input}
              value={form.status}
              onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
              required
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
        </div>
      </form>
    </ModalShell>
  )
}

function AccountFormModal({
  open,
  item,
  form,
  setForm,
  banks,
  ledgerAccounts,
  error,
  onClose,
  onSubmit,
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={item ? "Update bank account" : "Add bank account"}
      subtitle={
        item
          ? form.accountName || "Edit company bank account."
          : "Create a company account under the selected bank."
      }
      icon={item ? <FiEdit2 className="h-5 w-5" /> : <FiPlus className="h-5 w-5" />}
      maxWidthClass="max-w-5xl"
      footer={
        <div className="flex flex-col justify-end gap-2 sm:flex-row">
          <button className={cn(btn, btnGhost)} type="button" onClick={onClose}>
            Cancel
          </button>

          <button className={cn(btn, btnPrimary)} type="submit" form="bank-account-form">
            <FiSave className="h-4 w-4" />
            {item ? "Update account" : "Save account"}
          </button>
        </div>
      }
    >
      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      <form id="bank-account-form" onSubmit={onSubmit}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Select Bank" required>
            <select
              className={input}
              value={form.bank}
              onChange={(event) => setForm((prev) => ({ ...prev, bank: event.target.value }))}
              required
            >
              <option value="">Select Bank</option>
              {banks.map((bank) => (
                <option key={bank._id} value={bank._id}>
                  {bank.bankName} ({bank.shortName})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Account Name" required>
            <input
              className={input}
              value={form.accountName}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, accountName: event.target.value }))
              }
              placeholder="Company Main Account"
              required
            />
          </Field>

          <Field label="Account Number" required>
            <input
              className={input}
              value={form.accountNumber}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, accountNumber: event.target.value }))
              }
              placeholder="123456789"
              required
            />
          </Field>

          <Field label="Account Type" required>
            <select
              className={input}
              value={form.accountType}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, accountType: event.target.value }))
              }
              required
            >
              {ACCOUNT_TYPES.map(([value, labelText]) => (
                <option key={value} value={value}>
                  {labelText}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Accounting Ledger" hint="Leave empty to create and link a dedicated ledger automatically.">
            <select className={input} value={form.ledgerAccount} onChange={(event) => setForm((prev) => ({ ...prev, ledgerAccount: event.target.value }))}>
              <option value="">Auto-create dedicated ledger</option>
              {ledgerAccounts.map((account) => <option key={account._id} value={account._id}>{account.code} — {account.name}</option>)}
            </select>
          </Field>

          <Field label="Opening Balance" required>
            <input
              className={input}
              type="number"
              min="0"
              step="0.01"
              value={form.openingBalance}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, openingBalance: event.target.value }))
              }
              placeholder="50000"
              required
            />
          </Field>

          <Field label="Status" required>
            <select
              className={input}
              value={form.status}
              onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
              required
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>

          <Field label="Branch Name" hint="Optional">
            <input
              className={input}
              value={form.branchName}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, branchName: event.target.value }))
              }
              placeholder="Mirpur"
            />
          </Field>

          <Field label="Routing Number" hint="Optional">
            <input
              className={input}
              value={form.routingNumber}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, routingNumber: event.target.value }))
              }
            />
          </Field>

          <Field label="SWIFT Code" hint="Optional">
            <input
              className={input}
              value={form.swiftCode}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, swiftCode: event.target.value.toUpperCase() }))
              }
            />
          </Field>

          <Field label="Currency" hint="Optional">
            <input
              className={input}
              value={form.currency}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))
              }
              placeholder="BDT"
              maxLength={3}
            />
          </Field>

          <div className="lg:col-span-3">
            <Field label="Description" hint="Optional">
              <textarea
                className={cn(input, "min-h-[110px] resize-none")}
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Internal note for this account"
              />
            </Field>
          </div>
        </div>
      </form>
    </ModalShell>
  )
}
