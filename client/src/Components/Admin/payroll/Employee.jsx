"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import toast, { Toaster } from "react-hot-toast"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Calendar03Icon,
  Camera01Icon,
  Cancel01Icon,
  Clock01Icon,
  CloudUploadIcon,
  Delete02Icon,
  FilterIcon,
  LockIcon,
  MoreVerticalIcon,
  PencilEdit02Icon,
  RefreshIcon,
  Search01Icon,
  UserGroup03Icon,
  UserIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons"
import { hasPermission, PERMISSIONS } from "../../Auth/permissions"

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
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-indigo-500/40 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 disabled:opacity-80"

function cn(...classes) {
  return classes.filter(Boolean).join(" ")
}

function SelectionCheckbox({ checked = false, indeterminate = false, disabled = false, onChange, label }) {
  const active = checked || indeterminate

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation()
        onChange?.()
      }}
      className={cn(
        "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-45",
        active
          ? "border-indigo-600 bg-indigo-600 text-white shadow-[0_1px_1px_rgba(79,70,229,0.16)]"
          : "border-slate-300 bg-white text-transparent hover:border-indigo-400 hover:bg-indigo-50/40"
      )}
    >
      {indeterminate ? (
        <span className="h-[1.5px] w-2 rounded-full bg-current" aria-hidden="true" />
      ) : checked ? (
        <span className="-mt-px text-[10px] font-black leading-none" aria-hidden="true">✓</span>
      ) : null}
    </button>
  )
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

function Field({ label, children, hint, required = false }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-gray-800">
        {label}
        {required ? <span className="ml-1 text-rose-500" aria-hidden="true">*</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs font-medium text-gray-500">{hint}</span> : null}
    </label>
  )
}

function Modal({ open, title, subtitle, icon, children, footer, onClose, maxWidthClass = "max-w-4xl" }) {
  const reduceMotion = useReducedMotion()

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

  if (typeof document === "undefined") return null

  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[90]"
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition}
        >
          <div className="absolute inset-0 overflow-y-auto">
            <div className="flex min-h-full items-start justify-center p-4 sm:items-center sm:p-6">
              <motion.button
                type="button"
                aria-label="Close modal"
                className="fixed inset-0 cursor-default bg-black/40 backdrop-blur-sm"
                onClick={onClose}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={transition}
              />

              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.99 }}
                transition={transition}
                className={`relative w-full overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_30px_70px_-30px_rgba(0,0,0,0.65)] ${maxWidthClass}`}
              >
                <div className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-100 bg-white/95 p-4 backdrop-blur sm:p-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
                      {icon}
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-extrabold text-gray-900 sm:text-lg">{title}</h2>
                      {subtitle ? <p className="truncate text-sm text-gray-600">{subtitle}</p> : null}
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="rounded-xl p-2 text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
                    type="button"
                    aria-label="Close"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} size={20} />
                  </button>
                </div>

                <div className="max-h-[calc(100vh-14rem)] overflow-y-auto bg-white p-4 sm:p-5">{children}</div>
                {footer ? <div className="sticky bottom-0 z-20 border-t border-gray-100 bg-white/95 p-4 backdrop-blur sm:p-5">{footer}</div> : null}
              </motion.div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
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

