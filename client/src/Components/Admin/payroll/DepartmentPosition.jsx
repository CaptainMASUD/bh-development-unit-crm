"use client"

import { useEffect, useMemo, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Briefcase01Icon,
  Cancel01Icon,
  Clock01Icon,
  Delete02Icon,
  Dollar01Icon,
  Layers01Icon,
  PencilEdit02Icon,
  RefreshIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import { hasPermission, PERMISSIONS } from "../../Auth/permissions"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const shell = "min-h-screen bg-[#f7f8fb]"
const card =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_16px_45px_-32px_rgba(15,23,42,0.45)]"
const btn =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
const btnPrimary = "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
const btnGhost = "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
const btnDanger = "bg-rose-600 text-white shadow-sm hover:bg-rose-700"
const input =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/15"

const salaryTypes = [
  { value: "monthly", label: "Monthly" },
  { value: "daily", label: "Daily" },
  { value: "hourly", label: "Hourly" },
]

const overtimeCalcTypes = [
  { value: "per_hour", label: "Per Hour" },
  { value: "fixed", label: "Fixed Amount" },
  { value: "percentage", label: "Percentage" },
]

const emptyPositionForm = {
  title: "",
  department: "",
  description: "",
  defaultSalaryEnabled: false,
  defaultSalaryType: "monthly",
  defaultCurrency: "BDT",
  defaultBasicSalary: "",
  defaultWorkingDaysPerMonth: 26,
  defaultWorkingHoursPerDay: 8,
  defaultRules: {
    overtime: { enabled: false, calculationType: "per_hour", value: 0, basedOn: "basicSalary" },
    lateDeduction: { enabled: false, graceMinutes: 0, calculationType: "fixed", value: 0, basedOn: "basicSalary" },
    absentDeduction: { enabled: true, calculationType: "per_day", value: 0, basedOn: "basicSalary" },
    unpaidLeaveDeduction: { enabled: true, calculationType: "per_day", value: 0, basedOn: "basicSalary" },
    weeklyHolidayPaid: true,
    paidLeaveAllowed: true,
  },
}

function authHeaders() {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
    credentials: "include",
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Request failed")
  return data
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700">{label}</span>
      {children}
    </label>
  )
}

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${
        active
          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/10"
          : "bg-gray-100 text-gray-600 ring-gray-600/10"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  )
}

function money(value, currency = "BDT") {
  const n = Number(value || 0)
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: currency || "BDT",
    maximumFractionDigits: 0,
  }).format(n)
}

function safePositionRules(rules = {}) {
  return {
    ...emptyPositionForm.defaultRules,
    ...(rules || {}),
    overtime: { ...emptyPositionForm.defaultRules.overtime, ...(rules?.overtime || {}) },
    lateDeduction: { ...emptyPositionForm.defaultRules.lateDeduction, ...(rules?.lateDeduction || {}) },
    absentDeduction: { ...emptyPositionForm.defaultRules.absentDeduction, ...(rules?.absentDeduction || {}) },
    unpaidLeaveDeduction: {
      ...emptyPositionForm.defaultRules.unpaidLeaveDeduction,
      ...(rules?.unpaidLeaveDeduction || {}),
    },
  }
}

function Modal({ open, title, subtitle, icon, children, footer, onClose, maxWidthClass = "max-w-2xl" }) {
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm sm:p-6">
      <div className="flex min-h-full items-center justify-center">
        <div className={`w-full ${maxWidthClass} overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl transition-all`}>
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/75 px-6 py-4">
            <div className="flex items-center gap-3">
              {icon ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-600/10">
                  {icon}
                </div>
              ) : null}
              <div>
                <h3 className="text-base font-extrabold text-gray-900">{title}</h3>
                {subtitle ? <p className="text-xs font-semibold text-gray-500">{subtitle}</p> : null}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={20} className="h-5 w-5" />
            </button>
          </div>
          <div className="max-h-[calc(100vh-14rem)] overflow-y-auto p-6">{children}</div>
          {footer ? <div className="border-t border-gray-100 bg-gray-50/50 px-6 py-4">{footer}</div> : null}
        </div>
      </div>
    </div>
  )
}

