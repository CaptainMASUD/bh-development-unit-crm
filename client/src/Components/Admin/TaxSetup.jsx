"use client"

import { useEffect, useMemo, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { FiBarChart2, FiEdit3, FiPlus, FiRefreshCcw, FiSave, FiTrash2, FiX } from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_35px_-28px_rgba(15,23,42,0.55)]"
const btn = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
const btnPrimary = "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
const btnGhost = "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
const btnDanger = "bg-rose-600 text-white hover:bg-rose-700"
const input = "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"

const emptySlab = {
  fiscalYear: String(new Date().getFullYear()),
  taxpayerType: "general",
  minIncome: 0,
  maxIncome: "",
  rate: 0,
  fixedAmount: 0,
  isActive: true,
}

const emptyProfile = {
  mode: "auto",
  enabled: true,
  tin: "",
  fiscalYear: "",
  fiscalYearStartMonth: 1,
  taxpayerType: "general",
  method: "slab",
  percentage: 0,
  fixedAmount: 0,
  exemptionAmount: 0,
  investmentAmount: 0,
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
  return new Intl.NumberFormat("en-BD", { maximumFractionDigits: 0 }).format(Number(value || 0))
}

function pretty(value) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

function Field({ label, children }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-bold text-gray-800">{label}</span>{children}</label>
}

function normalizeProfile(profile = {}) {
  const mode = ["auto", "override", "disabled"].includes(profile.mode) ? profile.mode : profile.enabled === false ? "disabled" : "auto"
  return {
    ...emptyProfile,
    ...profile,
    mode,
    enabled: mode !== "disabled",
    method: mode === "override" ? profile.method || "slab" : "slab",
  }
}