function EmployeeStateBadge({ status = "active", enabled = true }) {
  if (!enabled) {
    return <StatusBadge active={false} label="Disabled" />
  }

  const normalized = String(status || "active")
  const styles = {
    active: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
    probation: "bg-amber-50 text-amber-700 ring-amber-600/10",
    on_leave: "bg-sky-50 text-sky-700 ring-sky-600/10",
    resigned: "bg-gray-100 text-gray-600 ring-gray-600/10",
    terminated: "bg-rose-50 text-rose-700 ring-rose-600/10",
  }

  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${styles[normalized] || styles.active}`}>
      {pretty(normalized)}
    </span>
  )
}

function EmployeeDetailsModal({ open, employee, salaryProfile, loading, onClose, onEdit, onDelete, canManage = true }) {
  return (
    <Modal
      open={open}
      title="Employee Details"
      subtitle={employee?.employeeId || employee?.email || "Employee profile"}
      icon={<HugeiconsIcon icon={ViewIcon} size={20} />}
      onClose={onClose}
      maxWidthClass="max-w-4xl"
      footer={
        <div className="flex flex-col justify-between gap-2 sm:flex-row">
          <button className={`${btn} ${btnGhost}`} type="button" onClick={onClose}>
            Close
          </button>

          {employee && canManage ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                className={`${btn} ${btnPrimary}`}
                type="button"
                onClick={() => {
                  onClose?.()
                  onEdit?.(employee)
                }}
              >
                <HugeiconsIcon icon={PencilEdit02Icon} size={16} />
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
                <HugeiconsIcon icon={Delete02Icon} size={16} />
                Delete
              </button>
            </div>
          ) : null}
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center p-12"><HugeiconsIcon icon={RefreshIcon} size={28} className="animate-spin text-indigo-600" /></div>
      ) : !employee ? (
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
                  <HugeiconsIcon icon={UserIcon} size={32} className="text-gray-500" />
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

          {[
            {
              title: "Personal Information",
              items: [
                ["Phone", employee.phone || "—"],
                ["Alternate Phone", employee.alternatePhone || "—"],
                ["Gender", pretty(employee.gender) || "—"],
                ["Date of Birth", formatDetailDate(employee.dateOfBirth)],
              ],
            },
            {
              title: "Employment",
              items: [
                ["Department", employee.department?.name || "Not assigned"],
                ["Designation", employee.position?.title || "Not assigned"],
                ["Employment Type", pretty(employee.employmentType || "full_time")],
                ["Employee Status", pretty(employee.employeeStatus || "active")],
                ["Joining Date", formatDetailDate(employee.joiningDate)],
                ["Leaving Date", formatDetailDate(employee.leavingDate)],
                ["Manager", employee.managerId?.name || "Not assigned"],
                ["Work Status", pretty(employee.workStatus || "available")],
              ],
            },
            {
              title: "Access & Assignment",
              items: [
                ["System Role", pretty(employee.role || "employee")],
                ["Access Role", employee.accessRole?.name || "No custom role"],
                ["Permission Group", employee.permissionGroup?.name || "No access group"],
                ["Daily Lead Limit", employee.dailyLeadLimit || 0],
                ["Available for Assignment", employee.isAvailableForAssignment !== false ? "Yes" : "No"],
                ["Account Access", employee.isActive !== false ? "Enabled" : "Disabled"],
              ],
            },
            {
              title: "Leave Entitlement",
              items: [
                ["Template", employee.leaveTemplate?.name || "No template"],
                ["Year", employee.leaveEntitlement?.year || new Date().getFullYear()],
                ["Paid Leave Days", employee.leaveEntitlement?.paidDays || 0],
                ["Unpaid Leave Days", employee.leaveEntitlement?.unpaidDays || 0],
                [
                  "Unpaid Charge",
                  employee.leavePolicy?.unpaidCharge?.enabled === false
                    ? "Disabled"
                    : `${pretty(employee.leavePolicy?.unpaidCharge?.calculationType || "per_day")} • ${employee.leavePolicy?.unpaidCharge?.value || 0}`,
                ],
              ],
            },
            {
              title: "Salary Profile",
              items: [
                ["Profile Status", salaryProfile ? (salaryProfile.isActive !== false ? "Active" : "Inactive") : "No salary profile"],
                ["Salary Type", pretty(salaryProfile?.salaryType || employee.salaryType || "fixed")],
                ["Basic Salary", salaryProfile ? `${salaryProfile.currency || "BDT"} ${Number(salaryProfile.basicSalary || 0).toLocaleString()}` : "—"],
                ["Working Days / Month", salaryProfile?.workingDaysPerMonth || "—"],
                ["Working Hours / Day", salaryProfile?.workingHoursPerDay || "—"],
                ["Effective From", formatDetailDate(salaryProfile?.effectiveFrom)],
              ],
            },
          ].map((section) => (
            <section key={section.title}>
              <h3 className="mb-3 text-sm font-bold text-gray-900">{section.title}</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {section.items.map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4">
                    <p className="text-xs font-semibold uppercase text-gray-400">{label}</p>
                    <p className="mt-1.5 break-words text-sm font-semibold text-gray-900">{value}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section>
            <h3 className="mb-3 text-sm font-bold text-gray-900">Address</h3>
            <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4 text-sm font-semibold text-gray-900">
              {employee.address?.fullAddress || [employee.address?.line1, employee.address?.line2, employee.address?.city, employee.address?.state, employee.address?.postalCode, employee.address?.country].filter(Boolean).join(", ") || "No address added"}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-bold text-gray-900">Emergency Contact</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {[
                ["Name", employee.emergencyContact?.name || "—"],
                ["Relation", employee.emergencyContact?.relation || "—"],
                ["Phone", employee.emergencyContact?.phone || "—"],
                ["Address", employee.emergencyContact?.address || "—"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4">
                  <p className="text-xs font-semibold uppercase text-gray-400">{label}</p>
                  <p className="mt-1.5 break-words text-sm font-semibold text-gray-900">{value}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-bold text-gray-900">Record Information</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4"><p className="text-xs font-semibold uppercase text-gray-400">Created</p><p className="mt-1.5 text-sm font-semibold text-gray-900">{formatDetailDate(employee.createdAt)}</p></div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4"><p className="text-xs font-semibold uppercase text-gray-400">Last Updated</p><p className="mt-1.5 text-sm font-semibold text-gray-900">{formatDetailDate(employee.updatedAt)}</p></div>
            </div>
          </section>
        </div>
      )}
    </Modal>
  )
}

function EmployeeActionMenu({ employee, openMenuId, setOpenMenuId, onView, onEdit, onDelete, canManage = true }) {
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef(null)
  const reduceMotion = useReducedMotion()
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
      const height = canManage ? 154 : 58
      const gap = 8
      const left = Math.min(window.innerWidth - width - 12, Math.max(12, rect.right - width))
      const openAbove = rect.bottom + height + gap > window.innerHeight
      const top = openAbove
        ? Math.max(12, rect.top - height - gap)
        : Math.min(window.innerHeight - height - 12, rect.bottom + gap)

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
  }, [canManage, close, open])

  const itemClass =
    "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold text-gray-700 transition hover:bg-gray-50"

  const menu =
    typeof document !== "undefined"
      ? createPortal(
          <AnimatePresence>
            {open ? (
              <motion.div
                style={{ position: "fixed", top: position.top, left: position.left, width: 190 }}
                className="z-[9999] rounded-2xl border border-gray-100 bg-white p-2 shadow-[0_16px_38px_-24px_rgba(15,23,42,0.45)] ring-1 ring-black/5"
                onClick={(event) => event.stopPropagation()}
                initial={reduceMotion ? false : { opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.985 }}
                transition={{ duration: reduceMotion ? 0 : 0.16, ease: [0.22, 1, 0.36, 1] }}
              >
                <button type="button" className={itemClass} onClick={() => runAction(onView)}>
                  <HugeiconsIcon icon={ViewIcon} size={16} className="text-indigo-600" />
                  View details
                </button>
                {canManage ? (
                  <>
                    <button type="button" className={itemClass} onClick={() => runAction(onEdit)}>
                      <HugeiconsIcon icon={PencilEdit02Icon} size={16} className="text-gray-600" />
                      Edit employee
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold text-rose-700 transition hover:bg-rose-50"
                      onClick={() => runAction(onDelete)}
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={16} />
                      Delete employee
                    </button>
                  </>
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>,
          document.body
        )
      : null

  return (
    <div className="flex items-center justify-end gap-2 whitespace-nowrap" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className={`${btn} ${btnPrimary} h-9 px-3 py-1.5 shadow-sm shadow-indigo-600/15`}
        onClick={() => onView?.(employee)}
      >
        <HugeiconsIcon icon={ViewIcon} size={16} />
        View
      </button>

      <button
        ref={buttonRef}
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
        onClick={(event) => {
          event.stopPropagation()
          setOpenMenuId(open ? null : employee._id)
        }}
        title="More actions"
        aria-label="More actions"
        aria-expanded={open}
      >
        <HugeiconsIcon icon={MoreVerticalIcon} size={16} />
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
  accessRole: "",
  leaveTemplate: "",
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
  leaveYear: new Date().getFullYear(),
  paidLeaveDays: 0,
  unpaidLeaveDays: 0,
  rosterShift: "",
  rosterType: "weekly",
  rosterStartDate: new Date().toISOString().slice(0, 10),
  rosterEndDate: "",
  rosterWeekdays: [0, 1, 2, 3, 4],
}

function getId(value) {
  return value?._id || value || ""
}

function leaveTemplateScope(template = {}) {
  return {
    departments: (template.departments || []).map((item) => String(getId(item))).filter(Boolean),
    positions: (template.positions || []).map((item) => String(getId(item))).filter(Boolean),
  }
}

function templateMatchesEmployee(template, { department, position }) {
  if (!template || template.isActive === false) return false
  const scope = leaveTemplateScope(template)

  if (scope.positions.length) return Boolean(position && scope.positions.includes(String(position)))
  if (scope.departments.length && department) return scope.departments.includes(String(department))
  if (scope.positions.length || scope.departments.length) return false
  return true
}

function templateMatchScore(template, { department, position }) {
  const scope = leaveTemplateScope(template)
  if (position && scope.positions.includes(String(position))) return 3
  if (department && scope.departments.includes(String(department))) return 2
  if (!scope.positions.length && !scope.departments.length) return 1
  return 0
}

function findBestLeaveTemplate(templates, { department, position }) {
  return (templates || [])
    .filter((template) => templateMatchesEmployee(template, { department, position }))
    .sort(
      (a, b) =>
        templateMatchScore(b, { department, position }) - templateMatchScore(a, { department, position }) ||
        Number(b.year || 0) - Number(a.year || 0)
    )[0] || null
}

function applyLeaveTemplateToForm(draft, template) {
  if (!template) {
    return {
      ...draft,
      leaveTemplate: "",
      leaveYear: new Date().getFullYear(),
      paidLeaveDays: 0,
      unpaidLeaveDays: 0,
    }
  }

  return {
    ...draft,
    leaveTemplate: template._id || "",
    leaveYear: template.year || draft.leaveYear || new Date().getFullYear(),
    paidLeaveDays: Number(template.paidDays || 0),
    unpaidLeaveDays: Number(template.unpaidDays || 0),
  }
}

function pretty(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatDetailDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
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
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null")
    } catch {
      return null
    }
  }, [])
  const canManageEmployees =
    hasPermission(currentUser, PERMISSIONS.EMPLOYEES_MANAGE) ||
    hasPermission(currentUser, PERMISSIONS.USERS_MANAGE)
  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [positions, setPositions] = useState([])
  const [permissionGroups, setPermissionGroups] = useState([])
  const [roles, setRoles] = useState([])
  const [leaveTemplates, setLeaveTemplates] = useState([])
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
  const [detailsState, setDetailsState] = useState({ open: false, employee: null, salaryProfile: null, loading: false })
  const [openMenuId, setOpenMenuId] = useState(null)
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([])
  const abortRef = useRef(null)
  const avatarInputRef = useRef(null)
  const tableScrollRef = useRef(null)

  const selectedEmployeeIdSet = useMemo(
    () => new Set(selectedEmployeeIds.map(String)),
    [selectedEmployeeIds]
  )

  const visibleEmployeeIds = useMemo(
    () => employees.map((employee) => String(employee._id)).filter(Boolean),
    [employees]
  )

  const selectedVisibleCount = useMemo(
    () => visibleEmployeeIds.filter((id) => selectedEmployeeIdSet.has(id)).length,
    [visibleEmployeeIds, selectedEmployeeIdSet]
  )

  const allVisibleEmployeesSelected = visibleEmployeeIds.length > 0 && selectedVisibleCount === visibleEmployeeIds.length
  const someVisibleEmployeesSelected = selectedVisibleCount > 0 && !allVisibleEmployeesSelected
  const toggleEmployeeSelection = useCallback((employeeId) => {
    const id = String(employeeId || "")
    if (!id) return
    setSelectedEmployeeIds((previous) =>
      previous.some((item) => String(item) === id)
        ? previous.filter((item) => String(item) !== id)
        : [...previous, id]
    )
  }, [])

  const toggleAllVisibleEmployees = useCallback(() => {
    setSelectedEmployeeIds((previous) => {
      const next = new Set(previous.map(String))
      const shouldSelectAll = !visibleEmployeeIds.every((id) => next.has(id))

      visibleEmployeeIds.forEach((id) => {
        if (shouldSelectAll) next.add(id)
        else next.delete(id)
      })

      return Array.from(next)
    })
  }, [visibleEmployeeIds])

  // Keep the table at a fixed visual height, but only consume vertical wheel
  // movement while the table can actually scroll in that direction. When the
  // table has no vertical overflow, or the user reaches the top/bottom edge,
  // forward the wheel delta to the page so the global page scroll never feels
  // trapped. Horizontal trackpad / Shift+wheel gestures stay inside the table.
  const handleTableWheel = useCallback((event) => {
    const scroller = tableScrollRef.current
    if (!scroller) return

    const { deltaX, deltaY, shiftKey } = event
    const isHorizontalGesture = shiftKey || Math.abs(deltaX) > Math.abs(deltaY)
    if (isHorizontalGesture || deltaY === 0) return

    const maxScrollTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
    const hasVerticalOverflow = maxScrollTop > 1
    const atTop = scroller.scrollTop <= 1
    const atBottom = scroller.scrollTop >= maxScrollTop - 1
    const movingUp = deltaY < 0
    const movingDown = deltaY > 0

    const shouldUsePageScroll =
      !hasVerticalOverflow ||
      (movingUp && atTop) ||
      (movingDown && atBottom)

    if (!shouldUsePageScroll) return

    event.preventDefault()
    window.scrollBy({ top: deltaY, left: 0, behavior: "auto" })
  }, [])

  useEffect(() => {
    const scroller = tableScrollRef.current
    if (!scroller) return undefined

    // Native non-passive listener lets us hand vertical wheel movement back to
    // the page at the table boundaries without breaking horizontal scrolling.
    scroller.addEventListener("wheel", handleTableWheel, { passive: false })
    return () => scroller.removeEventListener("wheel", handleTableWheel)
  }, [handleTableWheel])

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

  const selectedLeaveTemplate = useMemo(
    () => leaveTemplates.find((template) => String(template._id) === String(form.leaveTemplate)) || null,
    [form.leaveTemplate, leaveTemplates]
  )

  const availableLeaveTemplates = useMemo(() => {
    return leaveTemplates.filter((template) =>
      templateMatchesEmployee(template, {
        department: form.department,
        position: form.position,
      })
    )
  }, [form.department, form.position, leaveTemplates])

  const filterPositionOptions = useMemo(() => {
    if (!filters.department) return positions
    return positions.filter((position) => String(getId(position.department)) === String(filters.department))
  }, [filters.department, positions])

  const departmentTabs = useMemo(
    () => [
      { key: "", label: "All Departments" },
      ...departments
        .filter((department) => department.isActive !== false)
        .map((department) => ({ key: String(department._id), label: department.name })),
    ],
    [departments]
  )

  const loadAccessLists = async () => {
    try {
      const [departmentsRes, positionsRes, groupsRes, rolesRes, shiftsRes, leaveTemplateRes] = await Promise.all([
        api("/access-control/departments"),
        api("/access-control/positions"),
        api("/access-control/permission-groups"),
        api("/access-control/roles"),
        api("/roster/shifts"),
        api("/leave-templates"),
      ])
      setDepartments(departmentsRes.departments || [])
      setPositions(positionsRes.positions || [])
      setPermissionGroups(groupsRes.permissionGroups || [])
      setRoles((rolesRes.roles || []).filter((role) => !role.isSystem && role.isActive !== false))
      setShifts(shiftsRes.shifts || [])
      setLeaveTemplates(leaveTemplateRes.templates || [])
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
      setSelectedEmployeeIds([])
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

      if (key === "department" || key === "position") {
        return applyLeaveTemplateToForm(
          next,
          findBestLeaveTemplate(leaveTemplates, {
            department: next.department,
            position: next.position,
          })
        )
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
    if (!canManageEmployees) return toast.error("You do not have permission to create employees")
    setEditing(null)
    setForm(emptyForm)
    resetAvatarDraft()
    setModalOpen(true)
  }

  const openDetails = async (employee) => {
    const employeeId = employee?._id
    if (!employeeId) return
    setDetailsState({ open: true, employee, salaryProfile: null, loading: true })
    try {
      const data = await api(`/users/employees/${employeeId}`)
      setDetailsState({
        open: true,
        employee: data.employee || employee,
        salaryProfile: data.salaryProfile || null,
        loading: false,
      })
    } catch (error) {
      toast.error(error.message || "Failed to load employee details")
      setDetailsState((previous) => ({ ...previous, loading: false }))
    }
  }

  const openEdit = (employee) => {
    if (!canManageEmployees) return toast.error("You do not have permission to update employees")
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
      accessRole: getId(employee.accessRole),
      leaveTemplate: getId(employee.leaveTemplate),
      employmentType: employee.employmentType || "full_time",
      salaryType: employee.salaryType || "fixed",
      employeeStatus: employee.employeeStatus || "active",
      isActive: employee.isActive !== false,
      isAvailableForAssignment: employee.isAvailableForAssignment !== false,
      workStatus: employee.workStatus || "available",
      dailyLeadLimit: Number(employee.dailyLeadLimit || 0),
      leaveYear: Number(employee.leaveEntitlement?.year || new Date().getFullYear()),
      paidLeaveDays: Number(employee.leaveEntitlement?.paidDays || 0),
      unpaidLeaveDays: Number(employee.leaveEntitlement?.unpaidDays || 0),
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
      accessRole: form.accessRole || null,
      leaveTemplate: form.leaveTemplate || null,
      employmentType: form.employmentType,
      salaryType: form.salaryType,
      employeeStatus: form.employeeStatus,
      isActive: Boolean(form.isActive),
      isAvailableForAssignment: Boolean(form.isAvailableForAssignment),
      workStatus: form.workStatus,
      dailyLeadLimit: Number(form.dailyLeadLimit || 0),
      leaveEntitlement: {
        year: Number(form.leaveYear || new Date().getFullYear()),
        paidDays: Number(form.paidLeaveDays || 0),
        unpaidDays: Number(form.unpaidLeaveDays || 0),
      },
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
    if (!canManageEmployees) return toast.error("You do not have permission to delete employees")
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

  const selectDepartmentTab = (departmentId) => {
    setFilters((prev) => ({
      ...prev,
      department: departmentId,
      position: "",
    }))
    setFilterDraft((prev) => ({
      ...prev,
      department: departmentId,
      position: "",
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
                <HugeiconsIcon icon={UserGroup03Icon} size={20} />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Add Employee</h1>
                <p className="mt-1 text-sm font-medium text-gray-500">
                  Create and manage employees with department, designation, and access group.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button className={`${btn} ${btnGhost}`} onClick={() => loadEmployees({ reset: true })}>
                <HugeiconsIcon icon={RefreshIcon} size={16} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
              {canManageEmployees ? (
                <button className={`${btn} ${btnPrimary}`} onClick={openCreate}>
                  <HugeiconsIcon icon={Add01Icon} size={16} />
                  Add Employee
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className={activeFilterCount ? "w-full xl:max-w-[72%]" : "w-full sm:max-w-[460px] md:max-w-[520px] lg:max-w-[580px] xl:max-w-[620px]"}>
              <div className="flex min-h-[44px] w-full flex-wrap items-center gap-1.5 rounded-2xl border border-gray-200 bg-gray-50/80 px-2.5 py-1 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.10)]">
                <HugeiconsIcon icon={Search01Icon} size={16} className="shrink-0 text-gray-400" />

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
                    <HugeiconsIcon icon={Cancel01Icon} size={14} className="shrink-0" />
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
                  <HugeiconsIcon icon={FilterIcon} size={16} />
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
                    <HugeiconsIcon icon={Cancel01Icon} size={16} />
                  </button>
                ) : null}
              </div>
            </div>

            <p className="text-sm font-bold text-gray-500">
              Showing <span className="text-gray-900">{employees.length}</span> employee{employees.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <div className="mb-5 overflow-hidden rounded-3xl border border-gray-200 bg-white p-2 shadow-[0_14px_35px_-30px_rgba(15,23,42,0.45)]">
          <div className="flex min-w-max gap-1 overflow-x-auto no-scrollbar" role="tablist" aria-label="Filter employees by department">
            {departmentTabs.map((department) => {
              const active = String(filters.department || "") === String(department.key)
              return (
                <button
                  key={department.key || "all"}
                  type="button"
                  onClick={() => selectDepartmentTab(department.key)}
                  className={`inline-flex items-center rounded-2xl px-4 py-3 text-sm font-extrabold transition ${
                    active
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-950"
                  }`}
                >
                  {department.label}
                </button>
              )
            })}
          </div>
        </div>

        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_18px_45px_-34px_rgba(15,23,42,0.45)]">
          <div
            ref={tableScrollRef}
            className="custom-scrollbar h-[560px] overflow-x-auto overflow-y-auto overscroll-x-contain overscroll-y-auto"
          >
            <table className="w-full min-w-[1264px] border-separate border-spacing-0 text-left">
              <thead>
                <tr>
                  <th className="sticky top-0 z-20 w-[340px] min-w-[340px] border-b border-gray-200 bg-gray-50 px-5 py-3 text-xs font-extrabold uppercase tracking-[0.06em] text-gray-600">
                    <div className="flex items-center gap-4">
                      <SelectionCheckbox
                        checked={allVisibleEmployeesSelected}
                        indeterminate={someVisibleEmployeesSelected}
                        onChange={toggleAllVisibleEmployees}
                        disabled={!employees.length || loading}
                        label={allVisibleEmployeesSelected ? "Clear employee selection" : "Select loaded employees"}
                      />
                      <span>Employee</span>
                    </div>
                  </th>
                  <th className="sticky top-0 z-20 w-[170px] min-w-[170px] border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-extrabold uppercase tracking-[0.06em] text-gray-600">Department</th>
                  <th className="sticky top-0 z-20 w-[240px] min-w-[240px] border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-extrabold uppercase tracking-[0.06em] text-gray-600">Designation</th>
                  <th className="sticky top-0 z-20 w-[190px] min-w-[190px] border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-extrabold uppercase tracking-[0.06em] text-gray-600">Access Group</th>
                  <th className="sticky top-0 z-20 w-[150px] min-w-[150px] border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-extrabold uppercase tracking-[0.06em] text-gray-600">Employment</th>
                  <th className="sticky top-0 z-20 w-[130px] min-w-[130px] border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-extrabold uppercase tracking-[0.06em] text-gray-600">Status</th>
                  <th className="sticky right-0 top-0 z-50 w-[166px] min-w-[166px] border-b border-gray-200 bg-gray-50 px-4 py-3 text-right text-xs font-extrabold uppercase tracking-[0.06em] text-gray-600 shadow-[-8px_0_14px_-14px_rgba(15,23,42,0.20)]">Actions</th>
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
                  employees.map((employee) => {
                    const employeeId = String(employee._id)
                    const isSelected = selectedEmployeeIdSet.has(employeeId)

                    return (
                      <tr key={employee._id} className={cn("group align-middle transition-colors", isSelected && "bg-indigo-50/45")}>
                        <td className={cn("border-b border-gray-100 px-5 py-3 transition-colors group-hover:bg-indigo-50/40", isSelected && "bg-indigo-50/45")}>
                          <div className="flex items-center gap-2.5">
                            <SelectionCheckbox
                              checked={isSelected}
                              onChange={() => toggleEmployeeSelection(employeeId)}
                              label={`${isSelected ? "Deselect" : "Select"} ${employee.name || "employee"}`}
                            />
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100 ring-1 ring-gray-200">
                              {employee.avatarUrl ? (
                                <img src={employee.avatarUrl} alt={employee.name || "Employee"} className="h-full w-full object-cover" />
                              ) : (
                                <HugeiconsIcon icon={UserIcon} size={20} className="text-gray-500" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="max-w-[220px] truncate whitespace-nowrap text-sm font-extrabold text-gray-900">{employee.name || "Unnamed"}</p>
                              <p className="mt-0.5 max-w-[220px] truncate whitespace-nowrap text-xs font-medium text-gray-500">{employee.email || "No email"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-700 group-hover:bg-indigo-50/40">
                          {employee.department?.name || "Not assigned"}
                        </td>
                        <td className="whitespace-nowrap border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-700 group-hover:bg-indigo-50/40">
                          {employee.position?.title || "Not assigned"}
                        </td>
                        <td className="whitespace-nowrap border-b border-gray-100 px-4 py-3 group-hover:bg-indigo-50/40">
                          <span className="inline-flex max-w-[170px] truncate whitespace-nowrap rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-600/10">
                            {employee.permissionGroup?.name || "No access group"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap border-b border-gray-100 px-4 py-3 group-hover:bg-indigo-50/40">
                          <span className="whitespace-nowrap text-sm font-bold text-gray-700">
                            {pretty(employee.employmentType || "full_time")}
                          </span>
                        </td>
                        <td className="whitespace-nowrap border-b border-gray-100 px-4 py-3 group-hover:bg-indigo-50/40">
                          <EmployeeStateBadge
                            status={employee.employeeStatus || "active"}
                            enabled={employee.isActive !== false}
                          />
                        </td>
                        <td className={cn(
                          "sticky right-0 z-30 w-[166px] min-w-[166px] whitespace-nowrap border-b border-gray-100 px-4 py-3 text-right shadow-[-8px_0_14px_-14px_rgba(15,23,42,0.18)] transition-colors",
                          isSelected ? "bg-indigo-50" : "bg-white group-hover:bg-indigo-50"
                        )}>
                          <EmployeeActionMenu
                            employee={employee}
                            openMenuId={openMenuId}
                            setOpenMenuId={setOpenMenuId}
                            onView={openDetails}
                            onEdit={openEdit}
                            onDelete={(item) => setDeleteState({ open: true, employee: item, password: "", loading: false })}
                            canManage={canManageEmployees}
                          />
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10">
                          <HugeiconsIcon icon={UserGroup03Icon} size={20} />
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

          {(hasMore || loadingMore) ? (
            <div className="flex items-center justify-center bg-white px-5 py-4">
              <button
                type="button"
                className={`${btn} ${btnPrimary} min-w-[132px]`}
                disabled={loadingMore || loading}
                onClick={() => loadEmployees({ reset: false })}
              >
                {loadingMore ? "Loading..." : "See More"}
              </button>
            </div>
          ) : null}
        </section>
      </div>

      <EmployeeDetailsModal
        open={detailsState.open}
        employee={detailsState.employee}
        salaryProfile={detailsState.salaryProfile}
        loading={detailsState.loading}
        onClose={() => setDetailsState({ open: false, employee: null, salaryProfile: null, loading: false })}
        onEdit={openEdit}
        onDelete={(employee) => setDeleteState({ open: true, employee, password: "", loading: false })}
        canManage={canManageEmployees}
      />

      <Modal
        open={modalOpen}
        title={editing ? "Edit Employee" : "Add Employee"}
        subtitle={editing ? "Update employee information" : "Create a new employee"}
        icon={<HugeiconsIcon icon={UserGroup03Icon} size={20} />}
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
                    <HugeiconsIcon icon={UserIcon} size={32} className="text-gray-400" />
                  )}
                  <div className="absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm ring-2 ring-white">
                    <HugeiconsIcon icon={Camera01Icon} size={14} />
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-gray-900">Profile Image</p>
                  <p className="mt-1 text-xs font-medium text-gray-500">JPG, PNG or WEBP • max 5MB</p>
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
                  <HugeiconsIcon icon={CloudUploadIcon} size={16} />
                  {avatarPreview ? "Change Image" : "Upload Image"}
                </label>
                {avatarPreview || avatarFile || avatarRemove ? (
                  <button
                    type="button"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-100 bg-white px-3 text-sm font-bold text-rose-600 transition hover:bg-rose-50"
                    onClick={removeAvatarDraft}
                  >
                    <HugeiconsIcon icon={Delete02Icon} size={16} />
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Full Name" required>
              <input className={input} value={form.name} onChange={(event) => updateForm("name", event.target.value)} required />
            </Field>
            <Field label="Email" required>
              <input className={input} type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} required />
            </Field>
            <Field label={editing ? "New Password" : "Password"} required={!editing} hint={editing ? "Leave empty to keep the current password." : undefined}>
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
            <Field label="Basic Salary">
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
            <Field label="Access Role">
              <select
                className={input}
                value={form.accessRole}
                onChange={(event) => {
                  const accessRole = event.target.value
                  const selectedRole = roles.find((role) => String(role._id) === String(accessRole))
                  setForm((previous) => ({
                    ...previous,
                    accessRole,
                    permissionGroup: accessRole ? getId(selectedRole?.permissionGroup) : previous.permissionGroup,
                  }))
                }}
              >
                <option value="">No custom role</option>
                {roles.map((role) => (
                  <option key={role._id} value={role._id}>{role.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Permission Group">
              <select disabled={Boolean(form.accessRole)} className={input} value={form.permissionGroup} onChange={(event) => updateForm("permissionGroup", event.target.value)}>
                <option value="">Select access group</option>
                {permissionGroups.map((group) => (
                  <option key={group._id} value={group._id}>{group.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Leave Template">
              <select
                className={input}
                value={form.leaveTemplate}
                onChange={(event) => {
                  const leaveTemplate = event.target.value
                  const template = leaveTemplates.find((item) => String(item._id) === String(leaveTemplate))
                  setForm((previous) => ({
                    ...previous,
                    leaveTemplate,
                    ...(template
                      ? {
                          leaveYear: template.year || previous.leaveYear,
                          paidLeaveDays: template.paidDays || 0,
                          unpaidLeaveDays: template.unpaidDays || 0,
                        }
                      : {}),
                  }))
                }}
              >
                <option value="">No matching template</option>
                {availableLeaveTemplates.map((template) => (
                  <option key={template._id} value={template._id}>
                    {template.name} ({template.year}) - Paid {template.paidDays || 0}, Unpaid {template.unpaidDays || 0}
                  </option>
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

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-emerald-600 ring-1 ring-emerald-100">
                <HugeiconsIcon icon={Calendar03Icon} size={20} />
              </div>
              <div>
                <p className="text-sm font-extrabold text-gray-900">Yearly Leave Entitlement</p>
              </div>
            </div>
            {selectedLeaveTemplate ? (
              <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-white p-3 text-sm font-bold text-gray-700 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Assigned template: {selectedLeaveTemplate.name} • Paid {selectedLeaveTemplate.paidDays || 0} • Unpaid {selectedLeaveTemplate.unpaidDays || 0}
                </span>
                <button
                  type="button"
                  className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-emerald-700"
                  onClick={() =>
                    setForm((previous) => ({
                      ...previous,
                      leaveYear: selectedLeaveTemplate.year || previous.leaveYear,
                      paidLeaveDays: selectedLeaveTemplate.paidDays || 0,
                      unpaidLeaveDays: selectedLeaveTemplate.unpaidDays || 0,
                    }))
                  }
                >
                  Use template values
                </button>
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Leave Year">
                <input className={input} type="number" min="2000" value={form.leaveYear} onChange={(event) => updateForm("leaveYear", event.target.value)} />
              </Field>
              <Field label="Paid Leave Days">
                <input className={input} type="number" min="0" value={form.paidLeaveDays} onChange={(event) => updateForm("paidLeaveDays", event.target.value)} />
              </Field>
              <Field label="Unpaid Leave Days">
                <input className={input} type="number" min="0" value={form.unpaidLeaveDays} onChange={(event) => updateForm("unpaidLeaveDays", event.target.value)} />
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-indigo-600 ring-1 ring-indigo-100">
                <HugeiconsIcon icon={Clock01Icon} size={20} />
              </div>
              <div>
                <p className="text-sm font-extrabold text-gray-900">Assign Roster / Shift</p>
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
        subtitle={null}
        icon={<HugeiconsIcon icon={FilterIcon} size={20} />}
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
        icon={<HugeiconsIcon icon={LockIcon} size={20} />}
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
          <Field label="Your Password" required>
            <input
              className={input}
              type="password"
              value={deleteState.password}
              onChange={(event) => setDeleteState((prev) => ({ ...prev, password: event.target.value }))}
              placeholder="Enter admin password"
              required
              autoFocus
            />
          </Field>
        </form>
      </Modal>
    </div>
  )
}