export default function DepartmentPosition({ defaultTab = "departments", initialTab }) {
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null")
    } catch {
      return null
    }
  }, [])

  const canManage = useMemo(() => {
    if (!currentUser) return false
    if (["admin", "superadmin"].includes(currentUser.role)) return true
    return (
      hasPermission(currentUser, PERMISSIONS.EMPLOYEES_MANAGE) ||
      hasPermission(currentUser, PERMISSIONS.ACCESS_CONTROL_MANAGE) ||
      hasPermission(currentUser, PERMISSIONS.PAYROLL_MANAGE)
    )
  }, [currentUser])

  const [activeTab, setActiveTab] = useState(initialTab || defaultTab || "departments")

  useEffect(() => {
    const target = initialTab || defaultTab
    if (target && ["departments", "positions"].includes(target)) {
      setActiveTab(target)
    }
  }, [initialTab, defaultTab])

  const [departments, setDepartments] = useState([])
  const [positions, setPositions] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  const [createModal, setCreateModal] = useState("")
  const [editingItem, setEditingItem] = useState(null)
  const [departmentForm, setDepartmentForm] = useState({ name: "", description: "" })
  const [positionForm, setPositionForm] = useState(emptyPositionForm)
  const [deleteState, setDeleteState] = useState({ open: false, path: "", label: "", type: "", loading: false })

  const loadData = async () => {
    setLoading(true)
    try {
      const [depsRes, posRes] = await Promise.all([
        api("/access-control/departments").catch(() => ({ departments: [] })),
        api("/access-control/positions").catch(() => ({ positions: [] })),
      ])
      setDepartments(depsRes.departments || [])
      setPositions(posRes.positions || [])
    } catch (err) {
      toast.error(err.message || "Failed to load organizational structure")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const activeDepartments = useMemo(
    () => departments.filter((d) => d.isActive !== false),
    [departments]
  )

  const positionsByDept = useMemo(() => {
    const map = {}
    positions.forEach((p) => {
      const deptId = p.department?._id || p.department
      if (deptId) {
        map[deptId] = (map[deptId] || 0) + 1
      }
    })
    return map
  }, [positions])

  const filteredDepartments = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return departments
    return departments.filter(
      (d) =>
        d.name?.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q)
    )
  }, [departments, searchTerm])

  const filteredPositions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return positions
    return positions.filter(
      (p) =>
        p.title?.toLowerCase().includes(q) ||
        p.department?.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
    )
  }, [positions, searchTerm])

  const openCreateModal = (type) => {
    if (type === "departments") return toast.error("Manage departments from Administration.")
    if (!canManage) return toast.error("You do not have permission to create organizational units")
    setEditingItem(null)
    if (type === "departments") setDepartmentForm({ name: "", description: "" })
    if (type === "positions") setPositionForm(emptyPositionForm)
    setCreateModal(type)
  }

  const openEditModal = (type, item) => {
    if (type === "departments") return toast.error("Manage departments from Administration.")
    if (!canManage) return toast.error("You do not have permission to edit organizational units")
    setEditingItem(item)
    if (type === "departments") {
      setDepartmentForm({
        name: item?.name || "",
        description: item?.description || "",
      })
    }
    if (type === "positions") {
      setPositionForm({
        ...emptyPositionForm,
        title: item?.title || "",
        department: item?.department?._id || item?.department || "",
        description: item?.description || "",
        defaultSalaryEnabled: item?.defaultSalaryEnabled === true,
        defaultSalaryType: item?.defaultSalaryType || "monthly",
        defaultCurrency: item?.defaultCurrency || "BDT",
        defaultBasicSalary: item?.defaultBasicSalary || "",
        defaultWorkingDaysPerMonth: item?.defaultWorkingDaysPerMonth || 26,
        defaultWorkingHoursPerDay: item?.defaultWorkingHoursPerDay || 8,
        defaultRules: safePositionRules(item?.defaultRules),
      })
    }
    setCreateModal(type)
  }

  const closeModal = () => {
    setCreateModal("")
    setEditingItem(null)
  }

  const saveDepartment = async (e) => {
    e.preventDefault()
    if (!departmentForm.name?.trim()) return toast.error("Department name is required")
    try {
      await api(
        editingItem?._id
          ? `/access-control/departments/${editingItem._id}`
          : "/access-control/departments",
        {
          method: editingItem?._id ? "PATCH" : "POST",
          body: JSON.stringify(departmentForm),
        }
      )
      toast.success(editingItem?._id ? "Department updated" : "Department created")
      closeModal()
      loadData()
    } catch (err) {
      toast.error(err.message || "Failed to save department")
    }
  }

  const savePosition = async (e) => {
    e.preventDefault()
    if (!positionForm.title?.trim()) return toast.error("Position title is required")
    if (!positionForm.department) return toast.error("Please select a department")

    try {
      const payload = {
        ...positionForm,
        defaultSalaryEnabled:
          Boolean(positionForm.defaultSalaryEnabled) ||
          Number(positionForm.defaultBasicSalary || 0) > 0,
        defaultBasicSalary: Number(positionForm.defaultBasicSalary || 0),
        defaultWorkingDaysPerMonth: Number(positionForm.defaultWorkingDaysPerMonth || 26),
        defaultWorkingHoursPerDay: Number(positionForm.defaultWorkingHoursPerDay || 8),
        defaultRules: safePositionRules(positionForm.defaultRules),
      }

      await api(
        editingItem?._id
          ? `/access-control/positions/${editingItem._id}`
          : "/access-control/positions",
        {
          method: editingItem?._id ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        }
      )
      toast.success(editingItem?._id ? "Position updated" : "Position created")
      closeModal()
      loadData()
    } catch (err) {
      toast.error(err.message || "Failed to save position")
    }
  }

  const handleDelete = async () => {
    if (!deleteState.path) return
    setDeleteState((prev) => ({ ...prev, loading: true }))
    try {
      await api(deleteState.path, { method: "DELETE" })
      toast.success(`${deleteState.label} deleted`)
      setDeleteState({ open: false, path: "", label: "", type: "", loading: false })
      loadData()
    } catch (err) {
      toast.error(err.message || "Delete failed")
      setDeleteState((prev) => ({ ...prev, loading: false }))
    }
  }

  const tabs = [
    { key: "departments", label: "Departments", icon: Layers01Icon, count: departments.length },
    { key: "positions", label: "Positions & Designations", icon: Briefcase01Icon, count: positions.length },
  ]

  return (
    <div className={shell}>
      <Toaster position="top-right" toastOptions={{ duration: 2600, style: { borderRadius: "14px", fontWeight: 700 } }} />

      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <header className={`${card} mb-6 p-5 sm:p-6`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
                <HugeiconsIcon icon={Layers01Icon} size={24} className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
                  Departments & Positions
                </h1>
                <p className="mt-1 text-sm font-semibold text-gray-500">
                  Organizational structure, job designations, and default compensation scale templates.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-2xl bg-indigo-50/80 px-3.5 py-2 text-xs font-bold text-indigo-700 ring-1 ring-indigo-600/15">
                <span>{departments.length} Departments</span>
                <span>•</span>
                <span>{positions.length} Positions</span>
              </div>
              {canManage && activeTab === "positions" ? (
                <button
                  type="button"
                  className={`${btn} ${btnPrimary}`}
                  onClick={() => openCreateModal(activeTab)}
                >
                  <HugeiconsIcon icon={Add01Icon} size={16} className="h-4 w-4" />
                  {activeTab === "departments" ? "Add Department" : "Add Position"}
                </button>
              ) : null}
            </div>
          </div>
        </header>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2 rounded-2xl border border-gray-200/80 bg-white p-1.5 shadow-sm">
            {tabs.map(({ key, label, icon, count }) => {
              const active = activeTab === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold transition ${
                    active
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-950"
                  }`}
                >
                  <HugeiconsIcon icon={icon} size={16} className="h-4 w-4" />
                  {label}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-black ${
                      active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="relative min-w-[260px] sm:w-80">
            <HugeiconsIcon icon={Search01Icon} size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className={`${input} pl-10`}
              placeholder={`Search ${activeTab === "departments" ? "departments" : "positions"}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <main className={`${card} overflow-hidden`}>
          {loading ? (
            <div className="flex min-h-64 items-center justify-center p-12">
              <div className="flex items-center gap-3 text-sm font-bold text-gray-500">
                <HugeiconsIcon icon={RefreshIcon} size={16} className="animate-spin text-indigo-600" />
                Loading organizational data...
              </div>
            </div>
          ) : activeTab === "departments" ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left">
                <thead>
                  <tr>
                    {["Department Name", "Description", "Assigned Positions", "Status", "Actions"].map((heading) => (
                      <th
                        key={heading}
                        className="border-b border-gray-100 bg-gray-50/75 px-6 py-4 text-xs font-black uppercase tracking-[0.08em] text-gray-600"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredDepartments.length ? (
                    filteredDepartments.map((dept) => (
                      <tr key={dept._id} className="transition hover:bg-gray-50/60">
                        <td className="px-6 py-4 align-middle">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 font-black text-indigo-700 ring-1 ring-indigo-600/10">
                              {dept.name?.charAt(0) || "D"}
                            </span>
                            <span className="text-sm font-extrabold text-gray-900">{dept.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-500">
                          {dept.description || "No description provided"}
                        </td>
                        <td className="px-6 py-4 align-middle">
                          <span className="inline-flex items-center rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">
                            {positionsByDept[dept._id] || 0} positions
                          </span>
                        </td>
                        <td className="px-6 py-4 align-middle">
                          <StatusBadge active={dept.isActive !== false} />
                        </td>
                        <td className="px-6 py-4 text-right align-middle">
                          {false ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                className="rounded-xl p-2 text-indigo-600 transition hover:bg-indigo-50"
                                onClick={() => openEditModal("departments", dept)}
                                title="Edit Department"
                              >
                                <HugeiconsIcon icon={PencilEdit02Icon} size={16} className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                className="rounded-xl p-2 text-rose-600 transition hover:bg-rose-50"
                                onClick={() =>
                                  setDeleteState({
                                    open: true,
                                    path: `/access-control/departments/${dept._id}`,
                                    label: dept.name,
                                    type: "Department",
                                    loading: false,
                                  })
                                }
                                title="Delete Department"
                              >
                                <HugeiconsIcon icon={Delete02Icon} size={16} className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-gray-400">View only</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center">
                        <div className="mx-auto flex max-w-sm flex-col items-center">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10">
                            <HugeiconsIcon icon={Layers01Icon} size={24} className="h-6 w-6" />
                          </div>
                          <p className="mt-3 text-sm font-extrabold text-gray-900">No departments found</p>
                          <p className="mt-1 text-xs font-semibold text-gray-500">Create organizational departments to categorize employees and positions.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] border-separate border-spacing-0 text-left">
                <thead>
                  <tr>
                    {["Position / Designation", "Department", "Salary Template", "Attendance Rules", "Status", "Actions"].map((heading) => (
                      <th
                        key={heading}
                        className="border-b border-gray-100 bg-gray-50/75 px-6 py-4 text-xs font-black uppercase tracking-[0.08em] text-gray-600"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredPositions.length ? (
                    filteredPositions.map((pos) => (
                      <tr key={pos._id} className="transition hover:bg-gray-50/60">
                        <td className="px-6 py-4 align-middle">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 font-black text-purple-700 ring-1 ring-purple-600/10">
                              <HugeiconsIcon icon={Briefcase01Icon} size={16} className="h-4 w-4" />
                            </span>
                            <div>
                              <p className="text-sm font-extrabold text-gray-900">{pos.title}</p>
                              {pos.description ? (
                                <p className="text-xs font-semibold text-gray-400">{pos.description}</p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 align-middle text-sm font-bold text-gray-700">
                          {pos.department?.name || <span className="text-gray-400">Not assigned</span>}
                        </td>
                        <td className="px-6 py-4 align-middle">
                          {pos.defaultSalaryEnabled && Number(pos.defaultBasicSalary || 0) > 0 ? (
                            <div>
                              <p className="text-sm font-extrabold text-gray-900">
                                {money(pos.defaultBasicSalary, pos.defaultCurrency)}
                              </p>
                              <p className="mt-0.5 text-xs font-semibold text-gray-500">
                                {pos.defaultSalaryType || "monthly"} • {pos.defaultWorkingDaysPerMonth || 26}d • {pos.defaultWorkingHoursPerDay || 8}h/day
                              </p>
                            </div>
                          ) : (
                            <span className="rounded-lg bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-400">
                              Custom scale
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 align-middle">
                          {pos.defaultSalaryEnabled ? (
                            <div className="flex flex-wrap gap-1">
                              {pos.defaultRules?.overtime?.enabled ? (
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-extrabold text-emerald-700">
                                  Overtime
                                </span>
                              ) : null}
                              {pos.defaultRules?.lateDeduction?.enabled ? (
                                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-extrabold text-amber-700">
                                  Late
                                </span>
                              ) : null}
                              {pos.defaultRules?.absentDeduction?.enabled ? (
                                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-extrabold text-rose-700">
                                  Absent
                                </span>
                              ) : null}
                              {pos.defaultRules?.unpaidLeaveDeduction?.enabled ? (
                                <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-extrabold text-purple-700">
                                  Unpaid
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 align-middle">
                          <StatusBadge active={pos.isActive !== false} />
                        </td>
                        <td className="px-6 py-4 text-right align-middle">
                          {canManage ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                className="rounded-xl p-2 text-indigo-600 transition hover:bg-indigo-50"
                                onClick={() => openEditModal("positions", pos)}
                                title="Edit Position"
                              >
                                <HugeiconsIcon icon={PencilEdit02Icon} size={16} className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                className="rounded-xl p-2 text-rose-600 transition hover:bg-rose-50"
                                onClick={() =>
                                  setDeleteState({
                                    open: true,
                                    path: `/access-control/positions/${pos._id}`,
                                    label: pos.title,
                                    type: "Position",
                                    loading: false,
                                  })
                                }
                                title="Delete Position"
                              >
                                <HugeiconsIcon icon={Delete02Icon} size={16} className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-gray-400">View only</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center">
                        <div className="mx-auto flex max-w-sm flex-col items-center">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10">
                            <HugeiconsIcon icon={Briefcase01Icon} size={24} className="h-6 w-6" />
                          </div>
                          <p className="mt-3 text-sm font-extrabold text-gray-900">No positions found</p>
                          <p className="mt-1 text-xs font-semibold text-gray-500">Create designations with optional salary templates under departments.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {/* Create / Edit Department Modal */}
      <Modal
        open={createModal === "departments"}
        title={editingItem ? "Edit Department" : "Create Department"}
        subtitle="Define an organizational unit for teams and positions."
        icon={<HugeiconsIcon icon={Layers01Icon} size={20} className="h-5 w-5" />}
        onClose={closeModal}
        footer={
          <div className="flex justify-end gap-2">
            <button className={`${btn} ${btnGhost}`} onClick={closeModal} type="button">Cancel</button>
            <button className={`${btn} ${btnPrimary}`} form="department-form" type="submit">
              {editingItem ? "Update Department" : "Create Department"}
            </button>
          </div>
        }
      >
        <form id="department-form" onSubmit={saveDepartment} className="space-y-4">
          <Field label="Department Name">
            <input
              required
              className={input}
              placeholder="e.g. Finance & Accounts, Software Engineering"
              value={departmentForm.name}
              onChange={(e) => setDepartmentForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </Field>
          <Field label="Description">
            <textarea
              className={`${input} min-h-24 resize-none py-2.5`}
              placeholder="Responsibilities and functional scope of this department..."
              value={departmentForm.description}
              onChange={(e) => setDepartmentForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </Field>
        </form>
      </Modal>

      {/* Create / Edit Position Modal */}
      <Modal
        open={createModal === "positions"}
        title={editingItem ? "Edit Position" : "Create Position"}
        subtitle="Assign designation under a department with optional salary template rules."
        icon={<HugeiconsIcon icon={Briefcase01Icon} size={20} className="h-5 w-5" />}
        maxWidthClass="max-w-4xl"
        onClose={closeModal}
        footer={
          <div className="flex justify-end gap-2">
            <button className={`${btn} ${btnGhost}`} onClick={closeModal} type="button">Cancel</button>
            <button className={`${btn} ${btnPrimary}`} form="position-form" type="submit">
              {editingItem ? "Update Position" : "Create Position"}
            </button>
          </div>
        }
      >
        <form id="position-form" onSubmit={savePosition} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Department">
              <select
                required
                className={input}
                value={positionForm.department}
                onChange={(e) => setPositionForm((prev) => ({ ...prev, department: e.target.value }))}
              >
                <option value="">Select a department</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Position / Designation Title">
              <input
                required
                className={input}
                placeholder="e.g. Senior Software Engineer, Accounts Manager"
                value={positionForm.title}
                onChange={(e) => setPositionForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </Field>
          </div>

          <Field label="Description">
            <textarea
              className={`${input} min-h-20 resize-none py-2`}
              placeholder="Key job scope or responsibilities for this role..."
              value={positionForm.description}
              onChange={(e) => setPositionForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </Field>

          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={positionForm.defaultSalaryEnabled}
                onChange={(e) => setPositionForm((prev) => ({ ...prev, defaultSalaryEnabled: e.target.checked }))}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="flex items-center gap-2 text-sm font-extrabold text-gray-900">
                  <HugeiconsIcon icon={Dollar01Icon} size={16} className="h-4 w-4 text-indigo-600" />
                  Use this position as a default salary template
                </span>
                <span className="mt-1 block text-xs font-semibold text-gray-600">
                  When new employees are assigned to this position, their initial salary profile automatically inherits these basic compensation and attendance deduction rules.
                </span>
              </div>
            </label>
          </div>

          {positionForm.defaultSalaryEnabled ? (
            <div className="space-y-4 rounded-2xl border border-gray-100 bg-[#fbfcff] p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Default Basic Salary">
                  <input
                    type="number"
                    min="0"
                    className={input}
                    placeholder="e.g. 40000"
                    value={positionForm.defaultBasicSalary}
                    onChange={(e) => setPositionForm((prev) => ({ ...prev, defaultBasicSalary: e.target.value }))}
                  />
                </Field>
                <Field label="Salary Type">
                  <select
                    className={input}
                    value={positionForm.defaultSalaryType}
                    onChange={(e) => setPositionForm((prev) => ({ ...prev, defaultSalaryType: e.target.value }))}
                  >
                    {salaryTypes.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Currency">
                  <input
                    className={input}
                    value={positionForm.defaultCurrency}
                    onChange={(e) => setPositionForm((prev) => ({ ...prev, defaultCurrency: e.target.value.toUpperCase() }))}
                  />
                </Field>
                <Field label="Working Days / Month">
                  <input
                    type="number"
                    min="1"
                    max="31"
                    className={input}
                    value={positionForm.defaultWorkingDaysPerMonth}
                    onChange={(e) => setPositionForm((prev) => ({ ...prev, defaultWorkingDaysPerMonth: e.target.value }))}
                  />
                </Field>
                <Field label="Working Hours / Day">
                  <input
                    type="number"
                    min="1"
                    max="24"
                    className={input}
                    value={positionForm.defaultWorkingHoursPerDay}
                    onChange={(e) => setPositionForm((prev) => ({ ...prev, defaultWorkingHoursPerDay: e.target.value }))}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <label className="mb-3 flex items-center gap-2 text-xs font-black uppercase text-gray-900">
                    <input
                      type="checkbox"
                      checked={positionForm.defaultRules.overtime.enabled}
                      onChange={(e) =>
                        setPositionForm((prev) => ({
                          ...prev,
                          defaultRules: {
                            ...prev.defaultRules,
                            overtime: { ...prev.defaultRules.overtime, enabled: e.target.checked },
                          },
                        }))
                      }
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Overtime Earning
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Calculation">
                      <select
                        className={input}
                        value={positionForm.defaultRules.overtime.calculationType}
                        onChange={(e) =>
                          setPositionForm((prev) => ({
                            ...prev,
                            defaultRules: {
                              ...prev.defaultRules,
                              overtime: { ...prev.defaultRules.overtime, calculationType: e.target.value },
                            },
                          }))
                        }
                      >
                        {overtimeCalcTypes.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Rate / Value">
                      <input
                        type="number"
                        min="0"
                        className={input}
                        value={positionForm.defaultRules.overtime.value}
                        onChange={(e) =>
                          setPositionForm((prev) => ({
                            ...prev,
                            defaultRules: {
                              ...prev.defaultRules,
                              overtime: { ...prev.defaultRules.overtime, value: Number(e.target.value || 0) },
                            },
                          }))
                        }
                      />
                    </Field>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <label className="mb-3 flex items-center gap-2 text-xs font-black uppercase text-gray-900">
                    <input
                      type="checkbox"
                      checked={positionForm.defaultRules.lateDeduction.enabled}
                      onChange={(e) =>
                        setPositionForm((prev) => ({
                          ...prev,
                          defaultRules: {
                            ...prev.defaultRules,
                            lateDeduction: { ...prev.defaultRules.lateDeduction, enabled: e.target.checked },
                          },
                        }))
                      }
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Late Deduction
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Grace Mins">
                      <input
                        type="number"
                        min="0"
                        className={input}
                        value={positionForm.defaultRules.lateDeduction.graceMinutes}
                        onChange={(e) =>
                          setPositionForm((prev) => ({
                            ...prev,
                            defaultRules: {
                              ...prev.defaultRules,
                              lateDeduction: { ...prev.defaultRules.lateDeduction, graceMinutes: Number(e.target.value || 0) },
                            },
                          }))
                        }
                      />
                    </Field>
                    <Field label="Calc">
                      <select
                        className={input}
                        value={positionForm.defaultRules.lateDeduction.calculationType}
                        onChange={(e) =>
                          setPositionForm((prev) => ({
                            ...prev,
                            defaultRules: {
                              ...prev.defaultRules,
                              lateDeduction: { ...prev.defaultRules.lateDeduction, calculationType: e.target.value },
                            },
                          }))
                        }
                      >
                        <option value="fixed">Fixed</option>
                        <option value="per_minute">Per Min</option>
                        <option value="percentage">%</option>
                      </select>
                    </Field>
                    <Field label="Value">
                      <input
                        type="number"
                        min="0"
                        className={input}
                        value={positionForm.defaultRules.lateDeduction.value}
                        onChange={(e) =>
                          setPositionForm((prev) => ({
                            ...prev,
                            defaultRules: {
                              ...prev.defaultRules,
                              lateDeduction: { ...prev.defaultRules.lateDeduction, value: Number(e.target.value || 0) },
                            },
                          }))
                        }
                      />
                    </Field>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteState.open}
        title={`Delete ${deleteState.type}`}
        subtitle={`Confirm permanent removal of ${deleteState.label}`}
        icon={<HugeiconsIcon icon={Delete02Icon} size={20} className="h-5 w-5 text-rose-600" />}
        maxWidthClass="max-w-md"
        onClose={() => !deleteState.loading && setDeleteState({ open: false, path: "", label: "", type: "", loading: false })}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={`${btn} ${btnGhost}`}
              disabled={deleteState.loading}
              onClick={() => setDeleteState({ open: false, path: "", label: "", type: "", loading: false })}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`${btn} ${btnDanger}`}
              disabled={deleteState.loading}
              onClick={handleDelete}
            >
              {deleteState.loading ? "Deleting..." : "Delete Permanently"}
            </button>
          </div>
        }
      >
        <p className="text-sm font-semibold text-gray-600">
          Are you sure you want to delete <strong className="text-gray-900">{deleteState.label}</strong>? This action cannot be undone. Ensure no active employees remain linked to this {deleteState.type?.toLowerCase()}.
        </p>
      </Modal>
    </div>
  )
}
