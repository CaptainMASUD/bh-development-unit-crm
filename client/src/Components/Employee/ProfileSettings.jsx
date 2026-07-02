"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  FiAlertCircle,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiEye,
  FiEyeOff,
  FiHome,
  FiLock,
  FiMail,
  FiPhone,
  FiRefreshCcw,
  FiShield,
  FiTrash2,
  FiUploadCloud,
  FiUser,
  FiUsers,
  FiX,
} from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const cn = (...classes) => classes.filter(Boolean).join(" ")

const card =
  "rounded-3xl border border-gray-100 bg-white shadow-[0_18px_60px_-45px_rgba(0,0,0,0.55)]"
const input =
  "w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none transition focus:border-transparent focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
const button =
  "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
const primaryButton = "bg-indigo-600 text-white hover:bg-indigo-700"
const ghostButton = "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
const dangerButton = "border border-gray-200 bg-white text-rose-600 hover:bg-rose-50"

function getAuthHeaders() {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function getMultipartHeaders() {
  const token = localStorage.getItem("token")
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function titleCase(value) {
  const text = String(value || "")
    .replace(/[_-]+/g, " ")
    .trim()

  if (!text) return "-"
  return text.replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatDate(value) {
  if (!value) return "-"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function getInitials(value) {
  const text = String(value || "").trim()
  if (!text) return "U"

  const parts = text.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()

  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase()
}

function readAddress(address) {
  if (!address) return "-"
  if (typeof address === "string") return address || "-"

  return (
    address.fullAddress ||
    [address.line1, address.line2, address.city, address.state, address.postalCode, address.country]
      .filter(Boolean)
      .join(", ") ||
    "-"
  )
}

function unpaidChargeText(policy) {
  const charge = policy?.unpaidCharge
  if (!charge || charge.enabled === false) return "No charge configured"
  return `${titleCase(charge.calculationType || "per_day")}: ${Number(charge.value || 0)} (${titleCase(charge.basedOn || "basicSalary")})`
}

function hasAnyValue(items) {
  return items.some((item) => item.value && item.value !== "-")
}

function Toast({ type = "success", message, onClose }) {
  if (!message) return null

  const isError = type === "error"
  const Icon = isError ? FiAlertCircle : FiCheckCircle

  return (
    <div className="fixed right-5 top-5 z-[80] w-[calc(100vw-2.5rem)] max-w-sm">
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        transition={{ duration: 0.18 }}
        className={cn(
          "rounded-2xl border p-3 shadow-xl backdrop-blur",
          isError
            ? "border-rose-200 bg-rose-50 text-rose-700"
            : "border-emerald-200 bg-emerald-50 text-emerald-700"
        )}
      >
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="flex-1 text-sm font-bold">{message}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 transition hover:bg-black/5 active:scale-95"
            aria-label="Close toast"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function Badge({ children, tone = "gray" }) {
  const tones = {
    gray: "border-gray-200 bg-gray-100 text-gray-700",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold tracking-wide",
        tones[tone] || tones.gray
      )}
    >
      {children}
    </span>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
      <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
      <div className="mt-3 h-4 w-36 animate-pulse rounded bg-gray-200" />
    </div>
  )
}

function InfoItem({ icon, label, value }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 transition hover:bg-gray-50">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-1 break-words text-sm font-extrabold text-gray-950">{value || "-"}</p>
        </div>
      </div>
    </div>
  )
}

function Section({ title, icon, children }) {
  return (
    <section className={cn(card, "overflow-hidden")}>
      <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50/70 px-5 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
          {icon}
        </div>
        <h2 className="text-base font-extrabold text-gray-950">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function InfoGrid({ loading, items }) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <InfoItem key={item.label} icon={item.icon} label={item.label} value={item.value} />
      ))}
    </div>
  )
}

function PermissionPill({ value }) {
  return (
    <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-extrabold text-indigo-700">
      {String(value || "").replace(/:/g, " - ")}
    </span>
  )
}

function PasswordField({ label, value, onChange, visible, onToggle, placeholder, disabled }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-extrabold text-gray-800">{label}</label>
      <div className="relative">
        <FiLock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-600" />
        <input
          value={value}
          onChange={onChange}
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(input, "pl-11 pr-12")}
        />
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-2 text-gray-600 transition hover:bg-gray-100 active:scale-95 disabled:opacity-60"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

