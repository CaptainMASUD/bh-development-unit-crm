"use client"

import { useEffect, useMemo, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import {
  FiBriefcase,
  FiCheckSquare,
  FiDollarSign,
  FiEdit3,
  FiLayers,
  FiLock,
  FiPlus,
  FiRefreshCcw,
  FiShield,
  FiTrash2,
  FiUserCheck,
  FiX,
} from "react-icons/fi"
import { hasPermission, PERMISSIONS } from "../Auth/permissions"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const shell = "min-h-screen bg-gray-50"
const card =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_28px_-16px_rgba(0,0,0,0.28)]"
const btn =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
const btnPrimary = "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
const btnGhost = "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
const btnDanger = "bg-rose-600 text-white shadow-sm hover:bg-rose-700"
const input =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-indigo-500/40"

const salaryTypes = [
  { value: "monthly", label: "Monthly" },
  { value: "daily", label: "Daily" },
  { value: "hourly", label: "Hourly" },
]

const salaryRuleCalcTypes = [
  { value: "per_day", label: "Per Day" },
  { value: "fixed", label: "Fixed Amount" },
  { value: "percentage", label: "Percentage" },
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

const PERMISSION_LABELS = {
  "dashboard:view": {
    label: "View Dashboard",
    helper: "Open the employee dashboard overview.",
  },
  "customers:view": {
    label: "View Customers",
    helper: "See customer records and customer details.",
  },
  "customers:manage": {
    label: "Manage Customers",
    helper: "Create and update customer records.",
  },
  "leads:view": {
    label: "View Leads",
    helper: "See lead lists, lead details, and lead history.",
  },
  "leads:manage": {
    label: "Manage Leads",
    helper: "Create, edit, progress, and follow up leads.",
  },
  "deals:view": {
    label: "View Deals",
    helper: "See deal records and deal status.",
  },
  "deals:manage": {
    label: "Manage Deals",
    helper: "Create and update deals.",
  },
  "tasks:view": { label: "View Client Tasks", helper: "See tasks, subtitles, files, and notes assigned to clients." },
  "tasks:manage": { label: "Manage Client Tasks", helper: "Update task status, files, notes, and task details." },
  "reports:view": {
    label: "View Reports",
    helper: "Open reporting pages.",
  },
  "workflow:view": {
    label: "View Workflow Procedure",
    helper: "Open the employee workflow guide.",
  },
  "profile:view": {
    label: "View Profile Settings",
    helper: "Open and update own profile settings.",
  },
  "attendance:view": { label: "View Attendance", helper: "See personal attendance and monthly summaries." },
  "attendance:manage": { label: "Manage Attendance", helper: "Mark, update, and correct employee attendance." },
  "payroll:view": { label: "View Payroll", helper: "See personal payroll records and payslips." },
  "payroll:manage": { label: "Manage Payroll", helper: "Calculate, approve, pay, and cancel payroll records." },
  "tax.view": { label: "View Tax", helper: "See tax slabs, employee tax profiles, and reports." },
  "tax.create": { label: "Create Tax Slabs", helper: "Create Tax/TDS slab settings by fiscal year." },
  "tax.update": { label: "Update Tax Settings", helper: "Edit tax slabs and employee tax profiles." },
  "tax.delete": { label: "Delete Tax Slabs", helper: "Delete tax slab settings." },
  "tax.assign_employee": { label: "Assign Employee Tax", helper: "Enable and configure employee tax profiles." },
  "tax.report": { label: "Tax Reports", helper: "See monthly and employee-wise tax deduction reports." },
  "loans:view": { label: "View Employee Loans", helper: "See personal employee loan records." },
  "loans:manage": { label: "Manage Employee Loans", helper: "Create, update, cancel, and record loan payments." },
  "leaves:view": { label: "View Leave Requests", helper: "Apply for leave and see personal leave request history." },
  "leaves:manage": { label: "Manage Leave Requests", helper: "Review, approve, and reject employee leave requests." },
  "roster:view": { label: "View Roster", helper: "See shifts, weekly offs, and holiday schedules." },
  "roster:manage": { label: "Manage Roster", helper: "Create shifts and manage roster assignments and holidays." },
  "employees:view": { label: "View Employees", helper: "See employee profiles and employment information." },
  "employees:manage": { label: "Manage Employees", helper: "Create and update employee records." },
  "salary:view": { label: "View Salary Profiles", helper: "See employee salary profiles and history." },
  "salary:manage": { label: "Manage Salary Profiles", helper: "Create, override, and deactivate salary profiles." },
  "notifications:view": { label: "View Notifications", helper: "See personal task and deadline notifications." },
  "notifications:manage": { label: "Manage Notifications", helper: "Create and administer employee notifications." },
  "access-control:view": { label: "View Access Control", helper: "See departments, positions, permission groups, and roles." },
  "access-control:manage": { label: "Manage Access Control", helper: "Create and update access-control records." },
}

const MODULE_LABELS = {
  dashboard: "Dashboard",
  customers: "Clients",
  tasks: "Client Tasks",
  leads: "Leads",
  deals: "Deals",
  reports: "Reports",
  attendance: "Attendance",
  payroll: "Payroll",
  tax: "Tax Management",
  loans: "Employee Loans",
  leaves: "Leave Requests",
  roster: "Roster & Shifts",
  employees: "Employees",
  salary: "Salary",
  notifications: "Notifications",
  "access-control": "Access Control",
  workflow: "Workflow",
  profile: "Profile",
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
      <span className="mb-1.5 block text-sm font-semibold text-gray-800">{label}</span>
      {children}
    </label>
  )
}

