"use client"

import { useEffect, useMemo, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { FiBarChart2, FiCheck, FiFilter, FiRefreshCcw, FiSearch, FiX } from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const card =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_35px_-28px_rgba(15,23,42,0.55)]"

const btn =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"

const btnPrimary = "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
const btnGhost = "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"

const input =
  "h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"

const searchWrap = [
  "rounded-2xl border border-gray-200 bg-white",
  "px-3 py-1 sm:px-3.5 sm:py-1",
  "min-h-[40px] sm:min-h-[42px]",
  "flex items-center gap-2 flex-wrap",
  "transition shadow-none",
  "focus-within:border-indigo-300",
  "focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.14)]",
].join(" ")

const searchInput = [
  "flex-1 min-w-[10rem] bg-transparent",
  "text-sm font-semibold text-gray-900 placeholder:text-gray-400",
  "border-0 outline-none ring-0 shadow-none appearance-none",
  "h-8 sm:h-9",
  "focus:outline-none focus:ring-0 focus:shadow-none",
].join(" ")

function cn(...classes) {
  return classes.filter(Boolean).join(" ")
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

export default function TaxReport() {
  const [report, setReport] = useState({
    rows: [],
    employeeSummary: [],
    totals: {},
  })

  const [query, setQuery] = useState("")

  const [filters, setFilters] = useState({
    fiscalYear: String(new Date().getFullYear()),
    year: new Date().getFullYear(),
    month: "",
  })

  const [filterDraft, setFilterDraft] = useState(filters)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = async (nextFilters = filters) => {
    setLoading(true)

    try {
      const params = new URLSearchParams()

      if (nextFilters.fiscalYear) params.set("fiscalYear", nextFilters.fiscalYear)
      if (nextFilters.year) params.set("year", nextFilters.year)
      if (nextFilters.month) params.set("month", nextFilters.month)

      const data = await api(`/tax/reports?${params.toString()}`)

      setReport(data || { rows: [], employeeSummary: [], totals: {} })
    } catch (error) {
      toast.error(error.message || "Failed to load tax report")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()

    if (!q) return report.rows || []

    return (report.rows || []).filter((row) => {
      const haystack = [
        row.employee?.name,
        row.employee?.email,
        row.employee?.employeeId,
        row.fiscalYear,
        row.year,
        row.month,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return haystack.includes(q)
    })
  }, [query, report.rows])

  const activeFilterEntries = [
    filters.fiscalYear
      ? {
          key: "fiscalYear",
          label: `Fiscal Year: ${filters.fiscalYear}`,
        }
      : null,
    filters.year
      ? {
          key: "year",
          label: `Year: ${filters.year}`,
        }
      : null,
    filters.month
      ? {
          key: "month",
          label: `Month: ${filters.month}`,
        }
      : null,
  ].filter(Boolean)

  const applyFilters = async () => {
    setFilters(filterDraft)
    setFiltersOpen(false)
    await load(filterDraft)
  }

  const clearFilters = async () => {
    const next = {
      fiscalYear: "",
      year: "",
      month: "",
    }

    setFilterDraft(next)
    setFilters(next)
    setFiltersOpen(false)

    await load(next)
  }

  const clearSingleFilter = async (key) => {
    const next = {
      ...filters,
      [key]: "",
    }

    setFilters(next)
    setFilterDraft(next)

    await load(next)
  }

  const markRemitted = async (row) => {
    if (!row?.payrollId) return
    try {
      await api("/tax/reports/remittance", {
        method: "PATCH",
        body: JSON.stringify({
          payrollIds: [row.payrollId],
          remitted: true,
        }),
      })
      toast.success("Tax remittance marked")
      await load()
    } catch (error) {
      toast.error(error.message || "Remittance update failed")
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f7fb] p-4 sm:p-6 lg:p-8">
      <Toaster position="top-right" />

      <div className={`${card} mb-6 p-5 sm:p-6`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white">
              <FiBarChart2 className="h-5 w-5" />
            </div>

            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
                Tax Deduction Report
              </h1>
              <p className="mt-1 text-sm font-semibold text-gray-500">
                Monthly and employee-wise Tax/TDS summary.
              </p>
            </div>
          </div>

          <button className={`${btn} ${btnGhost}`} onClick={() => load()} disabled={loading}>
            <FiRefreshCcw className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="w-full xl:max-w-[760px]">
            <div className={searchWrap}>
              <FiSearch className="h-4 w-4 shrink-0 text-gray-400" />

              {activeFilterEntries.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => clearSingleFilter(filter.key)}
                  className="inline-flex max-w-[150px] items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 ring-1 ring-indigo-600/10 transition hover:bg-indigo-100"
                  title="Remove filter"
                >
                  <span className="truncate">{filter.label}</span>
                  <FiX className="h-3.5 w-3.5 shrink-0" />
                </button>
              ))}

              <input
                className={searchInput}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={
                  activeFilterEntries.length
                    ? "Search..."
                    : "Search employee, email, fiscal year..."
                }
              />

              <button
                type="button"
                className={cn(
                  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-bold transition active:scale-[0.99]",
                  activeFilterEntries.length ? btnPrimary : btnGhost
                )}
                onClick={() => {
                  setFilterDraft(filters)
                  setFiltersOpen(true)
                }}
              >
                <FiFilter className="h-3.5 w-3.5" />
                Filters

                {activeFilterEntries.length ? (
                  <span className="rounded-full bg-white/20 px-1.5 text-[10px]">
                    {activeFilterEntries.length}
                  </span>
                ) : null}
              </button>
            </div>
          </div>

          <p className="text-sm font-black text-gray-600">
            Showing <span className="text-gray-900">{filteredRows.length}</span> report row
            {filteredRows.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4 xl:grid-cols-6">
        <div className={`${card} p-5`}>
          <p className="text-sm font-bold text-gray-500">Total Gross</p>
          <p className="mt-2 text-3xl font-black text-gray-900">
            {money(report.totals?.grossSalary)}
          </p>
        </div>

        <div className={`${card} p-5`}>
          <p className="text-sm font-bold text-gray-500">Tax Deducted</p>
          <p className="mt-2 text-3xl font-black text-rose-600">
            {money(report.totals?.taxDeduction)}
          </p>
        </div>

        <div className={`${card} p-5`}>
          <p className="text-sm font-bold text-gray-500">Yearly Liability</p>
          <p className="mt-2 text-3xl font-black text-gray-900">
            {money(report.totals?.yearlyTax)}
          </p>
        </div>

        <div className={`${card} p-5`}>
          <p className="text-sm font-bold text-gray-500">Remaining Tax</p>
          <p className="mt-2 text-3xl font-black text-amber-600">
            {money(report.totals?.remainingTax)}
          </p>
        </div>

        <div className={`${card} p-5`}>
          <p className="text-sm font-bold text-gray-500">Employees</p>
          <p className="mt-2 text-3xl font-black text-gray-900">
            {report.totals?.salaryProfileEmployees || report.employeeSummary?.length || 0}
          </p>
        </div>

        <div className={`${card} p-5`}>
          <p className="text-sm font-bold text-gray-500">Tax Active</p>
          <p className="mt-2 text-3xl font-black text-emerald-600">
            {report.totals?.taxEnabledEmployees || 0}
          </p>
        </div>
      </div>

      <div className={`${card} overflow-hidden`}>
        <div className="h-[520px] overflow-auto lg:h-[560px]">
          <table className="min-w-full text-left">
            <thead className="sticky top-0 z-10 bg-gray-50 text-xs font-black uppercase text-gray-500 shadow-[0_1px_0_rgba(229,231,235,1)]">
              <tr>
                <th className="px-5 py-3">Employee</th>
                <th className="px-5 py-3">Period</th>
                <th className="px-5 py-3">Fiscal Year</th>
                <th className="px-5 py-3">Gross</th>
                <th className="px-5 py-3">Taxable</th>
                <th className="px-5 py-3">Yearly Tax</th>
                <th className="px-5 py-3">Tax</th>
                <th className="px-5 py-3">Remittance</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {filteredRows.map((row) => (
                <tr key={row.payrollId} className="bg-white transition hover:bg-gray-50/70">
                  <td className="px-5 py-4">
                    <div>
                      <p className="text-sm font-black text-gray-900">
                        {row.employee?.name || "-"}
                      </p>

                      {row.employee?.email ? (
                        <p className="mt-0.5 text-xs font-semibold text-gray-500">
                          {row.employee.email}
                        </p>
                      ) : null}
                    </div>
                  </td>

                  <td className="px-5 py-4 text-sm font-semibold text-gray-700">
                    {row.month}/{row.year}
                  </td>

                  <td className="px-5 py-4 text-sm font-semibold text-gray-700">
                    {row.fiscalYear || "-"}
                  </td>

                  <td className="px-5 py-4 text-sm font-semibold text-gray-700">
                    {money(row.grossSalary)}
                  </td>

                  <td className="px-5 py-4 text-sm font-semibold text-gray-700">
                    {money(row.taxableIncome)}
                  </td>

                  <td className="px-5 py-4 text-sm font-semibold text-gray-700">
                    {money(row.yearlyTax)}
                  </td>

                  <td className="px-5 py-4 text-sm font-black text-rose-600">
                    {money(row.taxDeduction)}
                  </td>

                  <td className="px-5 py-4 text-sm font-bold text-gray-700">
                    {row.remittanceStatus === "remitted" ? "Remitted" : row.remittanceStatus === "pending" ? "Pending" : "-"}
                  </td>

                  <td className="px-5 py-4 text-right">
                    {row.remittanceStatus === "pending" ? (
                      <button className={`${btn} ${btnGhost} px-3 py-2`} type="button" onClick={() => markRemitted(row)}>
                        <FiCheck className="h-3.5 w-3.5" />
                        Mark
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}

              {!filteredRows.length ? (
                <tr>
                  <td
                    colSpan={9}
                    className="h-[420px] px-5 py-10 text-center text-sm font-bold text-gray-500"
                  >
                    No payroll tax rows found for this filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className={`${card} mt-6 overflow-hidden`}>
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-extrabold text-gray-900">Employee Tax Summary</h2>
        </div>
        <div className="max-h-[460px] overflow-auto">
          <table className="min-w-full text-left">
            <thead className="sticky top-0 z-10 bg-gray-50 text-xs font-black uppercase text-gray-500 shadow-[0_1px_0_rgba(229,231,235,1)]">
              <tr>
                <th className="px-5 py-3">Employee</th>
                <th className="px-5 py-3">Salary Profile</th>
                <th className="px-5 py-3">Tax Method</th>
                <th className="px-5 py-3">Months</th>
                <th className="px-5 py-3">Earned Gross</th>
                <th className="px-5 py-3">Taxable Income</th>
                <th className="px-5 py-3">Yearly Tax</th>
                <th className="px-5 py-3">Remaining</th>
                <th className="px-5 py-3">Tax Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(report.employeeSummary || []).map((item) => (
                <tr key={item.employee?._id || item.employee?.employeeId || item.employee?.email} className="bg-white transition hover:bg-gray-50/70">
                  <td className="px-5 py-4">
                    <p className="text-sm font-black text-gray-900">{item.employee?.name || "-"}</p>
                    <p className="mt-0.5 text-xs font-semibold text-gray-500">{item.employee?.email || item.employee?.employeeId || "-"}</p>
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-gray-700">
                    {item.salaryProfile ? money(item.salaryProfile.basicSalary) : "-"}
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-gray-700">
                    {item.taxProfile?.mode === "disabled"
                      ? "Disabled"
                      : item.taxProfile?.mode === "override"
                      ? `Override: ${String(item.taxProfile.method || "slab").toUpperCase()}`
                      : "Auto Slab"}
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-gray-700">{item.months || 0}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-gray-700">{money(item.grossSalary)}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-gray-700">{money(item.taxableIncome)}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-gray-700">{money(item.yearlyTax)}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-amber-700">{money(item.remainingTax)}</td>
                  <td className="px-5 py-4 text-sm font-black text-rose-600">{money(item.totalTax)}</td>
                </tr>
              ))}
              {!(report.employeeSummary || []).length ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-sm font-bold text-gray-500">
                    No salary-profile employees found for this filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {filtersOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-gray-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 p-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white">
                  <FiFilter className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <h2 className="truncate text-xl font-extrabold text-gray-900">
                    Tax Report Filters
                  </h2>
                  <p className="truncate text-sm font-semibold text-gray-500">
                    Filter report by fiscal year, payroll year, and month.
                  </p>
                </div>
              </div>

              <button
                className="rounded-xl p-2 transition hover:bg-gray-100"
                type="button"
                onClick={() => setFiltersOpen(false)}
                aria-label="Close filters"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-gray-800">
                  Fiscal Year
                </span>
                <input
                  className={input}
                  value={filterDraft.fiscalYear}
                  onChange={(e) =>
                    setFilterDraft((p) => ({
                      ...p,
                      fiscalYear: e.target.value,
                    }))
                  }
                  placeholder="All fiscal years"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-gray-800">
                  Payroll Year
                </span>
                <input
                  className={input}
                  type="number"
                  value={filterDraft.year}
                  onChange={(e) =>
                    setFilterDraft((p) => ({
                      ...p,
                      year: e.target.value,
                    }))
                  }
                  placeholder="All years"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="mb-1.5 block text-sm font-bold text-gray-800">
                  Month
                </span>
                <select
                  className={input}
                  value={filterDraft.month}
                  onChange={(e) =>
                    setFilterDraft((p) => ({
                      ...p,
                      month: e.target.value,
                    }))
                  }
                >
                  <option value="">All months</option>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-100 p-5">
              <button className={`${btn} ${btnGhost}`} type="button" onClick={clearFilters}>
                Clear All
              </button>

              <button className={`${btn} ${btnPrimary}`} type="button" onClick={applyFilters}>
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
