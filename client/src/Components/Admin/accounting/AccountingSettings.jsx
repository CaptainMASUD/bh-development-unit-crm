"use client"
/* eslint-disable react/prop-types, react-refresh/only-export-components -- internal settings primitives and exported settings contract coexist */

import { useCallback, useEffect, useMemo, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  FloppyDiskIcon,
  HierarchySquare01Icon,
  RefreshIcon,
  UnavailableIcon,
} from "@hugeicons/core-free-icons"

const API_ORIGIN = import.meta.env.VITE_API_URL || ""
const API_BASE = `${API_ORIGIN.replace(/\/$/, "")}/api`

const styles = {
  page: "min-h-screen bg-gray-50 px-4 py-5 sm:px-6 lg:px-8",
  card:
    "rounded-2xl border border-gray-200/80 bg-white shadow-[0_12px_32px_-26px_rgba(15,23,42,0.38)]",
  input:
    "h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm font-semibold text-gray-900 outline-none transition placeholder:text-gray-300 hover:border-gray-300 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500",
  button:
    "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60",
}

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

const createRule = (prefix) => ({
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
  cogsAccount: "",
  receivableAccount: "",
  payableAccount: "",
  inventoryAccount: "",
  inventoryClearingAccount: "",
  purchasePriceVarianceAccount: "",
  inventoryAdjustmentAccount: "",
  inventoryRevaluationAccount: "",
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
    journal: createRule("JV"),
    invoice: createRule("INV"),
    voucher: createRule("PV"),
    bill: createRule("BILL"),
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

const sectionTitles = {
  General: "Company & accounting basis",
  Currency: "Currency & rounding",
  Numbering: "Document numbering rules",
  "Default Accounts": "Default control accounts",
  Approval: "Approval controls",
  Tax: "Tax defaults",
  "Period Locking": "Global posting lock",
}

export const ACCOUNT_FIELDS = [
  ["defaultCashAccount", "Default Cash"],
  ["defaultBankAccount", "Default Bank"],
  ["salesAccount", "Sales / Income"],
  ["purchaseAccount", "Purchases"],
  ["cogsAccount", "Cost of Goods Sold"],
  ["receivableAccount", "Accounts Receivable Control"],
  ["payableAccount", "Accounts Payable Control"],
  ["inventoryAccount", "Inventory Control"],
  ["inventoryClearingAccount", "Goods Received Not Invoiced"],
  ["purchasePriceVarianceAccount", "Purchase Price Variance"],
  ["inventoryAdjustmentAccount", "Inventory Adjustment Gain / Loss"],
  ["inventoryRevaluationAccount", "Inventory Revaluation Gain / Loss"],
  ["furnitureAccount", "Furniture"],
  ["loanAccount", "Loan"],
  ["payrollExpenseAccount", "Payroll Expense"],
  ["payrollPayableAccount", "Payroll Payable"],
  ["retainedEarningsAccount", "Retained Earnings"],
  ["exchangeGainAccount", "Exchange Gain"],
  ["exchangeLossAccount", "Exchange Loss"],
  ["roundingAccount", "Rounding Off"],
  ["vatPayableAccount", "VAT Payable"],
  ["vatReceivableAccount", "VAT Receivable"],
]

const accountFields = ACCOUNT_FIELDS

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

function getHeaders() {
  const token =
    typeof window !== "undefined" ? window.localStorage.getItem("token") : null

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
      ...getHeaders(),
      ...(options.headers || {}),
    },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Request failed")
  }

  return data
}

function Field({ label, error, children, className = "" }) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="mb-1.5 block text-sm font-bold text-gray-800">
        {label}
      </span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-xs font-semibold text-amber-700">
          {error}
        </span>
      ) : null}
    </label>
  )
}

function Toggle({ title, checked, disabled = false, onChange }) {
  return (
    <label
      className={cn(
        "flex h-11 cursor-pointer items-center justify-between gap-4 rounded-xl border px-3.5 transition",
        checked
          ? "border-indigo-200 bg-indigo-50/70"
          : "border-gray-200 bg-white hover:border-gray-300",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <span className="truncate text-sm font-bold text-gray-800">{title}</span>

      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition",
          checked ? "bg-indigo-600" : "bg-gray-200"
        )}
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          disabled={disabled}
          onChange={onChange}
        />
        <span
          className={cn(
            "absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all",
            checked ? "left-6" : "left-1"
          )}
        />
      </span>
    </label>
  )
}

