"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle02Icon,
  Edit02Icon,
  FloppyDiskIcon,
  HierarchySquare01Icon,
  RefreshIcon,
  UnavailableIcon,
} from "@hugeicons/core-free-icons"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const shell = "min-h-screen bg-gradient-to-b from-gray-50 to-white"
const card =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_35px_-28px_rgba(15,23,42,0.55)]"
const input =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-300 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
const button =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
const buttonGhost =
  "border border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
const buttonPrimary =
  "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-700"

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const rule = (prefix) => ({
  prefix,
  digitLength: 6,
  reset: "fiscal_year",
  format: "{PREFIX}-{FY}-{NUMBER}",
})

const emptyForm = {
  legalName: "",
  address: "",
  taxId: "",
  vatRegistrationNumber: "",
  fiscalYearStartMonth: 7,
  fiscalYearStartDay: 1,
  defaultFiscalYear: "",
  currency: "BDT",
  multiCurrencyEnabled: false,
  accountingMethod: "accrual",
  roundingPrecision: 2,
  defaultCashAccount: "",
  defaultBankAccount: "",
  salesAccount: "",
  purchaseAccount: "",
  receivableAccount: "",
  payableAccount: "",
  inventoryAccount: "",
  furnitureAccount: "",
  loanAccount: "",
  payrollExpenseAccount: "",
  payrollPayableAccount: "",
  retainedEarningsAccount: "",
  exchangeGainAccount: "",
  exchangeLossAccount: "",
  roundingAccount: "",
  vatPayableAccount: "",
  vatReceivableAccount: "",
  approvalEnabled: false,
  journalApprovalThreshold: 0,
  lockDate: "",
  periodCloseRequireReconciliation: false,
  defaultTaxScheme: "",
  taxCalculationMethod: "exclusive",
  numberingRules: {
    journal: rule("JV"),
    invoice: rule("INV"),
    voucher: rule("PV"),
    bill: rule("BILL"),
  },
}

const tabs = [
  "General",
  "Currency",
  "Numbering",
  "Default Accounts",
  "Approval",
  "Tax",
  "Period Locking",
]

const sectionMeta = {
  General: {
    title: "Company & accounting basis",
    description:
      "Define the company identity, accounting method, and fiscal-year defaults.",
  },
  Currency: {
    title: "Currency & rounding",
    description:
      "Configure the base currency, decimal precision, and multi-currency support.",
  },
  Numbering: {
    title: "Document numbering rules",
    description:
      "Control document prefixes, sequence length, reset frequency, and format tokens.",
  },
  "Default Accounts": {
    title: "Default control accounts",
    description:
      "Connect accounting operations to active postable accounts from the Chart of Accounts.",
  },
  Approval: {
    title: "Approval controls",
    description:
      "Require approval for accounting entries and define the journal threshold.",
  },
  Tax: {
    title: "Tax defaults",
    description:
      "Set the default tax scheme and choose whether prices include or exclude tax.",
  },
  "Period Locking": {
    title: "Global posting lock",
    description:
      "Prevent transactions in closed periods and enforce reconciliation before closing.",
  },
}

const accountFields = [
  ["defaultCashAccount", "Default Cash", ["asset"]],
  ["defaultBankAccount", "Default Bank", ["asset"]],
  ["salesAccount", "Sales / Income", ["revenue"]],
  ["purchaseAccount", "Purchases", ["expense"]],
  ["receivableAccount", "Accounts Receivable Control", ["asset"]],
  ["payableAccount", "Accounts Payable Control", ["liability"]],
  ["inventoryAccount", "Inventory Control", ["asset"]],
  ["furnitureAccount", "Furniture", ["asset"]],
  ["loanAccount", "Loan", ["liability"]],
  ["payrollExpenseAccount", "Payroll Expense", ["expense"]],
  ["payrollPayableAccount", "Payroll Payable", ["liability"]],
  ["retainedEarningsAccount", "Retained Earnings", ["equity"]],
  ["exchangeGainAccount", "Exchange Gain", ["revenue"]],
  ["exchangeLossAccount", "Exchange Loss", ["expense"]],
  ["roundingAccount", "Rounding Off", ["expense", "revenue"]],
  ["vatPayableAccount", "VAT Payable", ["liability"]],
  ["vatReceivableAccount", "VAT Receivable", ["asset"]],
]

