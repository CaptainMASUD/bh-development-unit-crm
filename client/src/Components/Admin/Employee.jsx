"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import toast, { Toaster } from "react-hot-toast"
import {
  FiCamera,
  FiClock,
  FiEdit3,
  FiEye,
  FiFilter,
  FiLock,
  FiMoreVertical,
  FiPlus,
  FiRefreshCcw,
  FiSearch,
  FiUploadCloud,
  FiShield,
  FiTrash2,
  FiUser,
  FiUsers,
  FiX,
} from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const PAGE_SIZE = 25

const shell = "min-h-screen bg-gradient-to-b from-gray-50 to-white"
const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_28px_-16px_rgba(0,0,0,0.28)]"
const btn =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
const btnPrimary = "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
const btnGhost = "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
const btnDanger = "bg-rose-600 text-white hover:bg-rose-700"
const input =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-indigo-500/40"

function cn(...classes) {
  return classes.filter(Boolean).join(" ")
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

async function apiFormData(path, formData, options = {}) {
  const token = localStorage.getItem("token")
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    method: options.method || "PATCH",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: formData,
    credentials: "include",
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Request failed")
  return data
}

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-gray-800">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs font-medium text-gray-500">{hint}</span> : null}
    </label>
  )
}

function Modal({ open, title, subtitle, icon, children, footer, onClose, maxWidthClass = "max-w-4xl" }) {
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

function StatusBadge({ active, label }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
        active
          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/10"
          : "bg-gray-100 text-gray-600 ring-gray-600/10"
      }`}
    >
      {label || (active ? "Active" : "Inactive")}
    </span>
  )
}

function EmployeeDetailsModal({ open, employee, onClose, onEdit, onDelete }) {
  if (!open) return null

  return (
    <Modal
      open={open}
      title="Employee Details"
      subtitle={employee?.employeeId || employee?.email || "Employee profile"}
      icon={<FiEye className="h-5 w-5" />}
      onClose={onClose}
      maxWidthClass="max-w-4xl"
      footer={
        <div className="flex flex-col justify-between gap-2 sm:flex-row">
          <button className={`${btn} ${btnGhost}`} type="button" onClick={onClose}>
            Close
          </button>

          {employee ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                className={`${btn} ${btnPrimary}`}
                type="button"
                onClick={() => {
                  onClose?.()
                  onEdit?.(employee)
                }}
              >
                <FiEdit3 className="h-4 w-4" />
                Edit
              </button>
              <button
                className={`${btn} ${btnDanger}`}
                type="button"
                onClick={() => {
                  onClose?.()
                  onDelete?.(employee)
                }}
              >
                <FiTrash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          ) : null}
        </div>
      }
    >
      {!employee ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm font-semibold text-gray-500">
          No employee selected.
        </div>
      ) : (
        <div className="space-y-5">
          <div className={`${card} p-5`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gray-100 ring-1 ring-gray-200">
                {employee.avatarUrl ? (
                  <img src={employee.avatarUrl} alt={employee.name || "Employee"} className="h-full w-full object-cover" />
                ) : (
                  <FiUser className="h-8 w-8 text-gray-500" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-xl font-extrabold text-gray-900">{employee.name || "Unnamed employee"}</p>
                    <p className="mt-1 truncate text-sm font-semibold text-gray-500">{employee.email || "No email"}</p>
                    {employee.employeeId ? <p className="mt-2 text-sm font-bold text-indigo-600">{employee.employeeId}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge active={employee.isActive !== false} label={employee.isActive !== false ? "Enabled" : "Disabled"} />
                    <span className="inline-flex w-fit rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                      {pretty(employee.employeeStatus || "active")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {[
              ["Phone", employee.phone || "—"],
              ["Department", employee.department?.name || "Not assigned"],
              ["Designation", employee.position?.title || "Not assigned"],
              ["Access Group", employee.permissionGroup?.name || "No access group"],
              ["Employment Type", pretty(employee.employmentType || "full_time")],
              ["Salary Type", `${pretty(employee.salaryType || "fixed")} Salary`],
              ["Work Status", pretty(employee.workStatus || "available")],
              ["Daily Lead Limit", employee.dailyLeadLimit || 0],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4">
                <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-gray-400">{label}</p>
                <p className="mt-1.5 text-sm font-extrabold text-gray-900">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}

function EmployeeActionMenu({ employee, openMenuId, setOpenMenuId, onView, onEdit, onDelete }) {
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef(null)
  const open = openMenuId === employee?._id

  const close = useCallback(() => setOpenMenuId(null), [setOpenMenuId])

  const runAction = useCallback(
    (action) => {
      close()
      window.requestAnimationFrame(() => action?.(employee))
    },
    [close, employee]
  )

  useEffect(() => {
    if (!open) return

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) return

      const width = 190
      const height = 154
      const gap = 8
      const left = Math.min(window.innerWidth - width - 12, Math.max(12, rect.right - width))
      const openAbove = rect.bottom + height + gap > window.innerHeight
      const top = openAbove ? Math.max(12, rect.top - height - gap) : Math.min(window.innerHeight - height - 12, rect.bottom + gap)

      setPosition({ top, left })
    }

    updatePosition()

    const closeMenu = () => close()
    const onKey = (event) => event.key === "Escape" && close()

    window.addEventListener("click", closeMenu)
    window.addEventListener("keydown", onKey)
    window.addEventListener("scroll", updatePosition, true)
    window.addEventListener("resize", updatePosition)

    return () => {
      window.removeEventListener("click", closeMenu)
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("scroll", updatePosition, true)
      window.removeEventListener("resize", updatePosition)
    }
  }, [close, open])

  const itemClass =
    "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold text-gray-700 transition hover:bg-gray-50"

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            style={{ position: "fixed", top: position.top, left: position.left, width: 190 }}
            className="z-[9999] rounded-2xl border border-gray-100 bg-white p-2 shadow-[0_16px_38px_-24px_rgba(15,23,42,0.45)] ring-1 ring-black/5"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className={itemClass} onClick={() => runAction(onView)}>
              <FiEye className="h-4 w-4 text-indigo-600" />
              View details
            </button>
            <button type="button" className={itemClass} onClick={() => runAction(onEdit)}>
              <FiEdit3 className="h-4 w-4 text-gray-600" />
              Edit employee
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold text-rose-700 transition hover:bg-rose-50"
              onClick={() => runAction(onDelete)}
            >
              <FiTrash2 className="h-4 w-4" />
              Delete employee
            </button>
          </div>,
          document.body
        )
      : null

  return (
    <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
      <button type="button" className={`${btn} ${btnPrimary} h-10 px-3 py-2 shadow-sm shadow-indigo-600/15`} onClick={() => onView?.(employee)}>
        <FiEye className="h-4 w-4" />
        View
      </button>

      <button
        ref={buttonRef}
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50"
        onClick={(event) => {
          event.stopPropagation()
          setOpenMenuId(open ? null : employee._id)
        }}
        title="More actions"
      >
        <FiMoreVertical className="h-4 w-4" />
      </button>

      {menu}
    </div>
  )
}


const emptyForm = {
  name: "",
  email: "",
  password: "",
  employeeId: "",
  phone: "",
  department: "",
  position: "",
  permissionGroup: "",
  employmentType: "full_time",
  salaryType: "fixed",
  salaryProfileType: "monthly",
  currency: "BDT",
  basicSalary: "",
  workingDaysPerMonth: 26,
  workingHoursPerDay: 8,
  employeeStatus: "active",
  isActive: true,
  isAvailableForAssignment: true,
  workStatus: "available",
  dailyLeadLimit: 0,
  rosterShift: "",
  rosterType: "weekly",
  rosterStartDate: new Date().toISOString().slice(0, 10),
  rosterEndDate: "",
  rosterWeekdays: [0, 1, 2, 3, 4],
}

function getId(value) {
  return value?._id || value || ""
}

function pretty(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

const dayOptions = [
  ["0", "Sun"],
  ["1", "Mon"],
  ["2", "Tue"],
  ["3", "Wed"],
  ["4", "Thu"],
  ["5", "Fri"],
  ["6", "Sat"],
]

function WeekdayPicker({ value = [], onChange }) {
  const selected = new Set((value || []).map(Number))
  return (
    <div className="flex flex-wrap gap-2">
      {dayOptions.map(([raw, label]) => {
        const day = Number(raw)
        const active = selected.has(day)
        return (
          <button
            key={raw}
            type="button"
            className={`rounded-xl px-3 py-2 text-xs font-extrabold ring-1 transition ${
              active
                ? "bg-indigo-600 text-white ring-indigo-600"
                : "bg-white text-gray-600 ring-gray-200 hover:bg-gray-50"
            }`}
            onClick={() => onChange(active ? value.filter((item) => Number(item) !== day) : [...value, day])}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

export default function Employee() {
  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [positions, setPositions] = useState([])
  const [permissionGroups, setPermissionGroups] = useState([])
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState("")
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [filters, setFilters] = useState({
    active: "all",
    department: "",
    position: "",
    employeeStatus: "",
    employmentType: "",
  })
  const [filterDraft, setFilterDraft] = useState(filters)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState("")
  const [avatarObjectUrl, setAvatarObjectUrl] = useState("")
  const [avatarRemove, setAvatarRemove] = useState(false)
  const [deleteState, setDeleteState] = useState({ open: false, employee: null, password: "", loading: false })
  const [detailsState, setDetailsState] = useState({ open: false, employee: null })
  const [openMenuId, setOpenMenuId] = useState(null)
  const abortRef = useRef(null)
  const avatarInputRef = useRef(null)

  const filteredPositions = useMemo(() => {
    if (!form.department) return positions
    return positions.filter((position) => String(getId(position.department)) === String(form.department))
  }, [form.department, positions])

  const selectedPosition = useMemo(
    () => positions.find((position) => String(position._id) === String(form.position)) || null,
    [form.position, positions]
  )

  const selectedShift = useMemo(
    () => shifts.find((shift) => String(shift._id) === String(form.rosterShift)) || null,
    [form.rosterShift, shifts]
  )

  const filterPositionOptions = useMemo(() => {
    if (!filters.department) return positions
    return positions.filter((position) => String(getId(position.department)) === String(filters.department))
  }, [filters.department, positions])

  const loadAccessLists = async () => {
    try {
      const [departmentsRes, positionsRes, groupsRes, shiftsRes] = await Promise.all([
        api("/access-control/departments"),
        api("/access-control/positions"),
        api("/access-control/permission-groups"),
        api("/roster/shifts"),
      ])
      setDepartments(departmentsRes.departments || [])
      setPositions(positionsRes.positions || [])
      setPermissionGroups(groupsRes.permissionGroups || [])
      setShifts(shiftsRes.shifts || [])
    } catch (error) {
      toast.error(error.message || "Failed to load access lists")
    }
  }

  const buildEmployeeQuery = ({ cursor = "" } = {}) => {
    const params = new URLSearchParams()
    params.set("limit", String(PAGE_SIZE))
    params.set("sort", "newest")
    if (debouncedQuery) params.set("q", debouncedQuery)
    if (filters.active !== "all") params.set("active", String(filters.active === "active"))
    if (filters.department) params.set("department", filters.department)
    if (filters.position) params.set("position", filters.position)
    if (filters.employeeStatus) params.set("employeeStatus", filters.employeeStatus)
    if (filters.employmentType) params.set("employmentType", filters.employmentType)
    if (cursor) params.set("cursor", cursor)
    return `/users/employees?${params.toString()}`
  }

  const loadEmployees = async ({ reset = true } = {}) => {
    abortRef.current?.abort?.()
    const controller = new AbortController()
    abortRef.current = controller
    if (reset) {
      setLoading(true)
      setEmployees([])
      setNextCursor("")
      setHasMore(false)
    } else {
      setLoadingMore(true)
    }

    try {
      const data = await api(buildEmployeeQuery({ cursor: reset ? "" : nextCursor }), {
        signal: controller.signal,
      })
      const list = Array.isArray(data.employees) ? data.employees : []
      setEmployees((prev) => (reset ? list : [...prev, ...list]))
      setNextCursor(data.nextCursor || "")
      setHasMore(Boolean(data.hasMore))
    } catch (error) {
      if (error.name !== "AbortError") toast.error(error.message || "Failed to load employees")
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    loadAccessLists()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 250)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    loadEmployees({ reset: true })
    return () => abortRef.current?.abort?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, filters])

  const updateForm = (key, value) => {
    setForm((prev) => {
      const next = {
        ...prev,
        [key]: value,
        ...(key === "department" ? { position: "" } : {}),
      }

      if (key === "position") {
        const position = positions.find((item) => String(item._id) === String(value))
        next.salaryProfileType = position?.defaultSalaryType || "monthly"
        next.currency = position?.defaultCurrency || "BDT"
        next.basicSalary = position?.defaultBasicSalary ? String(position.defaultBasicSalary) : ""
        next.workingDaysPerMonth = position?.defaultWorkingDaysPerMonth || 26
        next.workingHoursPerDay = position?.defaultWorkingHoursPerDay || 8
      }

      if (key === "department") {
        next.salaryProfileType = "monthly"
        next.currency = "BDT"
        next.basicSalary = ""
        next.workingDaysPerMonth = 26
        next.workingHoursPerDay = 8
      }

      return next
    })
  }

  useEffect(() => {
    return () => {
      if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl)
    }
  }, [avatarObjectUrl])

  const resetAvatarDraft = ({ preview = "" } = {}) => {
    setAvatarFile(null)
    setAvatarPreview(preview)
    setAvatarObjectUrl("")
    setAvatarRemove(false)
    if (avatarInputRef.current) avatarInputRef.current.value = ""
  }

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type?.startsWith("image/")) {
      toast.error("Please choose a valid image file")
      event.target.value = ""
      return
    }

    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error("Image size must be under 5MB")
      event.target.value = ""
      return
    }

    const previewUrl = URL.createObjectURL(file)
    setAvatarFile(file)
    setAvatarPreview(previewUrl)
    setAvatarObjectUrl(previewUrl)
    setAvatarRemove(false)
  }

  const removeAvatarDraft = () => {
    setAvatarFile(null)
    setAvatarPreview("")
    setAvatarObjectUrl("")
    setAvatarRemove(Boolean(editing?.avatarUrl))
    if (avatarInputRef.current) avatarInputRef.current.value = ""
  }

  const uploadEmployeeAvatar = async (employeeId, file) => {
    const formData = new FormData()
    formData.append("avatar", file)
    return apiFormData(`/users/${employeeId}/avatar`, formData, { method: "PATCH" })
  }

  const assignEmployeeRoster = async (employeeId) => {
    if (!employeeId || !form.rosterShift) return null
    return api("/roster/assignments", {
      method: "POST",
      body: JSON.stringify({
        employee: employeeId,
        shift: form.rosterShift,
        rosterType: form.rosterType || "weekly",
        startDate: form.rosterStartDate || new Date().toISOString().slice(0, 10),
        endDate: form.rosterEndDate || null,
        weekdays: Array.isArray(form.rosterWeekdays) ? form.rosterWeekdays.map(Number) : [],
        isActive: true,
        note: "Assigned from employee panel.",
      }),
    })
  }

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    resetAvatarDraft()
    setModalOpen(true)
  }

  const openEdit = (employee) => {
    setEditing(employee)
    setForm({
      ...emptyForm,
      name: employee.name || "",
      email: employee.email || "",
      employeeId: employee.employeeId || "",
      phone: employee.phone || "",
      department: getId(employee.department),
      position: getId(employee.position),
      permissionGroup: getId(employee.permissionGroup),
      employmentType: employee.employmentType || "full_time",
      salaryType: employee.salaryType || "fixed",
      employeeStatus: employee.employeeStatus || "active",
      isActive: employee.isActive !== false,
      isAvailableForAssignment: employee.isAvailableForAssignment !== false,
      workStatus: employee.workStatus || "available",
      dailyLeadLimit: Number(employee.dailyLeadLimit || 0),
    })
    resetAvatarDraft({ preview: employee.avatarUrl || "" })
    setModalOpen(true)
  }

  const closeModal = (options = {}) => {
    const force = options?.force === true
    if (saving && !force) return
    setModalOpen(false)
    setEditing(null)
    setForm(emptyForm)
    resetAvatarDraft()
  }

  const saveEmployee = async (event) => {
    event.preventDefault()
    if (saving) return

    if (!form.name.trim()) return toast.error("Employee name is required")
    if (!form.email.trim()) return toast.error("Email is required")
    if (!editing && !form.password) return toast.error("Password is required")

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      ...(form.password ? { password: form.password } : {}),
      employeeId: form.employeeId.trim(),
      phone: form.phone.trim(),
      department: form.department || null,
      position: form.position || null,
      permissionGroup: form.permissionGroup || null,
      employmentType: form.employmentType,
      salaryType: form.salaryType,
      employeeStatus: form.employeeStatus,
      isActive: Boolean(form.isActive),
      isAvailableForAssignment: Boolean(form.isAvailableForAssignment),
      workStatus: form.workStatus,
      dailyLeadLimit: Number(form.dailyLeadLimit || 0),
      createSalaryProfile: Boolean(form.position && Number(form.basicSalary || 0) > 0),
      salaryProfile: form.position && Number(form.basicSalary || 0) > 0
        ? {
            salaryType: form.salaryProfileType || "monthly",
            currency: form.currency || "BDT",
            basicSalary: Number(form.basicSalary || 0),
            workingDaysPerMonth: Number(form.workingDaysPerMonth || 26),
            workingHoursPerDay: Number(form.workingHoursPerDay || 8),
          }
        : undefined,
    }

    setSaving(true)
    try {
      const data = await api(editing?._id ? `/users/employees/${editing._id}` : "/users/employees", {
        method: editing?._id ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      })

      const employeeId = editing?._id || data?.employee?._id

      if (avatarFile) {
        if (!employeeId) throw new Error("Employee saved, but avatar upload failed because employee id was missing.")
        await uploadEmployeeAvatar(employeeId, avatarFile)
      } else if (editing?._id && avatarRemove) {
        await api(`/users/${editing._id}/avatar`, { method: "DELETE" })
      }

      if (form.rosterShift && employeeId) {
        await assignEmployeeRoster(employeeId)
      }

      toast.success(form.rosterShift ? "Employee saved and roster assigned" : editing?._id ? "Employee updated" : "Employee created")
      closeModal({ force: true })
      loadEmployees({ reset: true })
    } catch (error) {
      toast.error(error.message || "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const deleteEmployee = async (event) => {
    event.preventDefault()
    const employee = deleteState.employee
    const password = deleteState.password
    if (!employee?._id) return
    if (!password || password.length < 6) return toast.error("Enter your password to delete")

    setDeleteState((prev) => ({ ...prev, loading: true }))
    try {
      await api(`/users/employees/${employee._id}`, {
        method: "DELETE",
        body: JSON.stringify({ password }),
      })
      toast.success("Employee deleted")
      setDeleteState({ open: false, employee: null, password: "", loading: false })
      loadEmployees({ reset: true })
    } catch (error) {
      toast.error(error.message || "Delete failed")
      setDeleteState((prev) => ({ ...prev, loading: false }))
    }
  }

  const resetFilters = () => {
    setQuery("")
    setFilters({ active: "all", department: "", position: "", employeeStatus: "", employmentType: "" })
    setFilterDraft({ active: "all", department: "", position: "", employeeStatus: "", employmentType: "" })
  }

  const getDepartmentName = (id) =>
    departments.find((department) => String(department._id) === String(id))?.name || ""
  const getPositionName = (id) =>
    positions.find((position) => String(position._id) === String(id))?.title || ""

  const filterLabels = {
    active: "Account",
    department: "Department",
    position: "Designation",
    employeeStatus: "Employee State",
    employmentType: "Employment",
  }

  const filterValueLabel = (key, value) => {
    if (!value || value === "all") return ""
    if (key === "department") return getDepartmentName(value) || "Selected department"
    if (key === "position") return getPositionName(value) || "Selected designation"
    if (key === "active") return value === "active" ? "Active Only" : "Inactive Only"
    return pretty(value)
  }

  const activeFilterEntries = Object.entries(filters)
    .filter(([, value]) => value && value !== "all")
    .map(([key, value]) => ({
      key,
      label: filterLabels[key] || key,
      value: filterValueLabel(key, value),
    }))
  const activeFilterCount = activeFilterEntries.length

  const draftPositionOptions = useMemo(() => {
    if (!filterDraft.department) return positions
    return positions.filter((position) => String(getId(position.department)) === String(filterDraft.department))
  }, [filterDraft.department, positions])

  const updateFilterDraft = (key, value) => {
    setFilterDraft((prev) => ({
      ...prev,
      [key]: value,
      ...(key === "department" ? { position: "" } : {}),
    }))
  }

  const clearSingleFilter = (key) => {
    setFilters((prev) => ({
      ...prev,
      [key]: key === "active" ? "all" : "",
      ...(key === "department" ? { position: "" } : {}),
    }))
  }

  return (
    <div className={shell}>
      <Toaster position="top-right" toastOptions={{ duration: 2600, style: { borderRadius: "14px", fontWeight: 700 } }} />

      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <div className={`${card} mb-5 p-4 sm:p-5`}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
                <FiUsers className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Employee</h1>
                <p className="mt-1 text-sm font-medium text-gray-500">
                  Create and manage employees with department, designation, and access group.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button className={`${btn} ${btnGhost}`} onClick={() => loadEmployees({ reset: true })}>
                <FiRefreshCcw className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
              <button className={`${btn} ${btnPrimary}`} onClick={openCreate}>
                <FiPlus />
                Add Employee
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className={activeFilterCount ? "w-full xl:max-w-[72%]" : "w-full sm:max-w-[460px] md:max-w-[520px] lg:max-w-[580px] xl:max-w-[620px]"}>
              <div className="flex min-h-[44px] w-full flex-wrap items-center gap-1.5 rounded-2xl border border-gray-200 bg-gray-50/80 px-2.5 py-1 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.10)]">
                <FiSearch className="h-4 w-4 shrink-0 text-gray-400" />

                {activeFilterEntries.map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    className="inline-flex max-w-[115px] items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-600/10 transition hover:bg-indigo-100 sm:max-w-[135px] lg:max-w-[150px]"
                    onClick={() => clearSingleFilter(filter.key)}
                    title="Remove filter"
                  >
                    <span className="truncate">
                      <span className="text-indigo-500">{filter.label}:</span> {filter.value}
                    </span>
                    <FiX className="h-3.5 w-3.5 shrink-0" />
                  </button>
                ))}

                <input
                  className="h-8 min-w-[95px] flex-1 appearance-none border-0 bg-transparent px-0 text-sm font-medium text-gray-800 shadow-none outline-none ring-0 placeholder:text-gray-400 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 sm:min-w-[120px]"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={activeFilterCount ? "Search..." : "Search employees..."}
                  type="text"
                />

                <button
                  type="button"
                  className={`inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-xl px-2 text-[13px] font-bold transition ${
                    activeFilterCount
                      ? "bg-indigo-600 text-white hover:bg-indigo-700"
                      : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"
                  }`}
                  onClick={() => {
                    setFilterDraft(filters)
                    setFiltersOpen(true)
                  }}
                >
                  <FiFilter className="h-4 w-4" />
                  Filters
                  {activeFilterCount ? <span className="rounded-full bg-white/20 px-1.5 text-xs">{activeFilterCount}</span> : null}
                </button>

                {(query || activeFilterCount) ? (
                  <button
                    type="button"
                    className="inline-flex h-8 shrink-0 items-center justify-center rounded-xl px-2.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                    onClick={resetFilters}
                    title="Clear search and filters"
                  >
                    <FiX className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>

            <p className="text-sm font-bold text-gray-500">
              Showing <span className="text-gray-900">{employees.length}</span> employee{employees.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[0_18px_45px_-34px_rgba(15,23,42,0.45)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-left">
              <thead>
                <tr>
                  {["Employee", "Department", "Designation", "Access Group", "Employment", "Status", "Actions"].map((heading) => (
                    <th
                      key={heading}
                      className={`border-b border-gray-200 bg-gray-50 px-5 py-4 text-xs font-extrabold uppercase tracking-[0.06em] text-gray-600 ${
                        heading === "Actions" ? "text-right" : ""
                      }`}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-sm font-semibold text-gray-500">
                      Loading employees...
                    </td>
                  </tr>
                ) : employees.length ? (
                  employees.map((employee) => (
                    <tr key={employee._id} className="group align-top">
                      <td className="border-b border-gray-100 px-5 py-4 group-hover:bg-indigo-50/40">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gray-100 ring-1 ring-gray-200">
                            {employee.avatarUrl ? (
                              <img src={employee.avatarUrl} alt={employee.name || "Employee"} className="h-full w-full object-cover" />
                            ) : (
                              <FiUser className="h-5 w-5 text-gray-500" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-base font-extrabold text-gray-900">{employee.name || "Unnamed"}</p>
                            <p className="truncate text-sm font-medium text-gray-500">{employee.email || "No email"}</p>
                            {employee.employeeId ? (
                              <p className="mt-1 text-xs font-semibold text-indigo-600">{employee.employeeId}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="border-b border-gray-100 px-5 py-4 text-sm font-semibold text-gray-700 group-hover:bg-indigo-50/40">
                        {employee.department?.name || "Not assigned"}
                      </td>
                      <td className="border-b border-gray-100 px-5 py-4 text-sm font-semibold text-gray-700 group-hover:bg-indigo-50/40">
                        {employee.position?.title || "Not assigned"}
                      </td>
                      <td className="border-b border-gray-100 px-5 py-4 group-hover:bg-indigo-50/40">
                        <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-600/10">
                          {employee.permissionGroup?.name || "No access group"}
                        </span>
                      </td>
                      <td className="border-b border-gray-100 px-5 py-4 group-hover:bg-indigo-50/40">
                        <div className="flex flex-col gap-1.5">
                          <p className="text-sm font-bold text-gray-700">{pretty(employee.employmentType || "full_time")}</p>
                          <span className="inline-flex w-fit rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 ring-1 ring-gray-200">
                            {pretty(employee.salaryType || "fixed")} Salary
                          </span>
                        </div>
                      </td>
                      <td className="border-b border-gray-100 px-5 py-4 group-hover:bg-indigo-50/40">
                        <div className="flex flex-col gap-2">
                          <StatusBadge active={employee.isActive !== false} label={employee.isActive !== false ? "Enabled" : "Disabled"} />
                          <span className="inline-flex w-fit rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                            {pretty(employee.employeeStatus || "active")}
                          </span>
                        </div>
                      </td>
                      <td className="border-b border-gray-100 px-5 py-4 text-right group-hover:bg-indigo-50/40">
                        <EmployeeActionMenu
                          employee={employee}
                          openMenuId={openMenuId}
                          setOpenMenuId={setOpenMenuId}
                          onView={(item) => setDetailsState({ open: true, employee: item })}
                          onEdit={openEdit}
                          onDelete={(item) => setDeleteState({ open: true, employee: item, password: "", loading: false })}
                        />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10">
                          <FiUsers className="h-5 w-5" />
                        </div>
                        <p className="mt-3 text-sm font-extrabold text-gray-900">No employees found</p>
                        <p className="mt-1 text-sm font-medium text-gray-500">Create an employee or adjust the search filters.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-gray-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-gray-700">
              {employees.length} {employees.length === 1 ? "employee" : "employees"} loaded
            </p>
            <button
              className={`${btn} ${hasMore ? btnPrimary : "cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400"}`}
              disabled={!hasMore || loadingMore || loading}
              onClick={() => loadEmployees({ reset: false })}
            >
              {loadingMore ? "Loading..." : hasMore ? "Load More" : "All Loaded"}
            </button>
          </div>
        </section>
      </div>

      <EmployeeDetailsModal
        open={detailsState.open}
        employee={detailsState.employee}
        onClose={() => setDetailsState({ open: false, employee: null })}
        onEdit={openEdit}
        onDelete={(employee) => setDeleteState({ open: true, employee, password: "", loading: false })}
      />

      <Modal
        open={modalOpen}
        title={editing ? "Edit Employee" : "Add Employee"}
        subtitle="Employee identity, avatar, department, designation, and access."
        icon={<FiUsers className="h-5 w-5" />}
        onClose={closeModal}
        footer={
          <div className="flex justify-end gap-2">
            <button className={`${btn} ${btnGhost}`} disabled={saving} onClick={closeModal} type="button">Cancel</button>
            <button className={`${btn} ${btnPrimary}`} disabled={saving} form="employee-form" type="submit">
              {saving ? (editing ? "Updating..." : "Creating...") : editing ? "Update Employee" : "Create Employee"}
            </button>
          </div>
        }
      >
        <form id="employee-form" onSubmit={saveEmployee} className="space-y-5">
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Employee avatar preview" className="h-full w-full object-cover" />
                  ) : (
                    <FiUser className="h-8 w-8 text-gray-400" />
                  )}
                  <div className="absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm ring-2 ring-white">
                    <FiCamera className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-gray-900">Profile Image</p>
                  <p className="mt-1 max-w-md text-xs font-medium leading-5 text-gray-500">
                    Upload a clear employee photo. JPG, PNG, WEBP accepted, up to 5MB.
                  </p>
                  {avatarFile ? (
                    <p className="mt-1 truncate text-xs font-semibold text-indigo-600">Selected: {avatarFile.name}</p>
                  ) : avatarRemove ? (
                    <p className="mt-1 text-xs font-semibold text-rose-600">Current image will be removed after update.</p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 sm:justify-end">
                <input
                  ref={avatarInputRef}
                  id="employee-avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
                <label
                  htmlFor="employee-avatar-upload"
                  className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 text-sm font-bold text-white transition hover:bg-indigo-700"
                >
                  <FiUploadCloud className="h-4 w-4" />
                  {avatarPreview ? "Change Image" : "Upload Image"}
                </label>
                {avatarPreview || avatarFile || avatarRemove ? (
                  <button
                    type="button"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-100 bg-white px-3 text-sm font-bold text-rose-600 transition hover:bg-rose-50"
                    onClick={removeAvatarDraft}
                  >
                    <FiTrash2 className="h-4 w-4" />
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Full Name">
              <input className={input} value={form.name} onChange={(event) => updateForm("name", event.target.value)} required />
            </Field>
            <Field label="Email">
              <input className={input} type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} required />
            </Field>
            <Field label={editing ? "New Password" : "Password"} hint={editing ? "Leave empty to keep the current password." : "At least 6 characters."}>
              <input className={input} type="password" value={form.password} onChange={(event) => updateForm("password", event.target.value)} required={!editing} />
            </Field>
            <Field label="Employee ID">
              <input className={input} value={form.employeeId} onChange={(event) => updateForm("employeeId", event.target.value)} placeholder="EMP-001" />
            </Field>
            <Field label="Phone">
              <input className={input} value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} placeholder="+880..." />
            </Field>
            <Field label="Department">
              <select className={input} value={form.department} onChange={(event) => updateForm("department", event.target.value)}>
                <option value="">Select department</option>
                {departments.map((department) => (
                  <option key={department._id} value={department._id}>{department.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Designation">
              <select className={input} value={form.position} onChange={(event) => updateForm("position", event.target.value)}>
                <option value="">Select designation</option>
                {filteredPositions.map((position) => (
                  <option key={position._id} value={position._id}>{position.title}</option>
                ))}
              </select>
            </Field>
            <Field label="Basic Salary" hint={selectedPosition ? "Auto-filled from designation. You can edit it for this employee." : "Select a designation or enter employee salary manually."}>
              <input className={input} type="number" min="0" value={form.basicSalary} onChange={(event) => updateForm("basicSalary", event.target.value)} placeholder="Example: 25000" />
            </Field>
            <Field label="Salary Profile Type">
              <select className={input} value={form.salaryProfileType} onChange={(event) => updateForm("salaryProfileType", event.target.value)}>
                <option value="monthly">Monthly</option>
                <option value="daily">Daily</option>
                <option value="hourly">Hourly</option>
              </select>
            </Field>
            <Field label="Currency">
              <input className={input} value={form.currency} onChange={(event) => updateForm("currency", event.target.value.toUpperCase())} />
            </Field>
            <Field label="Working Days / Month">
              <input className={input} type="number" min="1" max="31" value={form.workingDaysPerMonth} onChange={(event) => updateForm("workingDaysPerMonth", event.target.value)} />
            </Field>
            <Field label="Working Hours / Day">
              <input className={input} type="number" min="1" max="24" value={form.workingHoursPerDay} onChange={(event) => updateForm("workingHoursPerDay", event.target.value)} />
            </Field>
            <Field label="Permission Group">
              <select className={input} value={form.permissionGroup} onChange={(event) => updateForm("permissionGroup", event.target.value)}>
                <option value="">Select access group</option>
                {permissionGroups.map((group) => (
                  <option key={group._id} value={group._id}>{group.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Employment Type">
              <select className={input} value={form.employmentType} onChange={(event) => updateForm("employmentType", event.target.value)}>
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="intern">Intern</option>
                <option value="contract">Contract</option>
              </select>
            </Field>
            <Field label="Employee State">
              <select className={input} value={form.employeeStatus} onChange={(event) => updateForm("employeeStatus", event.target.value)}>
                <option value="active">Active</option>
                <option value="probation">Probation</option>
                <option value="on_leave">On Leave</option>
                <option value="resigned">Resigned</option>
                <option value="terminated">Terminated</option>
              </select>
            </Field>
            <Field label="Work Status">
              <select className={input} value={form.workStatus} onChange={(event) => updateForm("workStatus", event.target.value)}>
                <option value="available">Available</option>
                <option value="busy">Busy</option>
                <option value="offline">Offline</option>
                <option value="on_leave">On Leave</option>
              </select>
            </Field>
            <Field label="Daily Lead Limit">
              <input className={input} type="number" min="0" value={form.dailyLeadLimit} onChange={(event) => updateForm("dailyLeadLimit", event.target.value)} />
            </Field>
          </div>

          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-indigo-600 ring-1 ring-indigo-100">
                <FiClock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-gray-900">Assign Roster / Shift</p>
                <p className="text-xs font-semibold text-gray-500">Optional. Assign this employee to a shift from the employee panel.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Shift">
                <select className={input} value={form.rosterShift} onChange={(event) => updateForm("rosterShift", event.target.value)}>
                  <option value="">No shift assigned now</option>
                  {shifts.filter((shift) => shift.isActive !== false).map((shift) => (
                    <option key={shift._id} value={shift._id}>
                      {shift.name} ({shift.startTime} - {shift.endTime})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Roster Type">
                <select className={input} value={form.rosterType} onChange={(event) => updateForm("rosterType", event.target.value)} disabled={!form.rosterShift}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </Field>
              <Field label="Start Date">
                <input className={input} type="date" value={form.rosterStartDate} onChange={(event) => updateForm("rosterStartDate", event.target.value)} disabled={!form.rosterShift} />
              </Field>
              <Field label="End Date">
                <input className={input} type="date" value={form.rosterEndDate} onChange={(event) => updateForm("rosterEndDate", event.target.value)} disabled={!form.rosterShift} />
              </Field>
              {form.rosterType === "weekly" ? (
                <div className="md:col-span-2">
                  <Field label="Weekly Roster Days">
                    <WeekdayPicker value={form.rosterWeekdays} onChange={(days) => updateForm("rosterWeekdays", days)} />
                  </Field>
                </div>
              ) : null}
            </div>

            {selectedShift ? (
              <div className="mt-4 rounded-2xl bg-white p-3 text-sm font-semibold text-gray-600 ring-1 ring-indigo-100">
                Selected shift: <span className="font-extrabold text-gray-900">{selectedShift.name}</span> • Break {selectedShift.breakMinutes || 0} min • Grace {selectedShift.graceMinutes || 0} min
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-3 ring-1 ring-gray-100">
              <span className="text-sm font-semibold text-gray-800">Account Active</span>
              <input type="checkbox" checked={form.isActive} onChange={(event) => updateForm("isActive", event.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-3 ring-1 ring-gray-100">
              <span className="text-sm font-semibold text-gray-800">Available for Assignment</span>
              <input type="checkbox" checked={form.isAvailableForAssignment} onChange={(event) => updateForm("isAvailableForAssignment", event.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
            </label>
          </div>
        </form>
      </Modal>

      <Modal
        open={filtersOpen}
        title="Employee Filters"
        subtitle="Filter employees by account, department, designation, and job state."
        icon={<FiFilter className="h-5 w-5" />}
        onClose={() => setFiltersOpen(false)}
        maxWidthClass="max-w-4xl"
        footer={
          <div className="flex justify-end gap-2">
            <button
              className={`${btn} ${btnGhost}`}
              type="button"
              onClick={() => {
                const empty = { active: "all", department: "", position: "", employeeStatus: "", employmentType: "" }
                setFilterDraft(empty)
                setFilters(empty)
                setFiltersOpen(false)
              }}
            >
              Clear All
            </button>
            <button
              className={`${btn} ${btnPrimary}`}
              type="button"
              onClick={() => {
                setFilters(filterDraft)
                setFiltersOpen(false)
              }}
            >
              Apply Filters
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Account Status">
            <select
              className={input}
              value={filterDraft.active}
              onChange={(event) => updateFilterDraft("active", event.target.value)}
            >
              <option value="all">All Accounts</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </Field>

          <Field label="Department">
            <select
              className={input}
              value={filterDraft.department}
              onChange={(event) => updateFilterDraft("department", event.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map((department) => (
                <option key={department._id} value={department._id}>
                  {department.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Designation">
            <select
              className={input}
              value={filterDraft.position}
              onChange={(event) => updateFilterDraft("position", event.target.value)}
            >
              <option value="">All Designations</option>
              {draftPositionOptions.map((position) => (
                <option key={position._id} value={position._id}>
                  {position.title}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Employee State">
            <select
              className={input}
              value={filterDraft.employeeStatus}
              onChange={(event) => updateFilterDraft("employeeStatus", event.target.value)}
            >
              <option value="">All Employee States</option>
              <option value="active">Active</option>
              <option value="probation">Probation</option>
              <option value="on_leave">On Leave</option>
              <option value="resigned">Resigned</option>
              <option value="terminated">Terminated</option>
            </select>
          </Field>

          <Field label="Employment Type">
            <select
              className={input}
              value={filterDraft.employmentType}
              onChange={(event) => updateFilterDraft("employmentType", event.target.value)}
            >
              <option value="">All Employment Types</option>
              <option value="full_time">Full Time</option>
              <option value="part_time">Part Time</option>
              <option value="intern">Intern</option>
              <option value="contract">Contract</option>
            </select>
          </Field>
        </div>
      </Modal>

      <Modal
        open={deleteState.open}
        title="Delete Employee"
        subtitle={deleteState.employee?.name || "Confirm employee deletion"}
        icon={<FiLock className="h-5 w-5" />}
        onClose={() => !deleteState.loading && setDeleteState({ open: false, employee: null, password: "", loading: false })}
        maxWidthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <button className={`${btn} ${btnGhost}`} disabled={deleteState.loading} onClick={() => setDeleteState({ open: false, employee: null, password: "", loading: false })} type="button">Cancel</button>
            <button className={`${btn} ${btnDanger}`} disabled={deleteState.loading || deleteState.password.length < 6} form="employee-delete-form" type="submit">
              {deleteState.loading ? "Deleting..." : "Delete Employee"}
            </button>
          </div>
        }
      >
        <form id="employee-delete-form" onSubmit={deleteEmployee} className="space-y-4">
          <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            This will permanently delete the employee. Enter your password to continue.
          </p>
          <Field label="Your Password">
            <input
              className={input}
              type="password"
              value={deleteState.password}
              onChange={(event) => setDeleteState((prev) => ({ ...prev, password: event.target.value }))}
              placeholder="Enter admin password"
              autoFocus
            />
          </Field>
        </form>
      </Modal>
    </div>
  )
}