function LoadingPanel() {
  return (
    <div className="flex min-h-[260px] items-center justify-center">
      <div className="flex items-center gap-2.5 text-sm font-bold text-gray-600">
        <Icon
          icon={RefreshIcon}
          size={20}
          strokeWidth={2}
          className="animate-spin text-indigo-600"
        />
        Loading settings...
      </div>
    </div>
  )
}

function SectionHeading({ title }) {
  return (
    <div className="border-b border-gray-100 pb-4">
      <h2 className="text-lg font-black tracking-tight text-gray-950">
        {title}
      </h2>
    </div>
  )
}

const idOf = (value) => value?._id || value || ""

function dateValue(value) {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10)
}

export default function AccountingSettings() {
  const [form, setForm] = useState(emptyForm)
  const [accounts, setAccounts] = useState([])
  const [accountOptions, setAccountOptions] = useState({})
  const [fiscalYears, setFiscalYears] = useState([])
  const [active, setActive] = useState("General")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const load = useCallback(async () => {
    setLoading(true)

    try {
      const [settingsData, accountData, fiscalData] = await Promise.all([
        api("/accounting/settings"),
        api("/accounting/accounts?limit=200"),
        api("/accounting/fiscal-years"),
      ])

      const settings = settingsData?.settings || {}
      const loadedAccounts = accountData?.accounts || []
      const loadedFiscalYears = fiscalData?.fiscalYears || []

      setAccounts(loadedAccounts)
      setAccountOptions(settingsData?.accountOptions || {})
      setFiscalYears(loadedFiscalYears)
      setForm({
        ...emptyForm,
        ...settings,
        defaultFiscalYear: idOf(settings.defaultFiscalYear),
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

  const hasPostableAccounts = useMemo(
    () =>
      accounts.some(
        (account) => !account.isGroup && account.isActive !== false
      ),
    [accounts]
  )

  const updateRule = (kind, key, value) => {
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
      await api("/accounting/settings", {
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

      toast.success("Accounting settings saved")
    } catch (error) {
      toast.error(error?.message || "Unable to save accounting settings")
    } finally {
      setSaving(false)
    }
  }

  const renderAccountSelect = (key, label) => {
    const options = accountOptions[key] || []
    const selectedId = String(form[key] || "")
    const selectedAccount = selectedId
      ? accounts.find((account) => String(account._id) === selectedId)
      : null
    const isEligible =
      !selectedId ||
      options.some((account) => String(account._id) === selectedId)
    const error = !isEligible
      ? "The saved account is no longer eligible."
      : ""

    return (
      <Field key={key} label={label} error={error}>
        <select
          className={cn(styles.input, error && "border-amber-300")}
          value={form[key]}
          disabled={!options.length && !selectedId}
          onChange={(event) => updateForm(key, event.target.value)}
        >
          <option value="">
            {options.length ? "Not configured" : "No eligible account"}
          </option>

          {!isEligible ? (
            <option value={selectedId} disabled>
              {selectedAccount
                ? `${selectedAccount.code} — ${selectedAccount.name} (not eligible)`
                : "Previously configured account (not eligible)"}
            </option>
          ) : null}

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
    <div className={styles.page}>
      <Toaster position="top-right" />

      <header className={cn(styles.card, "mb-4 p-4 sm:p-5")}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
              <Icon icon={HierarchySquare01Icon} size={21} strokeWidth={2} />
            </div>
            <h1 className="truncate text-xl font-black tracking-tight text-gray-950 sm:text-2xl">
              Accounting Settings
            </h1>
          </div>

          <button
            type="button"
            className={cn(
              styles.button,
              "shrink-0 border border-gray-200 bg-white px-3 text-gray-700 hover:border-gray-300 hover:bg-gray-50 sm:px-4"
            )}
            onClick={load}
            disabled={loading || saving}
            aria-label="Refresh accounting settings"
          >
            <Icon
              icon={RefreshIcon}
              size={17}
              className={loading ? "animate-spin" : ""}
            />
            <span className="hidden sm:inline">
              {loading ? "Refreshing..." : "Refresh"}
            </span>
          </button>
        </div>
      </header>

      <form onSubmit={save}>
        <nav className={cn(styles.card, "mb-4 overflow-x-auto p-2")}>
          <div className="flex min-w-max gap-1">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActive(tab)}
                className={cn(
                  "rounded-xl px-4 py-2.5 text-sm font-black transition",
                  active === tab
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/15"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </nav>

        <section className={cn(styles.card, "p-4 sm:p-5 lg:p-6")}>
          {loading ? (
            <LoadingPanel />
          ) : (
            <>
              <SectionHeading
                title={sectionTitles[active] || sectionTitles.General}
              />

              {active === "General" ? (
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <Field label="Legal Company Name">
                    <input
                      className={styles.input}
                      value={form.legalName}
                      onChange={(event) =>
                        updateForm("legalName", event.target.value)
                      }
                      placeholder="Business Hub BD"
                    />
                  </Field>

                  <Field label="Tax ID">
                    <input
                      className={styles.input}
                      value={form.taxId}
                      onChange={(event) =>
                        updateForm("taxId", event.target.value)
                      }
                      placeholder="Enter tax ID"
                    />
                  </Field>

                  <Field label="VAT Registration">
                    <input
                      className={styles.input}
                      value={form.vatRegistrationNumber}
                      onChange={(event) =>
                        updateForm("vatRegistrationNumber", event.target.value)
                      }
                      placeholder="Enter VAT number"
                    />
                  </Field>

                  <Field
                    label="Company Address"
                    className="md:col-span-2 xl:col-span-3"
                  >
                    <input
                      className={styles.input}
                      value={form.address}
                      onChange={(event) =>
                        updateForm("address", event.target.value)
                      }
                      placeholder="Enter business address"
                    />
                  </Field>

                  <Field label="Accounting Method">
                    <select
                      className={styles.input}
                      value={form.accountingMethod}
                      onChange={(event) =>
                        updateForm("accountingMethod", event.target.value)
                      }
                    >
                      <option value="accrual">Accrual</option>
                      <option value="cash">Cash basis</option>
                    </select>
                  </Field>

                  <Field label="Default Fiscal Year">
                    <select
                      className={styles.input}
                      value={form.defaultFiscalYear}
                      disabled={!fiscalYears.length}
                      onChange={(event) =>
                        updateForm("defaultFiscalYear", event.target.value)
                      }
                    >
                      <option value="">
                        {fiscalYears.length
                          ? "Not configured"
                          : "No fiscal year available"}
                      </option>
                      {fiscalYears.map((fiscalYear) => (
                        <option key={fiscalYear._id} value={fiscalYear._id}>
                          {fiscalYear.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Fiscal Year Start Month">
                    <select
                      className={styles.input}
                      value={form.fiscalYearStartMonth}
                      onChange={(event) =>
                        updateForm("fiscalYearStartMonth", event.target.value)
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
                      className={styles.input}
                      type="number"
                      min="1"
                      max="31"
                      value={form.fiscalYearStartDay}
                      onChange={(event) =>
                        updateForm("fiscalYearStartDay", event.target.value)
                      }
                    />
                  </Field>
                </div>
              ) : null}

              {active === "Currency" ? (
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <Field label="Base Currency">
                    <input
                      className={styles.input}
                      value={form.currency}
                      maxLength={3}
                      onChange={(event) =>
                        updateForm(
                          "currency",
                          event.target.value.toUpperCase()
                        )
                      }
                      placeholder="BDT"
                    />
                  </Field>

                  <Field label="Rounding Precision">
                    <select
                      className={styles.input}
                      value={form.roundingPrecision}
                      onChange={(event) =>
                        updateForm("roundingPrecision", event.target.value)
                      }
                    >
                      {[0, 1, 2, 3, 4].map((number) => (
                        <option key={number} value={number}>
                          {number} decimal places
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Multi-currency">
                    <Toggle
                      title="Enable multi-currency"
                      checked={form.multiCurrencyEnabled}
                      onChange={(event) =>
                        updateForm(
                          "multiCurrencyEnabled",
                          event.target.checked
                        )
                      }
                    />
                  </Field>
                </div>
              ) : null}

              {active === "Numbering" ? (
                <div className="mt-5 space-y-3">
                  {Object.entries(form.numberingRules).map(([kind, item]) => (
                    <div
                      key={kind}
                      className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-100 p-4 md:grid-cols-[120px_110px_120px_180px_minmax(220px,1fr)]"
                    >
                      <div className="self-center text-sm font-black capitalize text-gray-900">
                        {kind}
                      </div>

                      <input
                        className={styles.input}
                        value={item.prefix}
                        onChange={(event) =>
                          updateRule(
                            kind,
                            "prefix",
                            event.target.value.toUpperCase()
                          )
                        }
                        placeholder="Prefix"
                        aria-label={`${kind} prefix`}
                      />

                      <input
                        className={styles.input}
                        type="number"
                        min="3"
                        max="12"
                        value={item.digitLength}
                        onChange={(event) =>
                          updateRule(kind, "digitLength", event.target.value)
                        }
                        aria-label={`${kind} digit length`}
                      />

                      <select
                        className={styles.input}
                        value={item.reset}
                        onChange={(event) =>
                          updateRule(kind, "reset", event.target.value)
                        }
                        aria-label={`${kind} reset frequency`}
                      >
                        <option value="fiscal_year">Fiscal year</option>
                        <option value="calendar_year">Calendar year</option>
                        <option value="monthly">Monthly</option>
                        <option value="never">Never</option>
                      </select>

                      <input
                        className={styles.input}
                        value={item.format}
                        onChange={(event) =>
                          updateRule(kind, "format", event.target.value)
                        }
                        placeholder="{PREFIX}-{FY}-{NUMBER}"
                        aria-label={`${kind} number format`}
                      />
                    </div>
                  ))}
                </div>
              ) : null}

              {active === "Default Accounts" ? (
                <div className="mt-5">
                  {!hasPostableAccounts ? (
                    <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm font-bold text-amber-800">
                      <Icon icon={UnavailableIcon} size={17} strokeWidth={2} />
                      Create an active postable account first.
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
                    {accountFields.map(([key, label]) =>
                      renderAccountSelect(key, label)
                    )}
                  </div>
                </div>
              ) : null}

              {active === "Approval" ? (
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Accounting Approval">
                    <Toggle
                      title="Require accounting approvals"
                      checked={form.approvalEnabled}
                      onChange={(event) =>
                        updateForm("approvalEnabled", event.target.checked)
                      }
                    />
                  </Field>

                  <Field label="Journal Approval Threshold">
                    <input
                      className={styles.input}
                      type="number"
                      min="0"
                      step="0.01"
                      disabled={!form.approvalEnabled}
                      value={form.journalApprovalThreshold}
                      onChange={(event) =>
                        updateForm(
                          "journalApprovalThreshold",
                          event.target.value
                        )
                      }
                    />
                  </Field>
                </div>
              ) : null}

              {active === "Tax" ? (
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Default Tax Scheme">
                    <input
                      className={styles.input}
                      value={form.defaultTaxScheme}
                      onChange={(event) =>
                        updateForm("defaultTaxScheme", event.target.value)
                      }
                      placeholder="Standard VAT"
                    />
                  </Field>

                  <Field label="Calculation Method">
                    <select
                      className={styles.input}
                      value={form.taxCalculationMethod}
                      onChange={(event) =>
                        updateForm("taxCalculationMethod", event.target.value)
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
                  <Field label="Lock Date">
                    <input
                      className={styles.input}
                      type="date"
                      value={form.lockDate}
                      onChange={(event) =>
                        updateForm("lockDate", event.target.value)
                      }
                    />
                  </Field>

                  <Field label="Period Closing">
                    <Toggle
                      title="Require bank reconciliation"
                      checked={form.periodCloseRequireReconciliation}
                      onChange={(event) =>
                        updateForm(
                          "periodCloseRequireReconciliation",
                          event.target.checked
                        )
                      }
                    />
                  </Field>
                </div>
              ) : null}
            </>
          )}
        </section>

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            className={cn(
              styles.button,
              "w-full bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-700 sm:w-auto"
            )}
            disabled={saving || loading}
          >
            <Icon
              icon={FloppyDiskIcon}
              size={17}
              className={saving ? "animate-pulse" : ""}
            />
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  )
}
