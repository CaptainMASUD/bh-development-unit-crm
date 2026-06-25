"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import toast, { Toaster } from "react-hot-toast"
import {
  FiUsers,
  FiSearch,
  FiPlus,
  FiX,
  FiMail,
  FiUser,
  FiLock,
  FiRefreshCcw,
  FiEdit3,
  FiTrash2,
  FiAlertCircle,
  FiShield,
  FiEye,
  FiEyeOff,
  FiImage,
  FiUploadCloud,
  FiTrash,
} from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const PAGE_SIZE = 20

/** Cleaner, calmer card */
const card =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_28px_-16px_rgba(0,0,0,0.28)]"

function getToken() {
  return localStorage.getItem("token")
}

function getAuthHeadersJson() {
  const token = getToken()
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

// For FormData: DO NOT set Content-Type manually.
function getAuthHeadersMultipart() {
  const token = getToken()
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function formatDate(v) {
  const d = v ? new Date(v) : null
  if (!d || Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString()
}

function Field({ label, icon, children, hint }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-semibold text-gray-800">{label}</label>
        {hint ? <span className="text-xs text-gray-500">{hint}</span> : null}
      </div>
      <div className="relative">
        {icon ? (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-600">{icon}</span>
        ) : null}
        <div className={icon ? "pl-10" : ""}>{children}</div>
      </div>
    </div>
  )
}

function Pill({ tone = "indigo", label, value }) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-600/10",
    green: "bg-green-50 text-green-700 ring-green-600/10",
    gray: "bg-gray-100 text-gray-700 ring-gray-600/10",
  }
  return (
    <div className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl ring-1 ${tones[tone]}`}>
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-sm font-extrabold">{value}</span>
    </div>
  )
}

/** ✅ NEW: Proper smooth blue toggle */
function ToggleSwitch({
  checked,
  onChange,
  disabled,
  labelOn = "Active",
  labelOff = "Inactive",
  className = "",
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onChange?.(!checked)}
      role="switch"
      aria-checked={checked}
      className={`inline-flex items-center gap-2 select-none ${className} ${
        disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
      }`}
      title={disabled ? "Not allowed." : checked ? labelOn : labelOff}
    >
      <span className="text-sm font-semibold text-gray-700">{checked ? labelOn : labelOff}</span>

      <span
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 ${
          checked ? "bg-indigo-600" : "bg-gray-200"
        }`}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="inline-block h-5 w-5 rounded-full bg-white shadow"
          style={{ marginLeft: checked ? 24 : 4 }}
        />
      </span>
    </button>
  )
}

/**
 * ✅ UPDATED: Delete modal now requires ADMIN/SUPERADMIN password
 * - Sends password to backend in DELETE body: { password }
 */