function PasswordModal({
  open,
  onClose,
  pwd,
  setPwd,
  showPwd,
  setShowPwd,
  error,
  saving,
  onSubmit,
}) {
  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[75] flex items-center justify-center bg-gray-950/55 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-xl overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/80 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
                  <FiLock className="h-5 w-5" />
                </div>
                <h3 className="text-base font-extrabold text-gray-950">Change Password</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-2xl border border-gray-200 bg-white p-2 text-gray-700 transition hover:bg-gray-50 active:scale-95 disabled:opacity-60"
                aria-label="Close password modal"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                  {error}
                </div>
              ) : null}

              <PasswordField
                label="Current Password"
                value={pwd.currentPassword}
                onChange={(event) => setPwd((prev) => ({ ...prev, currentPassword: event.target.value }))}
                visible={showPwd.current}
                onToggle={() => setShowPwd((prev) => ({ ...prev, current: !prev.current }))}
                placeholder="Current password"
                disabled={saving}
              />

              <PasswordField
                label="New Password"
                value={pwd.newPassword}
                onChange={(event) => setPwd((prev) => ({ ...prev, newPassword: event.target.value }))}
                visible={showPwd.next}
                onToggle={() => setShowPwd((prev) => ({ ...prev, next: !prev.next }))}
                placeholder="New password"
                disabled={saving}
              />

              <PasswordField
                label="Confirm Password"
                value={pwd.confirmPassword}
                onChange={(event) => setPwd((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                visible={showPwd.confirm}
                onToggle={() => setShowPwd((prev) => ({ ...prev, confirm: !prev.confirm }))}
                placeholder="Confirm password"
                disabled={saving}
              />
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50/80 p-5 sm:flex-row sm:justify-end">
              <button type="button" onClick={onClose} disabled={saving} className={cn(button, ghostButton)}>
                Cancel
              </button>
              <button type="button" onClick={onSubmit} disabled={saving} className={cn(button, primaryButton)}>
                <FiLock className="h-4 w-4" />
                {saving ? "Saving..." : "Save Password"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export default function ProfileSettingsEmployee() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState("")

  const [toast, setToast] = useState({ type: "success", message: "" })
  const toastTimer = useRef(null)

  const [avatarPreview, setAvatarPreview] = useState("")
  const [avatarBroken, setAvatarBroken] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [removingAvatar, setRemovingAvatar] = useState(false)
  const fileInputRef = useRef(null)

  const [passwordOpen, setPasswordOpen] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState("")
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [showPwd, setShowPwd] = useState({ current: false, next: false, confirm: false })

  const abortRef = useRef(null)

  const showToast = useCallback((type, message) => {
    setToast({ type, message })

    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => {
      setToast({ type: "success", message: "" })
    }, 2400)
  }, [])

  const syncUser = useCallback((nextUser) => {
    setUser(nextUser)
    setAvatarBroken(false)

    if (nextUser) {
      localStorage.setItem("user", JSON.stringify(nextUser))
    }
  }, [])

  const hydrateFromStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem("user")
      if (stored) syncUser(JSON.parse(stored))
    } catch {}
  }, [syncUser])

  const loadMe = useCallback(
    async ({ signal, silent = false } = {}) => {
      if (!silent) setLoading(true)
      if (silent) setRefreshing(true)
      setLoadError("")

      try {
        const res = await fetch(`${API_BASE}/users/me`, {
          method: "GET",
          headers: getAuthHeaders(),
          credentials: "include",
          signal,
        })

        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.message || "Failed to load profile")

        syncUser(data?.user || null)
      } catch (error) {
        if (error?.name !== "AbortError") {
          hydrateFromStorage()
          setLoadError(error?.message || "Could not load profile.")
          showToast("error", error?.message || "Could not load profile.")
        }
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [hydrateFromStorage, showToast, syncUser]
  )

  useEffect(() => {
    hydrateFromStorage()

    const controller = new AbortController()
    abortRef.current = controller
    loadMe({ signal: controller.signal })

    return () => {
      controller.abort()
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }
  }, [hydrateFromStorage, loadMe])

  const displayAvatar = avatarPreview || user?.avatarUrl || ""
  const showAvatar = Boolean(displayAvatar && !avatarBroken)
  const userInitials = useMemo(() => getInitials(user?.name || user?.email), [user])
  const permissions = useMemo(
    () => (Array.isArray(user?.permissionGroup?.permissions) ? user.permissionGroup.permissions : []),
    [user]
  )

  const accessStatus = user?.permissionGroup?.isActive === false ? "Disabled" : "Enabled"
  const isActive = user?.isActive !== false

  const basicItems = useMemo(
    () => [
      { label: "Full Name", value: user?.name, icon: <FiUser className="h-5 w-5" /> },
      { label: "Email", value: user?.email, icon: <FiMail className="h-5 w-5" /> },
      { label: "Phone", value: user?.phone, icon: <FiPhone className="h-5 w-5" /> },
      { label: "Alternate Phone", value: user?.alternatePhone, icon: <FiPhone className="h-5 w-5" /> },
      { label: "Gender", value: titleCase(user?.gender), icon: <FiUser className="h-5 w-5" /> },
      { label: "Date of Birth", value: formatDate(user?.dateOfBirth), icon: <FiCalendar className="h-5 w-5" /> },
    ],
    [user]
  )

  const employmentItems = useMemo(
    () => [
      { label: "Employee ID", value: user?.employeeId, icon: <FiBriefcase className="h-5 w-5" /> },
      { label: "Department", value: user?.department?.name, icon: <FiBriefcase className="h-5 w-5" /> },
      { label: "Designation", value: user?.position?.title, icon: <FiBriefcase className="h-5 w-5" /> },
      { label: "Role", value: titleCase(user?.role), icon: <FiShield className="h-5 w-5" /> },
      { label: "Access Role", value: user?.accessRole?.name, icon: <FiUsers className="h-5 w-5" /> },
      { label: "Joining Date", value: formatDate(user?.joiningDate), icon: <FiCalendar className="h-5 w-5" /> },
      { label: "Employment Type", value: titleCase(user?.employmentType), icon: <FiBriefcase className="h-5 w-5" /> },
      { label: "Salary Type", value: titleCase(user?.salaryType), icon: <FiBriefcase className="h-5 w-5" /> },
      { label: "Employee Status", value: titleCase(user?.employeeStatus), icon: <FiCheckCircle className="h-5 w-5" /> },
      { label: "Work Status", value: titleCase(user?.workStatus), icon: <FiCheckCircle className="h-5 w-5" /> },
      { label: "Leave Template", value: user?.leaveTemplate?.name, icon: <FiCalendar className="h-5 w-5" /> },
      { label: "Leave Year", value: String(user?.leaveEntitlement?.year || user?.leaveTemplate?.year || "-"), icon: <FiCalendar className="h-5 w-5" /> },
      { label: "Paid Leave Days", value: String(user?.leaveEntitlement?.paidDays || 0), icon: <FiCalendar className="h-5 w-5" /> },
      { label: "Unpaid Leave Days", value: String(user?.leaveEntitlement?.unpaidDays || 0), icon: <FiCalendar className="h-5 w-5" /> },
      { label: "Unpaid Leave Charge", value: unpaidChargeText(user?.leavePolicy || user?.leaveTemplate), icon: <FiCalendar className="h-5 w-5" /> },
    ],
    [user]
  )

  const contactItems = useMemo(
    () => [
      { label: "Address", value: readAddress(user?.address), icon: <FiHome className="h-5 w-5" /> },
      { label: "Emergency Contact", value: user?.emergencyContact?.name, icon: <FiUser className="h-5 w-5" /> },
      { label: "Emergency Phone", value: user?.emergencyContact?.phone, icon: <FiPhone className="h-5 w-5" /> },
      { label: "Relationship", value: user?.emergencyContact?.relationship, icon: <FiUsers className="h-5 w-5" /> },
    ],
    [user]
  )

  const refresh = () => {
    if (abortRef.current) abortRef.current.abort()

    const controller = new AbortController()
    abortRef.current = controller
    loadMe({ signal: controller.signal, silent: true })
  }

  const resetPasswordFields = () => {
    setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" })
    setShowPwd({ current: false, next: false, confirm: false })
    setPasswordError("")
  }

  const closePasswordModal = () => {
    if (savingPassword) return
    resetPasswordFields()
    setPasswordOpen(false)
  }

  const openPasswordModal = () => {
    resetPasswordFields()
    setPasswordOpen(true)
  }

  const savePassword = async () => {
    const currentPassword = passwords.currentPassword.trim()
    const newPassword = passwords.newPassword.trim()
    const confirmPassword = passwords.confirmPassword.trim()

    if (!currentPassword) return setPasswordError("Current password is required.")
    if (!newPassword) return setPasswordError("New password is required.")
    if (newPassword.length < 6) return setPasswordError("New password must be at least 6 characters.")
    if (newPassword !== confirmPassword) return setPasswordError("New password and confirmation do not match.")

    setSavingPassword(true)
    setPasswordError("")

    try {
      const res = await fetch(`${API_BASE}/users/me`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Password update failed")

      if (data?.user) syncUser(data.user)

      resetPasswordFields()
      setPasswordOpen(false)
      showToast("success", "Password updated.")
    } catch (error) {
      showToast("error", error?.message || "Password update failed")
    } finally {
      setSavingPassword(false)
    }
  }

  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ""

    if (!file) return
    if (!file.type?.startsWith("image/")) return showToast("error", "Please select an image file.")
    if (file.size > 3 * 1024 * 1024) return showToast("error", "Max file size is 3MB.")

    const localUrl = URL.createObjectURL(file)
    setAvatarPreview(localUrl)
    setAvatarBroken(false)

    const formData = new FormData()
    formData.append("avatar", file)

    setUploadingAvatar(true)

    try {
      const res = await fetch(`${API_BASE}/users/me/avatar`, {
        method: "PATCH",
        headers: getMultipartHeaders(),
        credentials: "include",
        body: formData,
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Avatar upload failed")

      syncUser(data?.user || data?.updatedUser || user)
      showToast("success", "Profile photo updated.")
    } catch (error) {
      showToast("error", error?.message || "Avatar upload failed")
    } finally {
      setAvatarPreview("")
      setUploadingAvatar(false)
      URL.revokeObjectURL(localUrl)
    }
  }

  const removeAvatar = async () => {
    if (!user?.avatarUrl) return

    setRemovingAvatar(true)

    try {
      const res = await fetch(`${API_BASE}/users/me/avatar`, {
        method: "DELETE",
        headers: getAuthHeaders(),
        credentials: "include",
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to remove photo")

      syncUser(data?.user || { ...(user || {}), avatarUrl: "", avatarPublicId: "" })
      setAvatarPreview("")
      showToast("success", "Profile photo removed.")
    } catch (error) {
      showToast("error", error?.message || "Failed to remove photo")
    } finally {
      setRemovingAvatar(false)
    }
  }

  const showEmploymentSection = loading || hasAnyValue(employmentItems)
  const showContactSection = loading || hasAnyValue(contactItems)

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-gray-50 p-4 sm:p-6 lg:p-8">
      <AnimatePresence>
        {toast.message ? (
          <Toast
            type={toast.type}
            message={toast.message}
            onClose={() => setToast({ type: "success", message: "" })}
          />
        ) : null}
      </AnimatePresence>

      <PasswordModal
        open={passwordOpen}
        onClose={closePasswordModal}
        pwd={passwords}
        setPwd={setPasswords}
        showPwd={showPwd}
        setShowPwd={setShowPwd}
        error={passwordError}
        saving={savingPassword}
        onSubmit={savePassword}
      />

      <div className="mx-auto max-w-6xl space-y-6">
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className={cn(card, "overflow-hidden bg-white/90 backdrop-blur")}
        >
          <div className="p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="relative shrink-0">
                  <div className="rounded-full bg-indigo-600 p-[2px] shadow-[0_12px_26px_-18px_rgba(79,70,229,0.9)]">
                    <div className="rounded-full bg-white p-[3px]">
                      <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-gray-100 sm:h-24 sm:w-24">
                        {showAvatar ? (
                          <img
                            src={displayAvatar}
                            alt="Profile"
                            className="h-full w-full object-cover"
                            draggable={false}
                            onError={() => setAvatarBroken(true)}
                          />
                        ) : (
                          <span className="text-2xl font-black text-gray-800">{userInitials}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "absolute bottom-1 right-1 h-4 w-4 rounded-full ring-4 ring-white",
                      isActive ? "bg-emerald-500" : "bg-rose-500"
                    )}
                  />
                </div>

                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-black tracking-tight text-gray-950 sm:text-3xl">
                    {loading && !user ? "Profile Settings" : user?.name || "Profile Settings"}
                  </h1>
                  <p className="mt-1 truncate text-sm font-bold text-gray-500">{user?.email || "-"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone="indigo">
                      <FiShield className="h-3.5 w-3.5" />
                      {titleCase(user?.role || "employee")}
                    </Badge>
                    <Badge tone={isActive ? "emerald" : "rose"}>{isActive ? "Active" : "Inactive"}</Badge>
                    <Badge>{user?.employeeId || "No ID"}</Badge>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click?.()}
                  disabled={loading || uploadingAvatar || removingAvatar || savingPassword}
                  className={cn(button, primaryButton)}
                >
                  <FiUploadCloud className="h-4 w-4" />
                  {uploadingAvatar ? "Uploading..." : "Upload"}
                </button>

                <button
                  type="button"
                  onClick={removeAvatar}
                  disabled={loading || uploadingAvatar || removingAvatar || savingPassword || !user?.avatarUrl}
                  className={cn(button, dangerButton)}
                >
                  <FiTrash2 className="h-4 w-4" />
                  {removingAvatar ? "Removing..." : "Remove"}
                </button>

                <button
                  type="button"
                  onClick={openPasswordModal}
                  disabled={loading || uploadingAvatar || removingAvatar || savingPassword}
                  className={cn(button, ghostButton)}
                >
                  <FiLock className="h-4 w-4" />
                  Password
                </button>

                <button
                  type="button"
                  onClick={refresh}
                  disabled={loading || refreshing || uploadingAvatar || removingAvatar || savingPassword}
                  className={cn(button, ghostButton)}
                >
                  <FiRefreshCcw className={cn("h-4 w-4", refreshing ? "animate-spin" : "")} />
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </motion.header>

        {loadError ? (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
            <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm font-bold">{loadError}</p>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <Section title="Basic Information" icon={<FiUser className="h-5 w-5" />}>
              <InfoGrid loading={loading && !user} items={basicItems} />
            </Section>

            {showEmploymentSection ? (
              <Section title="Employment" icon={<FiBriefcase className="h-5 w-5" />}>
                <InfoGrid loading={loading && !user} items={employmentItems} />
              </Section>
            ) : null}

            {showContactSection ? (
              <Section title="Contact & Emergency" icon={<FiHome className="h-5 w-5" />}>
                <InfoGrid loading={loading && !user} items={contactItems} />
              </Section>
            ) : null}
          </div>

          <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            <Section title="Access" icon={<FiShield className="h-5 w-5" />}>
              <div className="grid gap-4">
                <InfoItem icon={<FiShield className="h-5 w-5" />} label="Permission Group" value={user?.permissionGroup?.name} />
                <InfoItem icon={<FiCheckCircle className="h-5 w-5" />} label="Access Status" value={accessStatus} />
                <InfoItem icon={<FiUsers className="h-5 w-5" />} label="Permissions" value={String(permissions.length || 0)} />
              </div>

              <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                {permissions.length ? (
                  <div className="flex flex-wrap gap-2">
                    {permissions.map((permission) => (
                      <PermissionPill key={permission} value={permission} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-bold text-gray-500">No permission assigned.</p>
                )}
              </div>
            </Section>

            <Section title="Security" icon={<FiLock className="h-5 w-5" />}>
              <button
                type="button"
                onClick={openPasswordModal}
                disabled={loading || savingPassword || uploadingAvatar || removingAvatar}
                className={cn(button, primaryButton, "w-full")}
              >
                <FiLock className="h-4 w-4" />
                Change Password
              </button>
            </Section>
          </aside>
        </div>
      </div>
    </div>
  )
}