function cn(...classes) {
  return classes.filter(Boolean).join(" ")
}

function Icon({ icon, size = 18, strokeWidth = 1.8, className = "" }) {
  return (
    <span className={cn("inline-flex shrink-0", className)}>
      <HugeiconsIcon
        icon={icon}
        size={size}
        color="currentColor"
        strokeWidth={strokeWidth}
      />
    </span>
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
    headers: { ...headers(), ...(options.headers || {}) },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Request failed")
  }

  return data
}

function Field({ label, hint, children, required = false }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-sm font-bold text-gray-800">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </span>

      {children}

      {hint ? (
        <span className="mt-1.5 block text-xs font-medium leading-5 text-gray-500">
          {hint}
        </span>
      ) : null}
    </label>
  )
}

function StatusPill({ ready, label }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black ring-1",
        ready
          ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
          : "bg-amber-50 text-amber-700 ring-amber-100"
      )}
    >
      <Icon
        icon={ready ? CheckmarkCircle02Icon : UnavailableIcon}
        size={15}
        strokeWidth={2}
      />
      {label} {ready ? "ready" : "required"}
    </span>
  )
}

function SectionHeading({ title, description }) {
  return (
    <div className="border-b border-gray-100 pb-4">
      <h2 className="text-base font-black text-gray-950 sm:text-lg">{title}</h2>
      <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-gray-500">
        {description}
      </p>
    </div>
  )
}

function ToggleCard({ title, description, checked, disabled = false, onChange }) {
  return (
    <label
      className={cn(
        "flex min-h-[92px] cursor-pointer items-start justify-between gap-4 rounded-2xl border p-4 transition",
        checked
          ? "border-indigo-200 bg-indigo-50/60"
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/70",
        disabled && "cursor-not-allowed opacity-55"
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-black text-gray-900">{title}</span>
        <span className="mt-1 block text-xs font-medium leading-5 text-gray-500">
          {description}
        </span>
      </span>

      <span
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition",
          checked ? "bg-indigo-600" : "bg-gray-200"
        )}
      >
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={onChange}
        />
        <span
          className={cn(
            "absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition",
            checked ? "left-6" : "left-1"
          )}
        />
      </span>
    </label>
  )
}

function LoadingPanel() {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 px-5 text-center">
      <span className="animate-spin text-indigo-600">
        <Icon icon={RefreshIcon} size={24} strokeWidth={2} />
      </span>
      <p className="mt-3 text-sm font-black text-gray-800">
        Loading accounting settings
      </p>
      <p className="mt-1 text-sm text-gray-500">
        Preparing accounts, fiscal years, and saved configuration.
      </p>
    </div>
  )
}

const idOf = (value) => value?._id || value || ""

const dateValue = (value) => {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10)
}