function DeleteWithPasswordModal({
  open,
  title,
  description,
  confirmText = "Delete",
  onClose,
  onConfirm,
  isSubmitting,
}) {
  const [password, setPassword] = useState("")
  const [show, setShow] = useState(false)
  const [err, setErr] = useState("")

  useEffect(() => {
    if (!open) return
    setPassword("")
    setShow(false)
    setErr("")
  }, [open])

  if (!open) return null

  const canConfirm = String(password || "").length >= 6 && !isSubmitting

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="w-full max-w-md rounded-2xl bg-white border border-gray-100 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.6)] overflow-hidden"
        >
          <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-600 mt-1">{description}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-gray-100 active:scale-95 transition"
              aria-label="Close"
            >
              <FiX className="w-5 h-5 text-gray-700" />
            </button>
          </div>

          <div className="p-5">
            {err ? (
              <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                {err}
              </div>
            ) : null}

            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <div className="flex items-center gap-2 text-sm font-extrabold text-gray-900">
                <FiLock className="w-4 h-4 text-indigo-600" />
                Confirm with your password
              </div>
              <p className="mt-1 text-sm text-gray-600">
                For security, enter your account password to delete.
              </p>

              <div className="mt-3 relative">
                <input
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setErr("")
                  }}
                  type={show ? "text" : "password"}
                  placeholder="Your password (min 6 chars)"
                  className="w-full px-3 py-2.5 pr-11 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShow((p) => !p)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-100 active:scale-95 transition"
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? (
                    <FiEyeOff className="w-4 h-4 text-gray-600" />
                  ) : (
                    <FiEye className="w-4 h-4 text-gray-600" />
                  )}
                </button>
              </div>

              <p className="mt-2 text-xs text-gray-500">
                This action is permanent and cannot be undone.
              </p>
            </div>
          </div>

          <div className="p-5 flex flex-col sm:flex-row gap-2 sm:justify-end border-t border-gray-100 bg-white">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 active:scale-[0.99] transition"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                const pwd = String(password || "")
                if (pwd.length < 6) {
                  setErr("Password must be at least 6 characters.")
                  return
                }
                try {
                  await onConfirm?.(pwd)
                } catch (e) {
                  setErr(e?.message || "Delete failed")
                }
              }}
              disabled={!canConfirm}
              className={`px-4 py-2.5 rounded-xl text-white active:scale-[0.99] transition disabled:opacity-60 ${
                canConfirm ? "bg-rose-600 hover:bg-rose-700" : "bg-rose-600"
              }`}
            >
              {isSubmitting ? "Deleting..." : confirmText}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function SegTab({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-semibold transition ${
        active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

function roleTitle(role) {
  if (role === "superadmin") return "Super Admin"
  if (role === "admin") return "Admin"
  if (role === "marketing_team") return "Marketing Team"
  return "Employee"
}

/** ✅ Admin cannot modify SuperAdmin accounts (UI safety) */
function canManageTarget(meRole, targetRole) {
  if (meRole === "superadmin") return true
  if (meRole === "admin" && targetRole === "superadmin") return false
  return true
}

function Avatar({ url, name }) {
  const letter = String(name || "?").trim()?.[0]?.toUpperCase() || "?"
  return (
    <div className="w-11 h-11 rounded-2xl overflow-hidden ring-1 ring-gray-200 bg-gray-100 flex items-center justify-center shrink-0">
      {url ? (
        <img
          src={url}
          alt={name || "avatar"}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none"
          }}
        />
      ) : (
        <span className="text-sm font-extrabold text-gray-700">{letter}</span>
      )}
    </div>
  )
}

async function uploadAvatarByAdmin(userId, file) {
  const fd = new FormData()
  fd.append("avatar", file)

  const res = await fetch(`${API_BASE}/users/${userId}/avatar`, {
    method: "PATCH",
    headers: getAuthHeadersMultipart(),
    credentials: "include",
    body: fd,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Avatar upload failed")
  return data
}

async function deleteAvatarByAdmin(userId) {
  const res = await fetch(`${API_BASE}/users/${userId}/avatar`, {
    method: "DELETE",
    headers: getAuthHeadersJson(),
    credentials: "include",
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Avatar delete failed")
  return data
}

function UserModal({ open, mode, role, initial, accessLists, onClose, onSaved, showToast }) {
  const isEdit = mode === "edit"
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [showPass, setShowPass] = useState(false)

  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState("")

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    isActive: true,
    department: "",
    position: "",
    permissionGroup: "",
  })

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => (document.body.style.overflow = prev)
  }, [open])

  useEffect(() => {
    if (!open) return
    setError("")
    setShowPass(false)

    setForm({
      name: initial?.name || "",
      email: initial?.email || "",
      password: "",
      isActive: typeof initial?.isActive === "boolean" ? initial.isActive : true,
      department: initial?.department?._id || initial?.department || "",
      position: initial?.position?._id || initial?.position || "",
      permissionGroup: initial?.permissionGroup?._id || initial?.permissionGroup || "",
    })

    setAvatarFile(null)
    setAvatarPreview("")
  }, [open, initial])

  useEffect(() => {
    if (!avatarFile) return
    const url = URL.createObjectURL(avatarFile)
    setAvatarPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [avatarFile])

  const update = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }))

  const validatePasswordIfProvided = (pwd) => {
    if (!pwd) return null
    if (String(pwd).length < 6) return "Password must be at least 6 characters."
    return null
  }

  const submit = async () => {
    const name = form.name.trim()
    const email = form.email.trim()
    const pwdErr = validatePasswordIfProvided(form.password)

    if (!name) return setError("Name is required.")
    if (!email) return setError("Email is required.")
    if (!isEdit && !form.password) return setError("Password is required.")
    if (pwdErr) return setError(pwdErr)

    setIsSubmitting(true)
    setError("")
    try {
      const payload = {
        name,
        email,
        isActive: !!form.isActive,
        ...(form.password ? { password: form.password } : {}),
        ...(role === "employee"
          ? {
              department: form.department || null,
              position: form.position || null,
              permissionGroup: form.permissionGroup || null,
            }
          : {}),
      }

      const base =
        role === "superadmin"
          ? "superadmins"
          : role === "admin"
          ? "admins"
          : "employees"

      const url = isEdit ? `${API_BASE}/users/${base}/${initial._id}` : `${API_BASE}/users/${base}`
      const method = isEdit ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: getAuthHeadersJson(),
        credentials: "include",
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Save failed")

      const targetId =
        (isEdit && initial?._id) ||
        data?.employee?._id ||
        data?.marketing?._id ||
        data?.admin?._id ||
        data?.superadmin?._id ||
        data?.user?._id

      if (avatarFile && targetId) {
        await uploadAvatarByAdmin(targetId, avatarFile)
      }

      onSaved?.()
      onClose?.()
    } catch (e) {
      setError(e?.message || "Save failed")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteAvatar = async () => {
    if (!initial?._id) return
    setIsSubmitting(true)
    setError("")
    try {
      await deleteAvatarByAdmin(initial._id)
      showToast?.("success", "Profile picture removed.")
      onSaved?.()
      onClose?.()
    } catch (e) {
      setError(e?.message || "Failed to remove profile picture")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!open) return null

  const currentAvatarUrl = avatarPreview || initial?.avatarUrl || ""
  const isEmployeeRole = role === "employee"
  const departments = accessLists?.departments || []
  const positions = (accessLists?.positions || []).filter((position) => {
    if (!form.department) return true
    return String(position.department?._id || position.department) === String(form.department)
  })
  const permissionGroups = accessLists?.permissionGroups || []

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      onKeyDown={(e) => e.key === "Escape" && onClose?.()}
    >
      <div className="absolute inset-0 overflow-y-auto">
        <div className="min-h-full flex items-start sm:items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 14 }}
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_30px_70px_-30px_rgba(0,0,0,0.6)]"
          >
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center">
                  {isEdit ? <FiEdit3 className="w-5 h-5" /> : <FiPlus className="w-5 h-5" />}
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-gray-900">
                    {isEdit ? "Edit" : "Create"} {roleTitle(role)}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {isEdit ? "Update details and profile picture." : "Create account with details and profile picture."}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-gray-100 active:scale-95 transition"
                aria-label="Close"
              >
                <FiX className="w-5 h-5 text-gray-700" />
              </button>
            </div>

            <div className="p-6 bg-white">
              {error && (
                <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
              )}

              {/* ✅ PROFILE PICTURE */}
              <div className="mb-5 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-2xl overflow-hidden bg-white ring-1 ring-gray-200 shrink-0 flex items-center justify-center">
                      {currentAvatarUrl ? (
                        <img src={currentAvatarUrl} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <FiImage className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-gray-900">Profile picture</p>
                      <p className="text-sm text-gray-500 truncate">
                        {avatarFile ? avatarFile.name : initial?.avatarUrl ? "Current picture" : "No picture"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 justify-end">
                    <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.99] transition cursor-pointer">
                      <FiUploadCloud className="w-4 h-4" />
                      Upload
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) setAvatarFile(f)
                        }}
                      />
                    </label>

                    {avatarFile ? (
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarFile(null)
                          setAvatarPreview("")
                        }}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 active:scale-[0.99] transition"
                      >
                        <FiX className="w-4 h-4" />
                        Clear
                      </button>
                    ) : null}

                    {isEdit && initial?.avatarUrl ? (
                      <button
                        type="button"
                        onClick={handleDeleteAvatar}
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 active:scale-[0.99] transition disabled:opacity-60"
                      >
                        <FiTrash className="w-4 h-4" />
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>

                <p className="mt-3 text-xs text-gray-500">Tip: Use a clear face photo for best results.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Name" icon={<FiUser className="w-4 h-4" />}>
                  <input
                    value={form.name}
                    onChange={update("name")}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Full name"
                  />
                </Field>

                <Field label="Email" icon={<FiMail className="w-4 h-4" />}>
                  <input
                    value={form.email}
                    onChange={update("email")}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="email@example.com"
                    type="email"
                  />
                </Field>

                <div className="md:col-span-2">
                  <Field
                    label={isEdit ? "New Password (optional)" : "Password"}
                    icon={<FiLock className="w-4 h-4" />}
                    hint={isEdit ? "At least 6 characters (if changing)" : "At least 6 characters"}
                  >
                    <div className="relative">
                      <input
                        value={form.password}
                        onChange={update("password")}
                        className="w-full px-3 py-2.5 pr-11 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder={isEdit ? "Leave empty to keep current password" : "At least 6 characters"}
                        type={showPass ? "text" : "password"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((p) => !p)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-100 active:scale-95 transition"
                        aria-label={showPass ? "Hide password" : "Show password"}
                      >
                        {showPass ? <FiEyeOff className="w-4 h-4 text-gray-600" /> : <FiEye className="w-4 h-4 text-gray-600" />}
                      </button>
                    </div>
                  </Field>
                </div>

                {isEmployeeRole ? (
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <Field label="Department">
                      <select
                        value={form.department}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, department: e.target.value, position: "" }))
                        }
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        <option value="">Select department</option>
                        {departments.map((department) => (
                          <option key={department._id} value={department._id}>
                            {department.name}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Position">
                      <select
                        value={form.position}
                        onChange={(e) => setForm((p) => ({ ...p, position: e.target.value }))}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        <option value="">Select position</option>
                        {positions.map((position) => (
                          <option key={position._id} value={position._id}>
                            {position.title}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Permission Group">
                      <select
                        value={form.permissionGroup}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, permissionGroup: e.target.value }))
                        }
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        <option value="">Select access</option>
                        {permissionGroups.map((group) => (
                          <option key={group._id} value={group._id}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                ) : null}

                {/* ✅ UPDATED: smooth toggle here */}
                <div className="md:col-span-2 flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10 flex items-center justify-center">
                      <FiShield className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-gray-900">Status</p>
                      <p className="text-sm text-gray-500">{form.isActive ? "Active" : "Inactive"}</p>
                    </div>
                  </div>

                  <ToggleSwitch
                    checked={form.isActive}
                    onChange={(v) => setForm((p) => ({ ...p, isActive: !!v }))}
                    disabled={isSubmitting}
                    labelOn="Active"
                    labelOff="Inactive"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 bg-white">
              <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 active:scale-[0.99] transition"
                >
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 active:scale-[0.99] transition"
                >
                  {isSubmitting ? "Saving..." : isEdit ? "Save" : "Create"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

function RowSkeleton() {
  return (
    <div className={`${card} p-4`}>
      <div className="animate-pulse flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="h-4 w-44 bg-gray-200 rounded mb-2" />
          <div className="h-3 w-64 bg-gray-200 rounded" />
        </div>
        <div className="h-9 w-28 bg-gray-200 rounded-xl" />
      </div>
    </div>
  )
}

export default function UsersAdminPanel() {
  const [tab, setTab] = useState("employees") // employees | admins | superadmins

  const [list, setList] = useState([])
  const [count, setCount] = useState(0)

  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState("")

  // server-backed filters (cursor + q + active + sort)
  const [searchTerm, setSearchTerm] = useState("")
  const [debounced, setDebounced] = useState("")
  const [statusFilter, setStatusFilter] = useState("all") // all | active | inactive

  /**
   * ✅ supports:
   * - newest / oldest (server sort)
   * - az / za (client sort for display)
   */
  const [sortMode, setSortMode] = useState("newest") // newest | oldest | az | za

  // pagination
  const [nextCursor, setNextCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)

  // modals / ui
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState("create")
  const [selected, setSelected] = useState(null)

  // ✅ UPDATED: delete confirm modal needs password
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, item: null })
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  const [me, setMe] = useState(null)
  const [accessLists, setAccessLists] = useState({
    departments: [],
    positions: [],
    permissionGroups: [],
  })

  const abortRef = useRef(null)
  const isSuperAdmin = me?.role === "superadmin"

  const tabConfig = useMemo(() => {
    return {
      employees: { endpoint: "employees", listKey: "employees", modalRole: "employee" },
      admins: { endpoint: "admins", listKey: "admins", modalRole: "admin" },
      superadmins: { endpoint: "superadmins", listKey: "superadmins", modalRole: "superadmin" },
    }
  }, [])

  const current = tabConfig[tab] || tabConfig.employees
  const endpointBase = current.endpoint
  const responseListKey = current.listKey
  const modalRole = current.modalRole

  useEffect(() => {
    const t = setTimeout(() => setDebounced(searchTerm.trim()), 250)
    return () => clearTimeout(t)
  }, [searchTerm])

  const showToast = (type, message) => {
    const safeMessage = message || "Something went wrong."
    if (type === "error") toast.error(safeMessage)
    else toast.success(safeMessage)
  }

  // load me
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/users/me`, {
          method: "GET",
          headers: getAuthHeadersJson(),
          credentials: "include",
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok) setMe(data?.user || null)
      } catch {}
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const [departmentsRes, positionsRes, groupsRes] = await Promise.all([
          fetch(`${API_BASE}/access-control/departments`, {
            headers: getAuthHeadersJson(),
            credentials: "include",
          }),
          fetch(`${API_BASE}/access-control/positions`, {
            headers: getAuthHeadersJson(),
            credentials: "include",
          }),
          fetch(`${API_BASE}/access-control/permission-groups`, {
            headers: getAuthHeadersJson(),
            credentials: "include",
          }),
        ])
        const [departments, positions, groups] = await Promise.all([
          departmentsRes.json().catch(() => ({})),
          positionsRes.json().catch(() => ({})),
          groupsRes.json().catch(() => ({})),
        ])
        setAccessLists({
          departments: departments.departments || [],
          positions: positions.positions || [],
          permissionGroups: groups.permissionGroups || [],
        })
      } catch {}
    })()
  }, [])

  // if not superadmin, never allow that tab
  useEffect(() => {
    if (!isSuperAdmin && tab === "superadmins") setTab("employees")
  }, [isSuperAdmin, tab])

  // ✅ Only these are sent to backend (so we never send unsupported "az/za")
  const backendSort = useMemo(() => {
    return sortMode === "oldest" ? "oldest" : "newest"
  }, [sortMode])

  const buildListUrl = ({ cursor = null } = {}) => {
    const qs = new URLSearchParams()
    qs.set("limit", String(PAGE_SIZE))

    if (debounced) qs.set("q", debounced)

    if (statusFilter !== "all") {
      qs.set("active", String(statusFilter === "active"))
    }

    qs.set("sort", backendSort)
    if (cursor) qs.set("cursor", String(cursor))

    return `${API_BASE}/users/${endpointBase}?${qs.toString()}`
  }

  const fetchUsers = async ({ reset = true } = {}) => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setError("")
    if (reset) {
      setIsLoading(true)
      setList([])
      setNextCursor(null)
      setHasMore(false)
    } else {
      setIsLoadingMore(true)
    }

    try {
      const url = buildListUrl({ cursor: reset ? null : nextCursor })
      const res = await fetch(url, {
        method: "GET",
        headers: getAuthHeadersJson(),
        credentials: "include",
        signal: controller.signal,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to fetch users")

      const arr = Array.isArray(data?.[responseListKey]) ? data[responseListKey] : []

      if (reset) setList(arr)
      else setList((prev) => [...prev, ...arr])

      setCount(Number(data?.count ?? 0))
      setNextCursor(data?.nextCursor || null)
      setHasMore(Boolean(data?.hasMore))
    } catch (e) {
      if (e?.name !== "AbortError") setError(e?.message || "Failed to load users.")
      if (reset) {
        setList([])
        setCount(0)
        setNextCursor(null)
        setHasMore(false)
      }
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }

  // first load + tab change
  useEffect(() => {
    fetchUsers({ reset: true })
    return () => abortRef.current?.abort?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpointBase, responseListKey])

  // server-backed filters
  useEffect(() => {
    fetchUsers({ reset: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, statusFilter, backendSort])

  // ✅ Client-side sorted view (A–Z / Z–A)
  const displayList = useMemo(() => {
    if (!Array.isArray(list) || list.length === 0) return []
    const arr = [...list]

    const keyFor = (u) => {
      const n = String(u?.name || "").trim()
      const e = String(u?.email || "").trim()
      return n || e || ""
    }

    if (sortMode === "az") {
      arr.sort((a, b) => keyFor(a).localeCompare(keyFor(b), undefined, { sensitivity: "base", numeric: true }))
      return arr
    }
    if (sortMode === "za") {
      arr.sort((a, b) => keyFor(b).localeCompare(keyFor(a), undefined, { sensitivity: "base", numeric: true }))
      return arr
    }

    return arr
  }, [list, sortMode])

  const stats = useMemo(() => {
    const active = list.filter((u) => !!u?.isActive).length
    const inactive = list.filter((u) => !u?.isActive).length
    return { active, inactive }
  }, [list])

  const openCreate = () => {
    setSelected(null)
    setModalMode("create")
    setModalOpen(true)
  }

  const openEdit = (u) => {
    setSelected(u)
    setModalMode("edit")
    setModalOpen(true)
  }

  /**
   * ✅ UPDATED: backend requires { password } in DELETE body
   */
  const deleteUser = async (u, password) => {
    const pwd = String(password || "")
    if (!pwd || pwd.length < 6) throw new Error("Password is required (min 6 chars).")

    const url = `${API_BASE}/users/${endpointBase}/${u._id}`
    const res = await fetch(url, {
      method: "DELETE",
      headers: getAuthHeadersJson(),
      credentials: "include",
      body: JSON.stringify({ password: pwd }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.message || "Delete failed")
    return data
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <Toaster position="top-right" toastOptions={{ duration: 2600, style: { borderRadius: "14px", fontWeight: 700 } }} />

      {/* ✅ UPDATED delete confirm (password required) */}
      <AnimatePresence>
        {deleteConfirm.open && (
          <DeleteWithPasswordModal
            open={deleteConfirm.open}
            title={`Delete ${roleTitle(modalRole)}?`}
            description={`This will permanently remove ${deleteConfirm.item?.name || "this user"}.`}
            confirmText="Delete"
            isSubmitting={deleteSubmitting}
            onClose={() => {
              if (deleteSubmitting) return
              setDeleteConfirm({ open: false, item: null })
            }}
            onConfirm={async (password) => {
              const u = deleteConfirm.item
              if (!u) return

              setDeleteSubmitting(true)
              try {
                await deleteUser(u, password)
                showToast("success", "Deleted.")
                setDeleteConfirm({ open: false, item: null })
                fetchUsers({ reset: true })
              } catch (e) {
                showToast("error", e?.message || "Delete failed")
                throw e
              } finally {
                setDeleteSubmitting(false)
              }
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modalOpen && (
          <UserModal
            open={modalOpen}
            mode={modalMode}
            role={modalRole}
            initial={selected}
            accessLists={accessLists}
            showToast={showToast}
            onClose={() => setModalOpen(false)}
            onSaved={() => {
              showToast("success", modalMode === "edit" ? "Saved." : "Created.")
              fetchUsers({ reset: true })
            }}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className={`${card} p-6`}>
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm">
                <FiUsers className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">User Management</h1>
                <p className="text-sm text-gray-500">
                  {me?.role === "superadmin" ? "Super Admins + Admins + Employees" : "Admins + Employees"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="indigo" label="Total" value={count || 0} />
              <Pill tone="green" label="Active " value={stats.active} />
              <Pill tone="gray" label="Inactive " value={stats.inactive} />

              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.99] transition"
              >
                <FiPlus className="w-4 h-4" />
                Create
              </button>

              <button
                onClick={() => fetchUsers({ reset: true })}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60"
                title="Refresh"
              >
                <FiRefreshCcw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex flex-wrap gap-2">
            <SegTab active={tab === "employees"} onClick={() => setTab("employees")} icon={<FiUser className="w-4 h-4" />} label="Employees" />
            <SegTab active={tab === "admins"} onClick={() => setTab("admins")} icon={<FiShield className="w-4 h-4" />} label="Admins" />
            {me?.role === "superadmin" ? (
              <SegTab active={tab === "superadmins"} onClick={() => setTab("superadmins")} icon={<FiShield className="w-4 h-4" />} label="Super Admins" />
            ) : null}
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <div className="mb-5 grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
        {/* Search */}
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-12 pl-10 w-full px-4 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Status */}
        <div className="h-12 rounded-xl border border-gray-200 bg-white px-3 flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-gray-900 shrink-0">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 w-full px-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="all">All</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
        </div>

        {/* Sort */}
        <div className="h-12 rounded-xl border border-gray-200 bg-white px-3 flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-gray-900 shrink-0">Sort</span>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value)}
            className="h-9 w-full px-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="az">A–Z</option>
            <option value="za">Z–A</option>
          </select>
        </div>

        <div className="lg:col-span-3 flex items-center">
          <div className="text-sm text-gray-500">
            Loaded <span className="font-semibold text-gray-900">{list.length}</span>{" "}
            {typeof count === "number" ? (
              <>
                of <span className="font-semibold text-gray-900">{count}</span>
              </>
            ) : null}
            {debounced ? <span className="ml-2 text-gray-400">• search: “{debounced}”</span> : null}
            {sortMode === "az" || sortMode === "za" ? <span className="ml-2 text-gray-400">• sorted locally</span> : null}
          </div>

        </div>
      </div>

      {error && (
        <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-2">
          <FiAlertCircle className="w-5 h-5 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        <AnimatePresence>
          {isLoading && list.length === 0 ? (
            <>
              <RowSkeleton />
              <RowSkeleton />
              <RowSkeleton />
            </>
          ) : displayList.length > 0 ? (
            displayList.map((u) => {
              const active = !!u?.isActive
              const isMe = String(u?._id) === String(me?._id)
              const canManage = canManageTarget(me?.role, u?.role)
              const disableActions = !canManage

              return (
                <motion.div
                  key={u?._id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`${card} p-5`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="min-w-0 flex items-center gap-3">
                      <Avatar url={u?.avatarUrl} name={u?.name} />

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-base font-extrabold text-gray-900 truncate">{u?.name || "—"}</p>

                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${
                              active
                                ? "bg-green-50 text-green-700 ring-green-600/10"
                                : "bg-gray-100 text-gray-700 ring-gray-600/10"
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />
                            {active ? "active" : "inactive"}
                          </span>

                          {u?.role ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ring-1 bg-indigo-50 text-indigo-700 ring-indigo-600/10">
                              {u.role}
                            </span>
                          ) : null}

                          {isMe ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ring-1 bg-gray-100 text-gray-700 ring-gray-600/10">
                              you
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                          <span className="inline-flex items-center gap-2">
                            <FiMail className="w-4 h-4 text-indigo-600" />
                            <span className="font-medium">{u?.email || "—"}</span>
                          </span>
                          <span className="text-gray-300">•</span>
                          <span className="text-xs text-gray-500">
                            Created <span className="font-semibold text-gray-700">{formatDate(u?.createdAt)}</span>
                          </span>
                        </div>

                        {u?.role === "employee" ? (
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full bg-sky-50 px-2.5 py-1 font-semibold text-sky-700 ring-1 ring-sky-600/10">
                              {u?.department?.name || "No department"}
                            </span>
                            <span className="rounded-full bg-violet-50 px-2.5 py-1 font-semibold text-violet-700 ring-1 ring-violet-600/10">
                              {u?.position?.title || "No position"}
                            </span>
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 ring-1 ring-emerald-600/10">
                              {u?.permissionGroup?.name || "No access group"}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 justify-start lg:justify-end items-center">
                      {/* ✅ UPDATED: Proper toggle in row */}
                      <ToggleSwitch
                        checked={active}
                        disabled={disableActions}
                        onChange={async (next) => {
                          try {
                            const res = await fetch(`${API_BASE}/users/${tabConfig[tab].endpoint}/${u._id}`, {
                              method: "PATCH",
                              headers: getAuthHeadersJson(),
                              credentials: "include",
                              body: JSON.stringify({ isActive: !!next }),
                            })
                            const data = await res.json().catch(() => ({}))
                            if (!res.ok) throw new Error(data?.message || "Update failed")
                            showToast("success", "Updated.")
                            fetchUsers({ reset: true })
                          } catch (e) {
                            showToast("error", e?.message || "Update failed")
                          }
                        }}
                        labelOn="Active"
                        labelOff="Inactive"
                      />

                      <button
                        onClick={() => openEdit(u)}
                        disabled={disableActions}
                        title={disableActions ? "Not allowed." : "Edit"}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <FiEdit3 className="w-4 h-4" />
                        Edit
                      </button>

                      <button
                        onClick={() => setDeleteConfirm({ open: true, item: u })}
                        disabled={(tab === "superadmins" && isMe) || disableActions}
                        title={
                          tab === "superadmins" && isMe
                            ? "You cannot delete yourself"
                            : disableActions
                            ? "Not allowed."
                            : "Delete"
                        }
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <FiTrash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })
          ) : (
            <div className={`${card} p-10 text-center`}>
              <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center ring-1 ring-indigo-600/10">
                <FiUsers className="w-6 h-6" />
              </div>
              <p className="mt-3 text-sm font-extrabold text-gray-900">No users found</p>
              <p className="mt-1 text-sm text-gray-500">Try another search, change filters, or create a new account.</p>
              <button
                onClick={openCreate}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.99] transition"
              >
                <FiPlus className="w-4 h-4" />
                Create
              </button>
            </div>
          )}
        </AnimatePresence>

        {isLoadingMore ? (
          <>
            <RowSkeleton />
            <RowSkeleton />
          </>
        ) : null}

        {hasMore ? (
          <div className="flex justify-center pt-3">
            <button
              onClick={() => fetchUsers({ reset: false })}
              disabled={isLoadingMore || isLoading}
              className="inline-flex min-w-[150px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-60"
            >
              <FiPlus className={`h-4 w-4 ${isLoadingMore ? "animate-spin" : ""}`} />
              {isLoadingMore ? "Loading..." : "Load more"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