export default function TaxSetup() {
  const [activeTab, setActiveTab] = useState("slabs")
  const [slabs, setSlabs] = useState([])
  const [employees, setEmployees] = useState([])
  const [slabForm, setSlabForm] = useState(emptySlab)
  const [editingSlab, setEditingSlab] = useState(null)
  const [slabModalOpen, setSlabModalOpen] = useState(false)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("")
  const [profileForm, setProfileForm] = useState(emptyProfile)
  const [filters] = useState({ fiscalYear: String(new Date().getFullYear()) })
  const [loading, setLoading] = useState(false)

  const selectedEmployee = useMemo(
    () => employees.find((employee) => String(employee._id) === String(selectedEmployeeId)) || null,
    [employees, selectedEmployeeId]
  )

  const fiscalYearOptions = useMemo(
    () => [...new Set(slabs.map((slab) => slab.fiscalYear).filter(Boolean))],
    [slabs]
  )

  const taxpayerTypeOptions = useMemo(
    () => [...new Set(slabs.map((slab) => slab.taxpayerType).filter(Boolean))],
    [slabs]
  )

  const matchingSlabCount = useMemo(() => {
    const fiscalYear = String(profileForm.fiscalYear || filters.fiscalYear || "").trim()
    const taxpayerType = String(profileForm.taxpayerType || "general").trim().toLowerCase()
    if (profileForm.mode === "disabled" || (profileForm.mode === "override" && profileForm.method !== "slab") || !fiscalYear) return 0
    return slabs.filter(
      (slab) =>
        String(slab.fiscalYear || "").trim() === fiscalYear &&
        String(slab.taxpayerType || "general").trim().toLowerCase() === taxpayerType &&
        slab.isActive !== false
    ).length
  }, [filters.fiscalYear, profileForm.fiscalYear, profileForm.method, profileForm.taxpayerType, slabs])

  const tabs = [
    { key: "slabs", label: "Tax Slabs", count: slabs.length },
    { key: "employees", label: "Employee Tax Overrides", count: employees.filter((employee) => employee.taxProfile?.mode && employee.taxProfile.mode !== "auto").length },
  ]

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.fiscalYear) params.set("fiscalYear", filters.fiscalYear)
      const [slabRes, employeeRes] = await Promise.all([
        api(`/tax/slabs?${params.toString()}`),
        api("/tax/employee-profiles?limit=300"),
      ])
      setSlabs(slabRes.slabs || [])
      setEmployees(employeeRes.employees || [])
    } catch (error) {
      toast.error(error.message || "Failed to load tax setup")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedEmployee) return
    setProfileForm(normalizeProfile(selectedEmployee.taxProfile || {}))
  }, [selectedEmployee])

  const saveSlab = async (event) => {
    event.preventDefault()
    const payload = {
      ...slabForm,
      minIncome: Number(slabForm.minIncome || 0),
      maxIncome: slabForm.maxIncome === "" ? null : Number(slabForm.maxIncome || 0),
      rate: Number(slabForm.rate || 0),
      fixedAmount: Number(slabForm.fixedAmount || 0),
    }
    try {
      const data = await api(editingSlab?._id ? `/tax/slabs/${editingSlab._id}` : "/tax/slabs", {
        method: editingSlab?._id ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      })
      const autoAssigned = Number(data?.autoAssigned?.modified || 0)
      toast.success(
        autoAssigned
          ? `${editingSlab ? "Tax slab updated" : "Tax slab created"} and applied to ${autoAssigned} salary profile employee${autoAssigned === 1 ? "" : "s"}`
          : editingSlab ? "Tax slab updated" : "Tax slab created"
      )
      setEditingSlab(null)
      setSlabForm(emptySlab)
      setSlabModalOpen(false)
      await load()
    } catch (error) {
      toast.error(error.message || "Save failed")
    }
  }

  const editSlab = (slab) => {
    setEditingSlab(slab)
    setSlabForm({
      fiscalYear: slab.fiscalYear || "",
      taxpayerType: slab.taxpayerType || "general",
      minIncome: slab.minIncome || 0,
      maxIncome: slab.maxIncome ?? "",
      rate: slab.rate || 0,
      fixedAmount: slab.fixedAmount || 0,
      isActive: slab.isActive !== false,
    })
    setSlabModalOpen(true)
  }

  const openSlabModal = () => {
    setEditingSlab(null)
    setSlabForm(emptySlab)
    setSlabModalOpen(true)
  }

  const deleteSlab = async (slab) => {
    if (!window.confirm(`Delete tax slab for ${slab.fiscalYear}?`)) return
    try {
      await api(`/tax/slabs/${slab._id}`, { method: "DELETE" })
      toast.success("Tax slab deleted")
      await load()
    } catch (error) {
      toast.error(error.message || "Delete failed")
    }
  }

  const saveProfile = async (event) => {
    event.preventDefault()
    if (!selectedEmployeeId) return toast.error("Select an employee first")
    const mode = profileForm.mode || "auto"
    const method = mode === "override" ? profileForm.method || "slab" : "slab"
    try {
      await api(`/tax/employee-profiles/${selectedEmployeeId}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...profileForm,
          mode,
          enabled: mode !== "disabled",
          method,
          percentage: mode === "override" && method === "percentage" ? Number(profileForm.percentage || 0) : 0,
          fixedAmount: mode === "override" && method === "fixed" ? Number(profileForm.fixedAmount || 0) : 0,
          exemptionAmount: mode !== "disabled" ? Number(profileForm.exemptionAmount || 0) : 0,
          investmentAmount: mode !== "disabled" ? Number(profileForm.investmentAmount || 0) : 0,
        }),
      })
      toast.success("Employee tax override saved")
      await load()
    } catch (error) {
      toast.error(error.message || "Override save failed")
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f7fb] p-4 sm:p-6 lg:p-8">
      <Toaster position="top-right" />
      <div className={`${card} mb-6 p-5 sm:p-6`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white"><FiBarChart2 /></div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Tax / TDS Setup</h1>
              <p className="mt-1 text-sm font-semibold text-gray-500">Manage fiscal-year slabs and employee tax exceptions.</p>
            </div>
          </div>
          <button className={`${btn} ${btnGhost}`} onClick={load} disabled={loading}><FiRefreshCcw className={loading ? "animate-spin" : ""} />Refresh</button>
        </div>
      </div>

      <div className={`${card} mb-6 overflow-hidden`}>
        <div className="flex min-w-max gap-1 overflow-x-auto p-2" role="tablist" aria-label="Tax setup sections">
          {tabs.map((tab) => {
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-extrabold transition ${
                  active
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-950"
                }`}
              >
                {tab.label}
                <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"}`}>
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {activeTab === "slabs" ? (
        <div className={`${card} overflow-hidden`}>
          <div className="flex flex-col gap-3 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-extrabold text-gray-900">Fiscal Year Tax Slabs</h2>
            <button className={`${btn} ${btnPrimary}`} type="button" onClick={openSlabModal}>
              <FiPlus /> Add Tax Slab
            </button>
          </div>
          <div className="max-h-[460px] overflow-auto">
            <table className="min-w-full text-left">
              <thead className="sticky top-0 bg-gray-50 text-xs font-black uppercase text-gray-500">
                <tr><th className="px-5 py-3">Fiscal Year</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Income Range</th><th className="px-5 py-3">Rate</th><th className="px-5 py-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {slabs.map((slab) => (
                  <tr key={slab._id} className="bg-white">
                    <td className="px-5 py-4 text-sm font-black text-gray-900">{slab.fiscalYear}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-gray-700">{pretty(slab.taxpayerType)}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-gray-700">{money(slab.minIncome)} - {slab.maxIncome === null || slab.maxIncome === undefined ? "Above" : money(slab.maxIncome)}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-gray-700">{slab.rate || 0}% + {money(slab.fixedAmount)}</td>
                    <td className="px-5 py-4"><div className="flex justify-end gap-2"><button className={`${btn} ${btnGhost} px-3`} type="button" onClick={() => editSlab(slab)}><FiEdit3 /></button><button className={`${btn} ${btnDanger} px-3`} type="button" onClick={() => deleteSlab(slab)}><FiTrash2 /></button></div></td>
                  </tr>
                ))}
                {!slabs.length ? <tr><td className="px-5 py-10 text-center text-sm font-bold text-gray-500" colSpan={5}>No tax slabs found.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === "employees" ? (
        <div className={`${card} p-5`}>
          <h2 className="text-base font-extrabold text-gray-900">Employee Tax Overrides</h2>
          <form className="mt-4 grid gap-3" onSubmit={saveProfile}>
            <Field label="Employee">
              <select className={input} value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)}>
                <option value="">Select employee</option>
                {employees.map((employee) => <option key={employee._id} value={employee._id}>{employee.name} {employee.employeeId ? `(${employee.employeeId})` : ""}</option>)}
              </select>
            </Field>
            <Field label="Tax Mode">
              <select
                className={input}
                value={profileForm.mode || "auto"}
                onChange={(e) =>
                  setProfileForm((p) => ({
                    ...p,
                    mode: e.target.value,
                    enabled: e.target.value !== "disabled",
                    method: e.target.value === "override" ? p.method || "slab" : "slab",
                  }))
                }
              >
                <option value="auto">Auto Tax Enabled from Salary Profile</option>
                <option value="override">Custom Tax Override</option>
                <option value="disabled">Tax Disabled for Employee</option>
              </select>
            </Field>
            {selectedEmployeeId && profileForm.mode === "auto" ? (
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-700">
                Payroll will select active fiscal-year slabs automatically from this employee's taxable salary.
              </div>
            ) : null}
            {selectedEmployeeId && profileForm.mode === "disabled" ? (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                Tax deduction will be skipped for this employee until Auto or Override is selected again.
              </div>
            ) : null}
            {profileForm.mode !== "disabled" ? (
              <div className="grid gap-3 md:grid-cols-2">
              <Field label="TIN">
                <input className={input} value={profileForm.tin} onChange={(e) => setProfileForm((p) => ({ ...p, tin: e.target.value }))} />
              </Field>
              {profileForm.mode === "override" ? (
                <Field label="Override Method">
                  <select className={input} value={profileForm.method} onChange={(e) => setProfileForm((p) => ({ ...p, method: e.target.value }))}>
                    <option value="slab">Slab</option>
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed</option>
                  </select>
                </Field>
              ) : null}
              {profileForm.mode === "auto" || profileForm.method === "slab" ? (
                <>
                  <Field label="Fiscal Year">
                    <input
                      className={input}
                      list="tax-fiscal-years"
                      value={profileForm.fiscalYear}
                      onChange={(e) => setProfileForm((p) => ({ ...p, fiscalYear: e.target.value }))}
                      placeholder={filters.fiscalYear}
                    />
                    <datalist id="tax-fiscal-years">
                      {fiscalYearOptions.map((year) => <option key={year} value={year} />)}
                    </datalist>
                  </Field>
                  <Field label="Taxpayer Type">
                    <input
                      className={input}
                      list="taxpayer-types"
                      value={profileForm.taxpayerType}
                      onChange={(e) => setProfileForm((p) => ({ ...p, taxpayerType: e.target.value }))}
                    />
                    <datalist id="taxpayer-types">
                      {taxpayerTypeOptions.map((type) => <option key={type} value={type} />)}
                    </datalist>
                  </Field>
                  <Field label="Fiscal Year Start Month">
                    <select className={input} value={profileForm.fiscalYearStartMonth || 1} onChange={(e) => setProfileForm((p) => ({ ...p, fiscalYearStartMonth: e.target.value }))}>
                      {Array.from({ length: 12 }, (_, index) => (
                        <option key={index + 1} value={index + 1}>{index + 1}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Exemption Amount">
                    <input className={input} type="number" value={profileForm.exemptionAmount} onChange={(e) => setProfileForm((p) => ({ ...p, exemptionAmount: e.target.value }))} />
                  </Field>
                  <Field label="Investment Amount">
                    <input className={input} type="number" value={profileForm.investmentAmount} onChange={(e) => setProfileForm((p) => ({ ...p, investmentAmount: e.target.value }))} />
                  </Field>
                </>
              ) : null}
              {profileForm.mode === "override" && profileForm.method === "percentage" ? (
                <Field label="Tax Percentage">
                  <input className={input} type="number" min="0" step="0.01" value={profileForm.percentage} onChange={(e) => setProfileForm((p) => ({ ...p, percentage: e.target.value }))} />
                </Field>
              ) : null}
              {profileForm.mode === "override" && profileForm.method === "fixed" ? (
                <Field label="Fixed Monthly Amount">
                  <input className={input} type="number" min="0" value={profileForm.fixedAmount} onChange={(e) => setProfileForm((p) => ({ ...p, fixedAmount: e.target.value }))} />
                </Field>
              ) : null}
              </div>
            ) : null}
            {profileForm.mode !== "disabled" && (profileForm.mode === "auto" || profileForm.method === "slab") && selectedEmployeeId ? (
              <div className={`rounded-2xl border p-4 text-sm font-bold ${matchingSlabCount ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-amber-100 bg-amber-50 text-amber-700"}`}>
                {matchingSlabCount
                  ? `${matchingSlabCount} active slab${matchingSlabCount === 1 ? "" : "s"} can be used automatically.`
                  : "No active slab matches this fiscal year and taxpayer type."}
              </div>
            ) : null}
            <button className={`${btn} ${btnPrimary}`} type="submit"><FiSave />Save Tax Override</button>
          </form>
        </div>
      ) : null}

      {slabModalOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-gray-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 p-5">
              <div>
                <h2 className="text-lg font-extrabold text-gray-900">{editingSlab ? "Update Tax Slab" : "Add Tax Slab"}</h2>
                <p className="text-sm font-semibold text-gray-500">Create fiscal-year tax brackets without changing payroll logic.</p>
              </div>
              <button className="rounded-xl p-2 hover:bg-gray-100" type="button" onClick={() => setSlabModalOpen(false)}>
                <FiX className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={saveSlab}>
              <div className="grid gap-4 p-5 md:grid-cols-2">
                <Field label="Fiscal Year"><input className={input} value={slabForm.fiscalYear} onChange={(e) => setSlabForm((p) => ({ ...p, fiscalYear: e.target.value }))} /></Field>
                <Field label="Taxpayer Type"><input className={input} value={slabForm.taxpayerType} onChange={(e) => setSlabForm((p) => ({ ...p, taxpayerType: e.target.value }))} /></Field>
                <Field label="Min Income"><input className={input} type="number" value={slabForm.minIncome} onChange={(e) => setSlabForm((p) => ({ ...p, minIncome: e.target.value }))} /></Field>
                <Field label="Max Income"><input className={input} type="number" value={slabForm.maxIncome} onChange={(e) => setSlabForm((p) => ({ ...p, maxIncome: e.target.value }))} placeholder="No limit" /></Field>
                <Field label="Rate (%)"><input className={input} type="number" value={slabForm.rate} onChange={(e) => setSlabForm((p) => ({ ...p, rate: e.target.value }))} /></Field>
                <Field label="Fixed Amount"><input className={input} type="number" value={slabForm.fixedAmount} onChange={(e) => setSlabForm((p) => ({ ...p, fixedAmount: e.target.value }))} /></Field>
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700"><input type="checkbox" checked={slabForm.isActive} onChange={(e) => setSlabForm((p) => ({ ...p, isActive: e.target.checked }))} /> Active</label>
              </div>
              <div className="flex justify-end gap-2 border-t border-gray-100 p-5">
                <button className={`${btn} ${btnGhost}`} type="button" onClick={() => setSlabModalOpen(false)}>Cancel</button>
                <button className={`${btn} ${btnPrimary}`} type="submit"><FiPlus />{editingSlab ? "Update Slab" : "Create Slab"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