function EmptyTable({ icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10">
        {icon}
      </div>
      <p className="mt-3 text-sm font-extrabold text-gray-900">{title}</p>
      <p className="mt-1 text-sm font-medium text-gray-500">{subtitle}</p>
    </div>
  )
}

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
        active
          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/10"
          : "bg-gray-100 text-gray-600 ring-gray-600/10"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  )
}

function permissionMeta(key) {
  return PERMISSION_LABELS[key] || {
    label: String(key || "").replace(/:/g, " "),
    helper: "Custom access permission.",
  }
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

function PermissionPill({ permissionKey }) {
  const meta = permissionMeta(permissionKey)
  return (
    <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-600/10">
      {meta.label}
    </span>
  )
}

function AccessModal({ open, title, subtitle, icon, children, footer, onClose, maxWidthClass = "max-w-3xl" }) {
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
    const onKey = (event) => event.key === "Escape" && onClose?.()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 overflow-y-auto">
        <div className="flex min-h-full items-start justify-center p-4 sm:items-center sm:p-6">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-md" onClick={onClose} />
          <div className={`relative w-full overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_30px_70px_-30px_rgba(0,0,0,0.65)] ${maxWidthClass}`}>
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-100 bg-white p-4 sm:p-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
                  {icon}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-extrabold text-gray-900 sm:text-lg">{title}</h2>
                  {subtitle ? <p className="truncate text-sm text-gray-600">{subtitle}</p> : null}
                </div>
              </div>
              <button onClick={onClose} className="rounded-xl p-2 transition hover:bg-gray-100" type="button">
                <FiX className="h-5 w-5 text-gray-700" />
              </button>
            </div>
            <div className="max-h-[calc(100vh-14rem)] overflow-y-auto bg-white p-4 sm:p-5">{children}</div>
            {footer ? <div className="sticky bottom-0 z-20 border-t border-gray-100 bg-white p-4 sm:p-5">{footer}</div> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AccessControl() {
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null")
    } catch {
      return null
    }
  }, [])
  const canManageAccessControl = hasPermission(currentUser, PERMISSIONS.ACCESS_CONTROL_MANAGE)
  const [activeTab, setActiveTab] = useState("departments")
  const [createModal, setCreateModal] = useState("")
  const [editingItem, setEditingItem] = useState(null)
  const [departments, setDepartments] = useState([])
  const [positions, setPositions] = useState([])
  const [permissionGroups, setPermissionGroups] = useState([])
  const [roles, setRoles] = useState([])
  const [permissionCatalog, setPermissionCatalog] = useState([])
  const [loading, setLoading] = useState(false)
  const [deleteState, setDeleteState] = useState({ open: false, path: "", label: "", type: "", password: "", loading: false })

  const [departmentForm, setDepartmentForm] = useState({ name: "", description: "" })
  const [positionForm, setPositionForm] = useState(emptyPositionForm)
  const [groupForm, setGroupForm] = useState({ name: "", description: "", permissions: [] })
  const [roleForm, setRoleForm] = useState({ name: "", description: "", permissionGroup: "" })

  const activeDepartments = useMemo(
    () => departments.filter((department) => department.isActive !== false),
    [departments]
  )

  const permissionSections = useMemo(() => {
    const sections = new Map()
    permissionCatalog.forEach((permission) => {
      const moduleName = permission.module || String(permission.key || "").split(/[:.]/)[0]
      if (!sections.has(moduleName)) sections.set(moduleName, [])
      sections.get(moduleName).push(permission)
    })
    return Array.from(sections, ([moduleName, permissions]) => ({
      moduleName,
      label: MODULE_LABELS[moduleName] || moduleName.replace(/\b\w/g, (char) => char.toUpperCase()),
      permissions,
    }))
  }, [permissionCatalog])

  const tabs = [
    { key: "departments", label: "Departments", icon: FiLayers, count: departments.length },
    { key: "positions", label: "Positions", icon: FiBriefcase, count: positions.length },
    { key: "permission-groups", label: "Permission Groups", icon: FiShield, count: permissionGroups.length },
    { key: "roles", label: "Roles", icon: FiUserCheck, count: roles.length },
  ]

  const loadAll = async () => {
    setLoading(true)
    try {
      const [deps, pos, groups, catalog, roleData] = await Promise.all([
        api("/access-control/departments"),
        api("/access-control/positions"),
        api("/access-control/permission-groups"),
        api("/access-control/permissions"),
        api("/access-control/roles"),
      ])
      setDepartments(deps.departments || [])
      setPositions(pos.positions || [])
      setPermissionGroups(groups.permissionGroups || [])
      setPermissionCatalog(catalog.permissions || [])
      setRoles(roleData.roles || [])
    } catch (err) {
      toast.error(err.message || "Failed to load access settings")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const closeModal = () => {
    setCreateModal("")
    setEditingItem(null)
  }

  const openCreateModal = (type) => {
    if (!canManageAccessControl) return toast.error("You do not have permission to create access settings")
    setEditingItem(null)
    if (type === "departments") setDepartmentForm({ name: "", description: "" })
    if (type === "positions") setPositionForm(emptyPositionForm)
    if (type === "permission-groups") setGroupForm({ name: "", description: "", permissions: [] })
    if (type === "roles") setRoleForm({ name: "", description: "", permissionGroup: "" })
    setCreateModal(type)
  }

  const openEditModal = (type, item) => {
    if (!canManageAccessControl) return toast.error("You do not have permission to update access settings")
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
    if (type === "permission-groups") {
      setGroupForm({
        name: item?.name || "",
        description: item?.description || "",
        permissions: Array.isArray(item?.permissions) ? item.permissions : [],
      })
    }
    if (type === "roles") {
      setRoleForm({
        name: item?.name || "",
        description: item?.description || "",
        permissionGroup: item?.permissionGroup?._id || item?.permissionGroup || "",
      })
    }
    setCreateModal(type)
  }

  const createDepartment = async (event) => {
    event.preventDefault()
    try {
      await api(
        editingItem?._id
          ? `/access-control/departments/${editingItem._id}`
          : "/access-control/departments",
        {
        method: editingItem?._id ? "PATCH" : "POST",
        body: JSON.stringify(departmentForm),
      })
      setDepartmentForm({ name: "", description: "" })
      toast.success(editingItem?._id ? "Department updated" : "Department created")
      closeModal()
      loadAll()
    } catch (err) {
      toast.error(err.message || "Create failed")
    }
  }

  const createPosition = async (event) => {
    event.preventDefault()
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
      })
      setPositionForm({ ...emptyPositionForm, department: positionForm.department })
      toast.success(editingItem?._id ? "Position updated" : "Position created")
      closeModal()
      loadAll()
    } catch (err) {
      toast.error(err.message || "Create failed")
    }
  }

  const createPermissionGroup = async (event) => {
    event.preventDefault()
    try {
      await api(
        editingItem?._id
          ? `/access-control/permission-groups/${editingItem._id}`
          : "/access-control/permission-groups",
        {
        method: editingItem?._id ? "PATCH" : "POST",
        body: JSON.stringify(groupForm),
      })
      setGroupForm({ name: "", description: "", permissions: [] })
      toast.success(editingItem?._id ? "Permission group updated" : "Permission group created")
      closeModal()
      loadAll()
    } catch (err) {
      toast.error(err.message || "Create failed")
    }
  }

  const createRole = async (event) => {
    event.preventDefault()
    try {
      await api(editingItem?._id ? `/access-control/roles/${editingItem._id}` : "/access-control/roles", {
        method: editingItem?._id ? "PATCH" : "POST",
        body: JSON.stringify(roleForm),
      })
      setRoleForm({ name: "", description: "", permissionGroup: "" })
      toast.success(editingItem?._id ? "Role updated" : "Role created")
      closeModal()
      loadAll()
    } catch (err) {
      toast.error(err.message || "Create failed")
    }
  }

  const requestDelete = ({ path, label, type }) => {
    if (!canManageAccessControl) return toast.error("You do not have permission to delete access settings")
    setDeleteState({ open: true, path, label, type, password: "", loading: false })
  }

  const closeDeleteModal = () => {
    if (deleteState.loading) return
    setDeleteState({ open: false, path: "", label: "", type: "", password: "", loading: false })
  }

  const removeItem = async (event) => {
    event.preventDefault()
    if (!deleteState.path) return
    if (!deleteState.password || deleteState.password.length < 6) {
      toast.error("Enter your password to delete")
      return
    }

    setDeleteState((prev) => ({ ...prev, loading: true }))
    try {
      await api(deleteState.path, {
        method: "DELETE",
        body: JSON.stringify({ password: deleteState.password }),
      })
      toast.success("Deleted")
      setDeleteState({ open: false, path: "", label: "", type: "", password: "", loading: false })
      loadAll()
    } catch (err) {
      toast.error(err.message || "Delete failed")
      setDeleteState((prev) => ({ ...prev, loading: false }))
    }
  }

  const togglePermission = (key) => {
    setGroupForm((prev) => {
      const exists = prev.permissions.includes(key)
      const separator = String(key).includes(".") ? "." : ":"
      const [moduleName, action] = String(key).split(/[:.]/)
      const viewKey = `${moduleName}${separator}view`
      const manageKey = `${moduleName}${separator}manage`
      let permissions = [...prev.permissions]

      if (exists) {
        permissions = permissions.filter((permission) => permission !== key)
        if (action === "view") permissions = permissions.filter((permission) => {
          const [itemModule] = String(permission).split(/[:.]/)
          return itemModule !== moduleName || permission === key
        }).filter((permission) => permission !== key)
      } else {
        permissions.push(key)
        if (action === "manage" && !permissions.includes(viewKey)) permissions.push(viewKey)
        if (separator === "." && action !== "view" && !permissions.includes(viewKey)) permissions.push(viewKey)
      }
      return {
        ...prev,
        permissions: [...new Set(permissions)],
      }
    })
  }

  const updatePositionForm = (key, value) => {
    setPositionForm((prev) => ({ ...prev, [key]: value }))
  }

  const updatePositionRule = (ruleKey, key, value) => {
    setPositionForm((prev) => ({
      ...prev,
      defaultRules: {
        ...safePositionRules(prev.defaultRules),
        [ruleKey]: {
          ...safePositionRules(prev.defaultRules)[ruleKey],
          [key]: value,
        },
      },
    }))
  }

  const updatePositionRuleFlag = (key, value) => {
    setPositionForm((prev) => ({
      ...prev,
      defaultRules: {
        ...safePositionRules(prev.defaultRules),
        [key]: value,
      },
    }))
  }

  const currentTitle = tabs.find((tab) => tab.key === activeTab)?.label || "Access Control"
  const isEditing = Boolean(editingItem?._id)
  const addButtonLabel =
    activeTab === "departments"
      ? "Add Department"
      : activeTab === "positions"
      ? "Add Position"
      : activeTab === "permission-groups"
      ? "Add Permission Group"
      : "Add Role"
  return (
    <div className={shell}>
      <Toaster position="top-right" toastOptions={{ duration: 2600, style: { borderRadius: "14px", fontWeight: 700 } }} />

      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <div className={`${card} mb-5 p-4 sm:p-5`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
                <FiShield className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
                  Access Control
                </h1>
                <p className="mt-1 text-sm font-medium text-gray-500">
                  Build employee access from departments, positions, and permission groups.
                </p>
              </div>
            </div>
            <button className={`${btn} ${btnGhost}`} onClick={loadAll}>
              <FiRefreshCcw className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        <div className="mb-5 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-1.5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
          <div className="flex min-w-max gap-1" role="tablist" aria-label="Access control sections">
            {tabs.map(({ key, label, icon: Icon, count }) => {
              const active = activeTab === key
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                    active
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-950"
                  }`}
                  onClick={() => setActiveTab(key)}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5">
          <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[0_18px_45px_-34px_rgba(15,23,42,0.45)]">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-extrabold text-gray-900">{currentTitle}</h2>
                <p className="text-sm font-medium text-gray-500">Review and manage existing records.</p>
              </div>
              {canManageAccessControl ? (
                <button className={`${btn} ${btnPrimary}`} onClick={() => openCreateModal(activeTab)} type="button">
                  <FiPlus />
                  {addButtonLabel}
                </button>
              ) : null}
            </div>

            {activeTab === "departments" ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left">
                  <thead>
                    <tr>
                      {["Department", "Description", "Status", "Actions"].map((heading) => (
                        <th key={heading} className="border-b border-gray-200 bg-gray-50 px-5 py-4 text-xs font-extrabold uppercase tracking-[0.06em] text-gray-600">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((department) => (
                      <tr key={department._id} className="group">
                        <td className="border-b border-gray-100 px-5 py-4 text-base font-extrabold text-gray-900 group-hover:bg-indigo-50/40">{department.name}</td>
                        <td className="border-b border-gray-100 px-5 py-4 text-sm font-medium text-gray-600 group-hover:bg-indigo-50/40">{department.description || "No description added"}</td>
                        <td className="border-b border-gray-100 px-5 py-4 group-hover:bg-indigo-50/40"><StatusBadge active={department.isActive !== false} /></td>
                        <td className="border-b border-gray-100 px-5 py-4 text-right group-hover:bg-indigo-50/40">
                          {canManageAccessControl ? (
                            <div className="flex justify-end gap-2">
                              <button className="inline-flex rounded-xl p-2.5 text-indigo-600 transition hover:bg-indigo-50" onClick={() => openEditModal("departments", department)} title="Edit department">
                                <FiEdit3 />
                              </button>
                              <button className="inline-flex rounded-xl p-2.5 text-rose-600 transition hover:bg-rose-50" onClick={() => requestDelete({ path: `/access-control/departments/${department._id}`, label: department.name, type: "department" })} title="Delete department">
                                <FiTrash2 />
                              </button>
                            </div>
                          ) : <span className="text-xs font-semibold text-gray-400">View only</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!departments.length ? <EmptyTable icon={<FiLayers />} title="No departments yet" subtitle="Create your first department from the form." /> : null}
              </div>
            ) : null}

            {activeTab === "positions" ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1040px] border-separate border-spacing-0 text-left">
                  <thead>
                    <tr>
                      {["Position", "Department", "Salary Template", "Rules", "Status", "Actions"].map((heading) => (
                        <th key={heading} className="border-b border-gray-200 bg-gray-50 px-5 py-4 text-xs font-extrabold uppercase tracking-[0.06em] text-gray-600">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((position) => (
                      <tr key={position._id} className="group">
                        <td className="border-b border-gray-100 px-5 py-4 text-base font-extrabold text-gray-900 group-hover:bg-indigo-50/40">{position.title}</td>
                        <td className="border-b border-gray-100 px-5 py-4 text-sm font-semibold text-gray-700 group-hover:bg-indigo-50/40">{position.department?.name || "No department"}</td>
                        <td className="border-b border-gray-100 px-5 py-4 group-hover:bg-indigo-50/40">
                          {position.defaultSalaryEnabled && Number(position.defaultBasicSalary || 0) > 0 ? (
                            <div className="flex flex-col gap-1">
                              <p className="text-sm font-extrabold text-gray-900">
                                {money(position.defaultBasicSalary, position.defaultCurrency)}
                              </p>
                              <p className="text-xs font-semibold text-gray-500">
                                {String(position.defaultSalaryType || "monthly").replace(/\b\w/g, (char) => char.toUpperCase())} • {position.defaultWorkingDaysPerMonth || 26} days • {position.defaultWorkingHoursPerDay || 8}h/day
                              </p>
                            </div>
                          ) : (
                            <span className="text-sm font-semibold text-gray-400">No default salary</span>
                          )}
                        </td>
                        <td className="border-b border-gray-100 px-5 py-4 text-sm font-medium text-gray-600 group-hover:bg-indigo-50/40">
                          {position.defaultSalaryEnabled ? (
                            <div className="flex flex-wrap gap-1.5">
                              {position.defaultRules?.overtime?.enabled ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">Overtime</span> : null}
                              {position.defaultRules?.lateDeduction?.enabled ? <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">Late</span> : null}
                              {position.defaultRules?.absentDeduction?.enabled ? <span className="rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700">Absent</span> : null}
                              {position.defaultRules?.unpaidLeaveDeduction?.enabled ? <span className="rounded-full bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-700">Unpaid Leave</span> : null}
                            </div>
                          ) : (
                            <span className="text-sm font-semibold text-gray-400">No salary rules</span>
                          )}
                        </td>
                        <td className="border-b border-gray-100 px-5 py-4 group-hover:bg-indigo-50/40"><StatusBadge active={position.isActive !== false} /></td>
                        <td className="border-b border-gray-100 px-5 py-4 text-right group-hover:bg-indigo-50/40">
                          {canManageAccessControl ? (
                            <div className="flex justify-end gap-2">
                              <button className="inline-flex rounded-xl p-2.5 text-indigo-600 transition hover:bg-indigo-50" onClick={() => openEditModal("positions", position)} title="Edit position">
                                <FiEdit3 />
                              </button>
                              <button className="inline-flex rounded-xl p-2.5 text-rose-600 transition hover:bg-rose-50" onClick={() => requestDelete({ path: `/access-control/positions/${position._id}`, label: position.title, type: "position" })} title="Delete position">
                                <FiTrash2 />
                              </button>
                            </div>
                          ) : <span className="text-xs font-semibold text-gray-400">View only</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!positions.length ? <EmptyTable icon={<FiBriefcase />} title="No positions yet" subtitle="Create positions under departments from the form." /> : null}
              </div>
            ) : null}

            {activeTab === "permission-groups" ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left">
                  <thead>
                    <tr>
                      {["Group", "Description", "Feature Access", "Status", "Actions"].map((heading) => (
                        <th key={heading} className="border-b border-gray-200 bg-gray-50 px-5 py-4 text-xs font-extrabold uppercase tracking-[0.06em] text-gray-600">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {permissionGroups.map((group) => (
                      <tr key={group._id} className="group align-top">
                        <td className="border-b border-gray-100 px-5 py-4 text-base font-extrabold text-gray-900 group-hover:bg-indigo-50/40">{group.name}</td>
                        <td className="border-b border-gray-100 px-5 py-4 text-sm font-medium text-gray-600 group-hover:bg-indigo-50/40">{group.description || "No description added"}</td>
                        <td className="border-b border-gray-100 px-5 py-4 group-hover:bg-indigo-50/40">
                          <div className="flex max-w-xl flex-wrap gap-2">
                            {(group.permissions || []).length ? (
                              group.permissions.map((permission) => (
                                <PermissionPill key={permission} permissionKey={permission} />
                              ))
                            ) : (
                              <span className="text-sm font-medium text-gray-400">No feature access selected</span>
                            )}
                          </div>
                        </td>
                        <td className="border-b border-gray-100 px-5 py-4 group-hover:bg-indigo-50/40"><StatusBadge active={group.isActive !== false} /></td>
                        <td className="border-b border-gray-100 px-5 py-4 text-right group-hover:bg-indigo-50/40">
                          {canManageAccessControl ? (
                            <div className="flex justify-end gap-2">
                              <button className="inline-flex rounded-xl p-2.5 text-indigo-600 transition hover:bg-indigo-50" onClick={() => openEditModal("permission-groups", group)} title="Edit permission group">
                                <FiEdit3 />
                              </button>
                              <button className="inline-flex rounded-xl p-2.5 text-rose-600 transition hover:bg-rose-50" onClick={() => requestDelete({ path: `/access-control/permission-groups/${group._id}`, label: group.name, type: "permission group" })} title="Delete permission group">
                                <FiTrash2 />
                              </button>
                            </div>
                          ) : <span className="text-xs font-semibold text-gray-400">View only</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!permissionGroups.length ? <EmptyTable icon={<FiCheckSquare />} title="No permission groups yet" subtitle="Create a group and choose readable feature access labels." /> : null}
              </div>
            ) : null}

            {activeTab === "roles" ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-separate border-spacing-0 text-left">
                  <thead>
                    <tr>
                      {["Role", "Description", "Permission Group", "Status", "Actions"].map((heading) => (
                        <th key={heading} className="border-b border-gray-200 bg-gray-50 px-5 py-4 text-xs font-extrabold uppercase tracking-[0.06em] text-gray-600">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {roles.map((role) => (
                      <tr key={role._id} className="group">
                        <td className="border-b border-gray-100 px-5 py-4 group-hover:bg-indigo-50/40">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-extrabold text-gray-900">{role.name}</span>
                            {role.isSystem ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600"><FiLock />System</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="border-b border-gray-100 px-5 py-4 text-sm font-medium text-gray-600 group-hover:bg-indigo-50/40">{role.description || "No description added"}</td>
                        <td className="border-b border-gray-100 px-5 py-4 group-hover:bg-indigo-50/40">
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{role.permissionGroup?.name || "No permission group"}</p>
                            <p className="mt-1 text-xs text-gray-500">
                              {role.isSystem && role.name === "Employee"
                                ? "Varies by employee"
                                : `${role.permissionGroup?.permissions?.length || 0} feature permissions`}
                            </p>
                          </div>
                        </td>
                        <td className="border-b border-gray-100 px-5 py-4 group-hover:bg-indigo-50/40"><StatusBadge active={role.isActive !== false} /></td>
                        <td className="border-b border-gray-100 px-5 py-4 text-right group-hover:bg-indigo-50/40">
                          {role.isSystem ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400"><FiLock />Protected</span>
                          ) : canManageAccessControl ? (
                            <div className="flex justify-end gap-2">
                              <button className="inline-flex rounded-xl p-2.5 text-indigo-600 transition hover:bg-indigo-50" onClick={() => openEditModal("roles", role)} title="Edit role"><FiEdit3 /></button>
                              <button className="inline-flex rounded-xl p-2.5 text-rose-600 transition hover:bg-rose-50" onClick={() => requestDelete({ path: `/access-control/roles/${role._id}`, label: role.name, type: "role" })} title="Delete role"><FiTrash2 /></button>
                            </div>
                          ) : <span className="text-xs font-semibold text-gray-400">View only</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!roles.length ? <EmptyTable icon={<FiUserCheck />} title="No custom roles yet" subtitle="Create a role and connect it to a permission group." /> : null}
              </div>
            ) : null}
          </section>
        </div>

        <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-800">
          Flow: Create Departments, Positions, Permission Groups, and Roles. A role uses a permission group to define its feature access.
        </div>
      </div>

      <AccessModal
        open={createModal === "departments"}
        title={isEditing ? "Edit Department" : "Add Department"}
        subtitle={isEditing ? "Update this department." : "Create a top-level team or business unit."}
        icon={<FiLayers className="h-5 w-5" />}
        maxWidthClass="max-w-xl"
        onClose={closeModal}
        footer={
          <div className="flex justify-end gap-2">
            <button className={`${btn} ${btnGhost}`} onClick={closeModal} type="button">Cancel</button>
            <button className={`${btn} ${btnPrimary}`} form="department-create-form" type="submit">
              {isEditing ? "Update Department" : "Create Department"}
            </button>
          </div>
        }
      >
        <form id="department-create-form" onSubmit={createDepartment} className="space-y-4">
          <Field label="Department Name">
            <input
              required
              className={input}
              placeholder="Example: Sales"
              value={departmentForm.name}
              onChange={(e) => setDepartmentForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </Field>
          <Field label="Description">
            <textarea
              className={`${input} h-28 resize-none py-3`}
              placeholder="What this department is responsible for"
              value={departmentForm.description}
              onChange={(e) =>
                setDepartmentForm((prev) => ({ ...prev, description: e.target.value }))
              }
            />
          </Field>
        </form>
      </AccessModal>

      <AccessModal
        open={createModal === "positions"}
        title={isEditing ? "Edit Position" : "Add Position"}
        subtitle={isEditing ? "Update designation and default salary template." : "Create a designation with optional default salary template."}
        icon={<FiBriefcase className="h-5 w-5" />}
        maxWidthClass="max-w-5xl"
        onClose={closeModal}
        footer={
          <div className="flex justify-end gap-2">
            <button className={`${btn} ${btnGhost}`} onClick={closeModal} type="button">Cancel</button>
            <button className={`${btn} ${btnPrimary}`} form="position-create-form" type="submit">
              {isEditing ? "Update Position" : "Create Position"}
            </button>
          </div>
        }
      >
        <form id="position-create-form" onSubmit={createPosition} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Department">
              <select
                required
                className={input}
                value={positionForm.department}
                onChange={(e) => updatePositionForm("department", e.target.value)}
              >
                <option value="">Select department</option>
                {activeDepartments.map((department) => (
                  <option key={department._id} value={department._id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Position / Designation">
              <input
                required
                className={input}
                placeholder="Example: Sales Executive"
                value={positionForm.title}
                onChange={(e) => updatePositionForm("title", e.target.value)}
              />
            </Field>
          </div>

          <Field label="Description">
            <textarea
              className={`${input} h-24 resize-none py-3`}
              placeholder="What this position is responsible for"
              value={positionForm.description}
              onChange={(e) => updatePositionForm("description", e.target.value)}
            />
          </Field>

          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={positionForm.defaultSalaryEnabled}
                onChange={(e) => updatePositionForm("defaultSalaryEnabled", e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                <span className="flex items-center gap-2 text-sm font-extrabold text-gray-900">
                  <FiDollarSign className="h-4 w-4 text-indigo-600" />
                  Use this position as a salary template
                </span>
                <span className="mt-1 block text-sm font-medium text-gray-600">
                  When an employee is assigned this position, the backend creates their active Salary Profile from these defaults. Employee-specific salary changes stay in Salary Profiles.
                </span>
              </span>
            </label>
          </div>

          {positionForm.defaultSalaryEnabled ? (
            <div className="space-y-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field label="Default Basic Salary">
                  <input
                    type="number"
                    min="0"
                    className={input}
                    placeholder="Example: 25000"
                    value={positionForm.defaultBasicSalary}
                    onChange={(e) => updatePositionForm("defaultBasicSalary", e.target.value)}
                  />
                </Field>
                <Field label="Salary Type">
                  <select
                    className={input}
                    value={positionForm.defaultSalaryType}
                    onChange={(e) => updatePositionForm("defaultSalaryType", e.target.value)}
                  >
                    {salaryTypes.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Currency">
                  <input
                    className={input}
                    value={positionForm.defaultCurrency}
                    onChange={(e) => updatePositionForm("defaultCurrency", e.target.value.toUpperCase())}
                  />
                </Field>
                <Field label="Working Days / Month">
                  <input
                    type="number"
                    min="1"
                    max="31"
                    className={input}
                    value={positionForm.defaultWorkingDaysPerMonth}
                    onChange={(e) => updatePositionForm("defaultWorkingDaysPerMonth", e.target.value)}
                  />
                </Field>
                <Field label="Working Hours / Day">
                  <input
                    type="number"
                    min="1"
                    max="24"
                    className={input}
                    value={positionForm.defaultWorkingHoursPerDay}
                    onChange={(e) => updatePositionForm("defaultWorkingHoursPerDay", e.target.value)}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <label className="mb-3 flex items-center gap-2 text-sm font-extrabold text-gray-900">
                    <input
                      type="checkbox"
                      checked={positionForm.defaultRules.overtime.enabled}
                      onChange={(e) => updatePositionRule("overtime", "enabled", e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Overtime Earning
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Calculation Type">
                      <select className={input} value={positionForm.defaultRules.overtime.calculationType} onChange={(e) => updatePositionRule("overtime", "calculationType", e.target.value)}>
                        {overtimeCalcTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Amount / Rate">
                      <input type="number" min="0" className={input} value={positionForm.defaultRules.overtime.value} onChange={(e) => updatePositionRule("overtime", "value", Number(e.target.value || 0))} />
                    </Field>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <label className="mb-3 flex items-center gap-2 text-sm font-extrabold text-gray-900">
                    <input
                      type="checkbox"
                      checked={positionForm.defaultRules.lateDeduction.enabled}
                      onChange={(e) => updatePositionRule("lateDeduction", "enabled", e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Late Deduction
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Grace Minutes">
                      <input type="number" min="0" className={input} value={positionForm.defaultRules.lateDeduction.graceMinutes} onChange={(e) => updatePositionRule("lateDeduction", "graceMinutes", Number(e.target.value || 0))} />
                    </Field>
                    <Field label="Calculation Type">
                      <select className={input} value={positionForm.defaultRules.lateDeduction.calculationType} onChange={(e) => updatePositionRule("lateDeduction", "calculationType", e.target.value)}>
                        <option value="fixed">Fixed</option>
                        <option value="per_minute">Per Minute</option>
                        <option value="percentage">Percentage</option>
                      </select>
                    </Field>
                    <Field label="Amount / Rate">
                      <input type="number" min="0" className={input} value={positionForm.defaultRules.lateDeduction.value} onChange={(e) => updatePositionRule("lateDeduction", "value", Number(e.target.value || 0))} />
                    </Field>
                  </div>
                </div>

                {[
                  ["absentDeduction", "Absent Deduction"],
                  ["unpaidLeaveDeduction", "Unpaid Leave Deduction"],
                ].map(([ruleKey, label]) => (
                  <div key={ruleKey} className="rounded-2xl border border-gray-200 bg-white p-4">
                    <label className="mb-3 flex items-center gap-2 text-sm font-extrabold text-gray-900">
                      <input
                        type="checkbox"
                        checked={positionForm.defaultRules[ruleKey].enabled}
                        onChange={(e) => updatePositionRule(ruleKey, "enabled", e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      {label}
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Calculation Type">
                        <select className={input} value={positionForm.defaultRules[ruleKey].calculationType} onChange={(e) => updatePositionRule(ruleKey, "calculationType", e.target.value)}>
                          {salaryRuleCalcTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                        </select>
                      </Field>
                      <Field label="Amount / Rate">
                        <input type="number" min="0" className={input} value={positionForm.defaultRules[ruleKey].value} onChange={(e) => updatePositionRule(ruleKey, "value", Number(e.target.value || 0))} />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700">
                  <input type="checkbox" checked={positionForm.defaultRules.weeklyHolidayPaid} onChange={(e) => updatePositionRuleFlag("weeklyHolidayPaid", e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  Weekly holiday is paid
                </label>
                <label className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700">
                  <input type="checkbox" checked={positionForm.defaultRules.paidLeaveAllowed} onChange={(e) => updatePositionRuleFlag("paidLeaveAllowed", e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  Paid leave is allowed
                </label>
              </div>
            </div>
          ) : null}
        </form>
      </AccessModal>

      <AccessModal
        open={createModal === "permission-groups"}
        title={isEditing ? "Edit Permission Group" : "Add Permission Group"}
        subtitle={isEditing ? "Update feature access for this group." : "Choose the feature access employees will receive."}
        icon={<FiShield className="h-5 w-5" />}
        maxWidthClass="max-w-5xl"
        onClose={closeModal}
        footer={
          <div className="flex justify-end gap-2">
            <button className={`${btn} ${btnGhost}`} onClick={closeModal} type="button">Cancel</button>
            <button className={`${btn} ${btnPrimary}`} form="permission-group-create-form" type="submit">
              {isEditing ? "Update Permission Group" : "Create Permission Group"}
            </button>
          </div>
        }
      >
        <form id="permission-group-create-form" onSubmit={createPermissionGroup} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Permission Group Name">
              <input
                required
                className={input}
                placeholder="Example: Lead Access"
                value={groupForm.name}
                onChange={(e) => setGroupForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </Field>
            <Field label="Description">
              <input
                className={input}
                placeholder="Who should receive this access"
                value={groupForm.description}
                onChange={(e) =>
                  setGroupForm((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </Field>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-extrabold text-gray-800">Feature Access</p>
              <span className="text-xs font-semibold text-gray-500">{groupForm.permissions.length} selected</span>
            </div>
            <div className="space-y-4">
              {permissionSections.map((section) => (
                <section key={section.moduleName} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                  <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
                    <h3 className="text-sm font-extrabold text-gray-900">{section.label}</h3>
                    <span className="text-xs font-semibold text-gray-500">
                      {section.permissions.filter((permission) => groupForm.permissions.includes(permission.key)).length}/{section.permissions.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 p-3 md:grid-cols-2">
                    {section.permissions.map((permission) => {
                      const meta = permissionMeta(permission.key)
                      const checked = groupForm.permissions.includes(permission.key)
                      return (
                        <label
                          key={permission.key}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition ${
                            checked ? "border-indigo-200 bg-indigo-50" : "border-gray-100 bg-gray-50 hover:bg-white"
                          }`}
                        >
                          <input type="checkbox" checked={checked} onChange={() => togglePermission(permission.key)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                          <span>
                            <span className="block text-sm font-extrabold text-gray-900">{meta.label}</span>
                            <span className="mt-0.5 block text-xs font-medium text-gray-500">{meta.helper}</span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </form>
      </AccessModal>

      <AccessModal
        open={createModal === "roles"}
        title={isEditing ? "Edit Role" : "Add Role"}
        subtitle={isEditing ? "Update the role and its access group." : "Create a company role and connect its feature access."}
        icon={<FiUserCheck className="h-5 w-5" />}
        maxWidthClass="max-w-2xl"
        onClose={closeModal}
        footer={
          <div className="flex justify-end gap-2">
            <button className={`${btn} ${btnGhost}`} onClick={closeModal} type="button">Cancel</button>
            <button className={`${btn} ${btnPrimary}`} form="role-create-form" type="submit">
              {isEditing ? "Update Role" : "Create Role"}
            </button>
          </div>
        }
      >
        <form id="role-create-form" onSubmit={createRole} className="space-y-4">
          <Field label="Role Name">
            <input
              required
              className={input}
              placeholder="Example: Team Lead"
              value={roleForm.name}
              onChange={(e) => setRoleForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </Field>
          <Field label="Permission Group">
            <select
              required
              className={input}
              value={roleForm.permissionGroup}
              onChange={(e) => setRoleForm((prev) => ({ ...prev, permissionGroup: e.target.value }))}
            >
              <option value="">Select permission group</option>
              {permissionGroups.filter((group) => group.isActive !== false).map((group) => (
                <option key={group._id} value={group._id}>{group.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Description">
            <textarea
              className={`${input} h-28 resize-none py-3`}
              placeholder="Describe who should receive this role"
              value={roleForm.description}
              onChange={(e) => setRoleForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </Field>
        </form>
      </AccessModal>

      <AccessModal
        open={deleteState.open}
        title={`Delete ${deleteState.type || "item"}`}
        subtitle={deleteState.label || "Confirm deletion"}
        icon={<FiTrash2 className="h-5 w-5" />}
        maxWidthClass="max-w-xl"
        onClose={closeDeleteModal}
        footer={
          <div className="flex justify-end gap-2">
            <button className={`${btn} ${btnGhost}`} disabled={deleteState.loading} onClick={closeDeleteModal} type="button">Cancel</button>
            <button className={`${btn} ${btnDanger}`} disabled={deleteState.loading || deleteState.password.length < 6} form="access-control-delete-form" type="submit">
              {deleteState.loading ? "Deleting..." : "Delete"}
            </button>
          </div>
        }
      >
        <form id="access-control-delete-form" onSubmit={removeItem} className="space-y-4">
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
            This will delete {deleteState.label ? <span className="font-extrabold">{deleteState.label}</span> : "this item"}. Enter your password to continue.
          </div>
          <Field label="Admin Password">
            <div className="relative">
              <FiLock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-500" />
              <input
                className={`${input} pl-10`}
                type="password"
                value={deleteState.password}
                onChange={(event) => setDeleteState((prev) => ({ ...prev, password: event.target.value }))}
                placeholder="Enter admin password"
                autoFocus
              />
            </div>
          </Field>
        </form>
      </AccessModal>
    </div>
  )
}