export default function AccountingSettings() {
  const [form, setForm] = useState(emptyForm)
  const [accounts, setAccounts] = useState([])
  const [fiscalYears, setFiscalYears] = useState([])
  const [active, setActive] = useState("General")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [audit, setAudit] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)

    try {
      const [settingsData, accountData, fiscalData] = await Promise.all([
        api("/accounting/settings"),
        api("/accounting/accounts?limit=200"),
        api("/accounting/fiscal-years"),
      ])

      const settings = settingsData?.settings || {}
      const nextAccounts = accountData?.accounts || []
      const nextFiscalYears = fiscalData?.fiscalYears || []

      setAccounts(nextAccounts)
      setFiscalYears(nextFiscalYears)
      setAudit({ user: settings.updatedBy, at: settings.updatedAt })
      setForm({
        ...emptyForm,
        ...settings,
        defaultFiscalYear: idOf(settings.defaultFiscalYear),
        vatAccount: idOf(settings.vatAccount),
        lockDate: dateValue(settings.lockDate),
        numberingRules: {
          ...emptyForm.numberingRules,
          ...(settings.numberingRules || {}),
        },
        ...Object.fromEntries(
          accountFields.map(([key]) => [key, idOf(settings[key])])
        ),
      })
    } catch (error) {
      toast.error(error?.message || "Failed to load accounting settings")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const readiness = useMemo(
    () => ({
      accounts: accounts.some(
        (account) => !account.isGroup && account.isActive !== false
      ),
      fiscal: fiscalYears.length > 0,
    }),
    [accounts, fiscalYears]
  )

  const activeSection = sectionMeta[active] || sectionMeta.General

  const setRule = (kind, key, value) => {
    setForm((current) => ({
      ...current,
      numberingRules: {
        ...current.numberingRules,
        [kind]: {
          ...current.numberingRules[kind],
          [key]: value,
        },
      },
    }))
  }

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)

    try {
      const data = await api("/accounting/settings", {
        method: "PUT",
        body: JSON.stringify({
          ...form,
          fiscalYearStartMonth: Number(form.fiscalYearStartMonth),
          fiscalYearStartDay: Number(form.fiscalYearStartDay),
          roundingPrecision: Number(form.roundingPrecision),
          journalApprovalThreshold: Number(form.journalApprovalThreshold),
          lockDate: form.lockDate || null,
          numberingRules: Object.fromEntries(
            Object.entries(form.numberingRules).map(([key, value]) => [
              key,
              {
                ...value,
                digitLength: Number(value.digitLength),
              },
            ])
          ),
        }),
      })

      setAudit({
        user: data?.settings?.updatedBy,
        at: data?.settings?.updatedAt,
      })
      toast.success("Accounting settings saved")
    } catch (error) {
      toast.error(error?.message || "Unable to save accounting settings")
    } finally {
      setSaving(false)
    }
  }

  const accountSelect = (key, label, types) => {
    const options = accounts.filter(
      (account) =>
        !account.isGroup &&
        account.isActive !== false &&
        types.includes(account.type)
    )

    return (
      <Field
        key={key}
        label={label}
        hint={
          options.length
            ? `${options.length} eligible account${options.length === 1 ? "" : "s"}`
            : "Create an active postable account in the Chart of Accounts."
        }
      >
        <select
          className={input}
          value={form[key]}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              [key]: event.target.value,
            }))
          }
        >
          <option value="">Not configured</option>
          {options.map((account) => (
            <option key={account._id} value={account._id}>
              {account.code} — {account.name}
            </option>
          ))}
        </select>
      </Field>
    )
  }

  return (
    <div className={cn(shell, "px-4 py-6 sm:px-6 lg:px-8")}>
      <Toaster position="top-right" />

      <div className={cn(card, "mb-5 overflow-hidden")}>
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
                <Icon icon={HierarchySquare01Icon} size={23} strokeWidth={2} />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">
                  Accounting Setup
                </p>
                <h1 className="mt-0.5 text-2xl font-black tracking-tight text-gray-950 sm:text-[28px]">
                  Accounting Settings
                </h1>
                <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-gray-500">
                  Manage system-wide accounting defaults, numbering, approvals,
                  tax behavior, and period controls.
                </p>
              </div>
            </div>

            <button
              type="button"
              className={cn(button, buttonGhost, "shrink-0")}
              onClick={load}
              disabled={loading || saving}
            >
              <span className={loading ? "animate-spin" : ""}>
                <Icon icon={RefreshIcon} size={17} />
              </span>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-3.5 sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill ready={readiness.accounts} label="COA" />
              <StatusPill ready={readiness.fiscal} label="Fiscal year" />
            </div>

            {audit?.at ? (
              <div className="flex min-w-0 items-center gap-2 text-xs font-bold text-gray-500">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-gray-500 ring-1 ring-gray-200">
                  <Icon icon={Edit02Icon} size={14} />
                </span>
                <span className="truncate">
                  Last modified by {audit.user?.name || audit.user?.email || "system"}{" "}
                  on {new Date(audit.at).toLocaleString()}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <form onSubmit={save}>
        {/* Keep the existing tab bar design unchanged. */}
        <div className={`${card} mb-5 overflow-x-auto p-2`}>
          <div className="flex min-w-max gap-1">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActive(tab)}
                className={`rounded-xl px-4 py-2.5 text-sm font-black transition ${
                  active === tab
                    ? "bg-indigo-600 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <section className={cn(card, "p-4 sm:p-5 lg:p-6")}>
          {loading ? (
            <LoadingPanel />
          ) : (
            <>
              <SectionHeading
                title={activeSection.title}
                description={activeSection.description}
              />

              {active === "General" ? (
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <Field label="Legal Company Name">
                    <input
                      className={input}
                      value={form.legalName}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          legalName: event.target.value,
                        }))
                      }
                      placeholder="Business Hub BD"
                    />
                  </Field>

                  <Field label="Tax ID">
                    <input
                      className={input}
                      value={form.taxId}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          taxId: event.target.value,
                        }))
                      }
                      placeholder="Enter tax identification number"
                    />
                  </Field>

                  <Field label="VAT Registration">
                    <input
                      className={input}
                      value={form.vatRegistrationNumber}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          vatRegistrationNumber: event.target.value,
                        }))
                      }
                      placeholder="Enter VAT registration number"
                    />
                  </Field>

                  <div className="md:col-span-2 xl:col-span-3">
                    <Field label="Company Address">
                      <input
                        className={input}
                        value={form.address}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            address: event.target.value,
                          }))
                        }
                        placeholder="Enter registered business address"
                      />
                    </Field>
                  </div>

                  <Field label="Accounting Method">
                    <select
                      className={input}
                      value={form.accountingMethod}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          accountingMethod: event.target.value,
                        }))
                      }
                    >
                      <option value="accrual">Accrual</option>
                      <option value="cash">Cash basis</option>
                    </select>
                  </Field>

                  <Field
                    label="Default Fiscal Year"
                    hint={
                      fiscalYears.length
                        ? `${fiscalYears.length} fiscal year${
                            fiscalYears.length === 1 ? "" : "s"
                          } available`
                        : "Create a fiscal year before selecting a default."
                    }
                  >
                    <select
                      className={input}
                      value={form.defaultFiscalYear}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          defaultFiscalYear: event.target.value,
                        }))
                      }
                    >
                      <option value="">Not configured</option>
                      {fiscalYears.map((fiscalYear) => (
                        <option key={fiscalYear._id} value={fiscalYear._id}>
                          {fiscalYear.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Fiscal Year Start Month">
                    <select
                      className={input}
                      value={form.fiscalYearStartMonth}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          fiscalYearStartMonth: event.target.value,
                        }))
                      }
                    >
                      {months.map((month, index) => (
                        <option key={month} value={index + 1}>
                          {month}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Start Day">
                    <input
                      className={input}
                      type="number"
                      min="1"
                      max="31"
                      value={form.fiscalYearStartDay}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          fiscalYearStartDay: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
              ) : null}

              {active === "Currency" ? (
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <Field
                    label="Base Currency"
                    hint="Use a three-letter currency code such as BDT or USD."
                  >
                    <input
                      className={input}
                      value={form.currency}
                      maxLength="3"
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          currency: event.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="BDT"
                    />
                  </Field>

                  <Field label="Rounding Precision">
                    <select
                      className={input}
                      value={form.roundingPrecision}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          roundingPrecision: event.target.value,
                        }))
                      }
                    >
                      {[0, 1, 2, 3, 4].map((number) => (
                        <option key={number} value={number}>
                          {number} decimal places
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div className="md:col-span-2 xl:col-span-1">
                    <ToggleCard
                      title="Enable multi-currency"
                      description="Allow transactions and balances in currencies other than the base currency."
                      checked={form.multiCurrencyEnabled}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          multiCurrencyEnabled: event.target.checked,
                        }))
                      }
                    />
                  </div>
                </div>
              ) : null}

              {active === "Numbering" ? (
                <div className="mt-5">
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 px-4 py-3 text-sm font-semibold text-indigo-700">
                    Tokens: {"{PREFIX}"}, {"{FY}"}, {"{YYYY}"}, {"{MM}"},{" "}
                    {"{NUMBER}"}
                  </div>

                  {/* Keep the numbering/code-line row shapes unchanged. */}
                  <div className="mt-4 space-y-3">
                    {Object.entries(form.numberingRules).map(([kind, item]) => (
                      <div
                        key={kind}
                        className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-100 p-4 md:grid-cols-[130px_120px_130px_190px_1fr]"
                      >
                        <div className="self-center text-sm font-black capitalize">
                          {kind}
                        </div>
                        <input
                          className={input}
                          value={item.prefix}
                          onChange={(event) =>
                            setRule(kind, "prefix", event.target.value.toUpperCase())
                          }
                          placeholder="Prefix"
                        />
                        <input
                          className={input}
                          type="number"
                          min="3"
                          max="12"
                          value={item.digitLength}
                          onChange={(event) =>
                            setRule(kind, "digitLength", event.target.value)
                          }
                        />
                        <select
                          className={input}
                          value={item.reset}
                          onChange={(event) =>
                            setRule(kind, "reset", event.target.value)
                          }
                        >
                          <option value="fiscal_year">Fiscal year</option>
                          <option value="calendar_year">Calendar year</option>
                          <option value="monthly">Monthly</option>
                          <option value="never">Never</option>
                        </select>
                        <input
                          className={input}
                          value={item.format}
                          onChange={(event) =>
                            setRule(kind, "format", event.target.value)
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {active === "Default Accounts" ? (
                <div className="mt-5">
                  {!readiness.accounts ? (
                    <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                      <span className="mt-0.5 text-amber-600">
                        <Icon icon={UnavailableIcon} size={18} strokeWidth={2} />
                      </span>
                      <div>
                        <p className="text-sm font-black text-gray-900">
                          Chart of Accounts setup required
                        </p>
                        <p className="mt-1 text-sm leading-6 text-gray-600">
                          Create active postable accounts before assigning accounting defaults.
                        </p>
                      </div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {accountFields.map(([key, label, types]) =>
                      accountSelect(key, label, types)
                    )}
                  </div>
                </div>
              ) : null}

              {active === "Approval" ? (
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <ToggleCard
                    title="Require accounting approvals"
                    description="Send eligible journal entries through an approval workflow before posting."
                    checked={form.approvalEnabled}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        approvalEnabled: event.target.checked,
                      }))
                    }
                  />

                  <Field
                    label="Journal Approval Threshold"
                    hint={
                      form.approvalEnabled
                        ? "Journals at or above this amount require approval."
                        : "Enable accounting approvals to configure the threshold."
                    }
                  >
                    <input
                      className={input}
                      type="number"
                      min="0"
                      step="0.01"
                      disabled={!form.approvalEnabled}
                      value={form.journalApprovalThreshold}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          journalApprovalThreshold: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
              ) : null}

              {active === "Tax" ? (
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field
                    label="Default Tax Scheme"
                    hint="Example: Standard VAT, GST, or Sales Tax."
                  >
                    <input
                      className={input}
                      value={form.defaultTaxScheme}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          defaultTaxScheme: event.target.value,
                        }))
                      }
                      placeholder="Standard VAT"
                    />
                  </Field>

                  <Field label="Calculation Method">
                    <select
                      className={input}
                      value={form.taxCalculationMethod}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          taxCalculationMethod: event.target.value,
                        }))
                      }
                    >
                      <option value="exclusive">Tax exclusive</option>
                      <option value="inclusive">Tax inclusive</option>
                    </select>
                  </Field>
                </div>
              ) : null}

              {active === "Period Locking" ? (
                <div className="mt-5 grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-2">
                  <Field
                    label="Lock Date"
                    hint="No posting or editing is allowed on or before this date."
                  >
                    <input
                      className={input}
                      type="date"
                      value={form.lockDate}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          lockDate: event.target.value,
                        }))
                      }
                    />
                  </Field>

                  <ToggleCard
                    title="Require bank reconciliation"
                    description="Prevent period closing until the related bank accounts are reconciled."
                    checked={form.periodCloseRequireReconciliation}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        periodCloseRequireReconciliation: event.target.checked,
                      }))
                    }
                  />
                </div>
              ) : null}
            </>
          )}
        </section>

        <div className={cn(card, "mt-5 p-4 sm:p-5")}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Icon icon={CheckmarkCircle02Icon} size={18} />
              </span>
              <div>
                <p className="text-sm font-black text-gray-900">
                  Save accounting configuration
                </p>
                <p className="mt-0.5 text-xs font-medium leading-5 text-gray-500">
                  Changes apply across journals, invoices, payments, reports, and period controls.
                </p>
              </div>
            </div>

            <button
              type="submit"
              className={cn(button, buttonPrimary, "w-full sm:w-auto")}
              disabled={saving || loading}
            >
              <span className={saving ? "animate-pulse" : ""}>
                <Icon icon={FloppyDiskIcon} size={17} />
              </span>
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
