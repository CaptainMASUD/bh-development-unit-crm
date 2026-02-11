// MarketingTeamProfileSettings.jsx
// ✅ Marketing Team Profile Settings (FULL UPDATED)
// ✅ Marketing team CANNOT change name/email (read-only)
// ✅ UI TEXT CHANGE: removed the word "locked"
// ✅ Shows short hint: "Contact admin to change"
// ✅ NEW: "Change Password" button (same primary button style), toggles password fields
// ✅ NEW: instant scroll to password section when opened (no delay)
// ✅ Photo upload/remove kept

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  FiUser,
  FiMail,
  FiShield,
  FiLock,
  FiEye,
  FiEyeOff,
  FiSave,
  FiX,
  FiAlertCircle,
  FiCheckCircle,
  FiRefreshCcw,
  FiUploadCloud,
  FiTrash2,
  FiChevronDown,
  FiChevronUp,
} from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const cn = (...c) => c.filter(Boolean).join(" ")

function getAuthHeaders() {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}
function getAuthHeadersMultipart() {
  const token = localStorage.getItem("token")
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

function Toast({ type = "success", message, onClose }) {
  if (!message) return null
  const styles =
    type === "error"
      ? "bg-rose-50 border-rose-200 text-rose-700"
      : "bg-emerald-50 border-emerald-200 text-emerald-700"
  const Icon = type === "error" ? FiAlertCircle : FiCheckCircle

  return (
    <div className="fixed top-5 right-5 z-[60] max-w-sm w-[92vw] sm:w-auto">
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        transition={{ duration: 0.18 }}
        className={cn("rounded-2xl border p-3 shadow-xl backdrop-blur", styles)}
      >
        <div className="flex items-start gap-3">
          <Icon className="w-5 h-5 mt-0.5" />
          <p className="text-sm font-semibold flex-1">{message}</p>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-black/5 active:scale-95 transition"
            aria-label="Close toast"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function Badge({ children, tone = "gray" }) {
  const tones = {
    gray: "bg-gray-100 text-gray-700 border-gray-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    sky: "bg-sky-50 text-sky-700 border-sky-200",
  }
  const cls = tones[tone] || tones.gray
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold tracking-wide border",
        cls
      )}
    >
      {children}
    </span>
  )
}

function Section({ title, subtitle, icon, right, children }) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white shadow-[0_18px_60px_-45px_rgba(0,0,0,0.55)] overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-gray-900 truncate">{title}</p>
            <p className="text-xs text-gray-500 truncate">{subtitle}</p>
          </div>
        </div>
        <div className="shrink-0">{right}</div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Field({ label, icon, hint, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-extrabold text-gray-800">{label}</label>
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

function SkeletonLine({ w = "w-40" }) {
  return <div className={cn("h-3", w, "bg-gray-200 rounded animate-pulse")} />
}
function SkeletonInput() {
  return <div className="h-[44px] w-full bg-gray-200 rounded-2xl animate-pulse" />
}
function DividerLabel({ label }) {
  return (
    <div className="relative my-5">
      <div className="border-t border-gray-100" />
      <div className="absolute left-0 top-1/2 -translate-y-1/2">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-white text-gray-600 border border-gray-100">
          {label}
        </span>
      </div>
    </div>
  )
}
function getInitials(nameOrEmail) {
  const s = String(nameOrEmail || "").trim()
  if (!s) return "U"
  const parts = s.split(" ").filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return (parts[0].slice(0, 1) + parts[1].slice(0, 1)).toUpperCase()
}

export default function MarketingTeamProfileSettings() {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [toast, setToast] = useState({ type: "success", message: "" })
  const toastTimer = useRef(null)

  // display only (read-only fields)
  const [profile, setProfile] = useState({ name: "", email: "" })

  // ✅ password hidden until button click
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [pwd, setPwd] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [showPwd, setShowPwd] = useState({ current: false, next: false, confirm: false })

  const [formError, setFormError] = useState("")
  const [loadError, setLoadError] = useState("")

  // avatar
  const fileInputRef = useRef(null)
  const [avatarPreview, setAvatarPreview] = useState("")
  const [isAvatarUploading, setIsAvatarUploading] = useState(false)
  const [isAvatarRemoving, setIsAvatarRemoving] = useState(false)
  const [avatarBroken, setAvatarBroken] = useState(false)

  const abortRef = useRef(null)

  // scroll
  const passwordSectionRef = useRef(null)
  const shouldScrollRef = useRef(false)

  const showToastMsg = (type, message) => {
    setToast({ type, message })
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast({ type: "success", message: "" }), 2200)
  }

  const hydrateFromStorage = () => {
    try {
      const stored = localStorage.getItem("user")
      const u = stored ? JSON.parse(stored) : null
      if (u) {
        setUser(u)
        setProfile({ name: u?.name || "", email: u?.email || "" })
        setAvatarBroken(false)
      }
    } catch {}
  }

  const fetchMe = async ({ signal, silent = false } = {}) => {
    if (!silent) setIsLoading(true)
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

      const u = data?.user
      setUser(u)
      setProfile({ name: u?.name || "", email: u?.email || "" })
      setAvatarBroken(false)
      if (u) localStorage.setItem("user", JSON.stringify(u))
    } catch (e) {
      if (e?.name !== "AbortError") {
        setLoadError(e?.message || "Could not load profile.")
        hydrateFromStorage()
      }
    } finally {
      if (!silent) setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    hydrateFromStorage()
    const ac = new AbortController()
    abortRef.current = ac
    fetchMe({ signal: ac.signal, silent: false })
    return () => ac.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const role = useMemo(() => user?.role || "marketing_team", [user])
  const initials = useMemo(() => getInitials(user?.name || user?.email), [user])

  const hasPasswordChanges = useMemo(
    () => !!pwd.currentPassword || !!pwd.newPassword || !!pwd.confirmPassword,
    [pwd]
  )

  const resetPasswordFields = () => {
    setPwd({ currentPassword: "", newPassword: "", confirmPassword: "" })
    setShowPwd({ current: false, next: false, confirm: false })
  }

  const revertAll = () => {
    setFormError("")
    resetPasswordFields()
    setShowChangePassword(false)
  }

  const validate = () => {
    // only validate if section is open AND user typed something
    if (showChangePassword && hasPasswordChanges) {
      if (!pwd.currentPassword) return "Current password is required."
      if (!pwd.newPassword) return "New password is required."
      if (pwd.newPassword.length < 6) return "New password must be at least 6 characters."
      if (pwd.newPassword !== pwd.confirmPassword) return "Passwords do not match."
      return ""
    }

    return "Nothing to update."
  }

  const save = async () => {
    const err = validate()
    if (err) {
      if (err === "Nothing to update.") return showToastMsg("success", err)
      return setFormError(err)
    }

    const payload = {
      currentPassword: pwd.currentPassword,
      newPassword: pwd.newPassword,
    }

    setIsSaving(true)
    setFormError("")
    try {
      const res = await fetch(`${API_BASE}/users/me`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Update failed")

      const updated = data?.user || null
      if (updated) {
        setUser(updated)
        setProfile({ name: updated?.name || "", email: updated?.email || "" })
        localStorage.setItem("user", JSON.stringify(updated))
        setAvatarBroken(false)
      }

      resetPasswordFields()
      setShowChangePassword(false)

      const ac = new AbortController()
      fetchMe({ signal: ac.signal, silent: true })

      showToastMsg("success", "Password updated.")
    } catch (e) {
      showToastMsg("error", e?.message || "Update failed")
    } finally {
      setIsSaving(false)
    }
  }

  const refresh = () => {
    if (abortRef.current) abortRef.current.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setIsRefreshing(true)
    fetchMe({ signal: ac.signal, silent: true })
  }

  const disableSave =
    isSaving ||
    isLoading ||
    !showChangePassword ||
    !hasPasswordChanges ||
    isAvatarUploading ||
    isAvatarRemoving

  const disableCancel =
    isSaving || isLoading || (!showChangePassword && !hasPasswordChanges) || isAvatarUploading || isAvatarRemoving

  const onPickAvatar = () => fileInputRef.current?.click?.()

  const onFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""

    if (!file.type?.startsWith("image/")) return showToastMsg("error", "Please select an image file.")
    if (file.size > 3 * 1024 * 1024) return showToastMsg("error", "Max file size is 3MB.")

    const localUrl = URL.createObjectURL(file)
    setAvatarPreview(localUrl)

    const fd = new FormData()
    fd.append("avatar", file)

    setIsAvatarUploading(true)
    try {
      const res = await fetch(`${API_BASE}/users/me/avatar`, {
        method: "PATCH",
        headers: getAuthHeadersMultipart(),
        credentials: "include",
        body: fd,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Avatar upload failed")

      const updated = data?.user || data?.updatedUser || null
      if (updated) {
        setUser(updated)
        localStorage.setItem("user", JSON.stringify(updated))
        setAvatarBroken(false)
      }

      showToastMsg("success", "Profile photo updated.")
      setAvatarPreview("")
    } catch (err) {
      showToastMsg("error", err?.message || "Avatar upload failed")
      setAvatarPreview("")
    } finally {
      setIsAvatarUploading(false)
    }
  }

  const removeAvatar = async () => {
    if (!user?.avatarUrl) return

    setIsAvatarRemoving(true)
    try {
      const res = await fetch(`${API_BASE}/users/me/avatar`, {
        method: "DELETE",
        headers: getAuthHeaders(),
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to remove photo")

      const updated = data?.user || null
      if (updated) {
        setUser(updated)
        localStorage.setItem("user", JSON.stringify(updated))
      } else {
        const next = { ...(user || {}), avatarUrl: "", avatarPublicId: "" }
        setUser(next)
        localStorage.setItem("user", JSON.stringify(next))
      }

      setAvatarPreview("")
      setAvatarBroken(false)
      showToastMsg("success", "Profile photo removed.")
    } catch (e) {
      showToastMsg("error", e?.message || "Failed to remove photo")
    } finally {
      setIsAvatarRemoving(false)
    }
  }

  const displayAvatar = (avatarPreview || user?.avatarUrl || "").trim()
  const showAvatar = !!displayAvatar && !avatarBroken

  // ✅ instant scroll (no delay): effect runs right after commit; rAF makes it feel immediate
  useEffect(() => {
    if (!showChangePassword) return
    if (!shouldScrollRef.current) return
    shouldScrollRef.current = false

    requestAnimationFrame(() => {
      passwordSectionRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" })
      requestAnimationFrame(() => window.scrollBy({ top: 10, left: 0, behavior: "smooth" }))
    })
  }, [showChangePassword])

  const changePwdBtnClass = showChangePassword ? "bg-indigo-700" : "bg-indigo-600 hover:bg-indigo-700"

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-gray-50 p-4 sm:p-6 lg:p-8">
      <AnimatePresence>
        {toast.message && (
          <Toast
            type={toast.type}
            message={toast.message}
            onClose={() => setToast({ type: "success", message: "" })}
          />
        )}
      </AnimatePresence>

      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
          <div className="rounded-3xl border border-gray-100 bg-white/90 backdrop-blur shadow-[0_18px_60px_-45px_rgba(0,0,0,0.55)] overflow-hidden">
            <div className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  {/* avatar in header */}
                  <div className="relative shrink-0">
                    <div className="absolute inset-0 bg-indigo-500/15 rounded-full blur-xl" />
                    <div className="relative w-14 h-14 rounded-full overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center">
                      {showAvatar ? (
                        <img
                          src={displayAvatar}
                          alt="Profile"
                          className="w-full h-full object-cover"
                          onError={() => setAvatarBroken(true)}
                          draggable={false}
                        />
                      ) : (
                        <span className="text-sm font-extrabold text-gray-700">{initials}</span>
                      )}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                      Profile Settings
                    </h1>
                    <p className="text-sm text-gray-500">Update your password & photo</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:justify-end">
                  <Badge tone="indigo">
                    <span className="inline-flex items-center gap-2">
                      <FiShield className="w-4 h-4" />
                      {role}
                    </span>
                  </Badge>

                  <button
                    onClick={refresh}
                    disabled={isLoading || isSaving || isRefreshing || isAvatarUploading || isAvatarRemoving}
                    className="h-10 inline-flex items-center gap-2 px-3.5 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60 active:scale-[0.99] transition"
                    title="Refresh"
                  >
                    <FiRefreshCcw className={cn("w-4 h-4", isRefreshing ? "animate-spin" : "")} />
                    Refresh
                  </button>
                </div>
              </div>

              {/* mini status */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
                  <p className="text-xs font-extrabold text-gray-500">Signed in as</p>
                  {isLoading ? (
                    <div className="mt-2 space-y-2">
                      <SkeletonLine w="w-40" />
                      <SkeletonLine w="w-28" />
                    </div>
                  ) : (
                    <p className="mt-1 text-sm font-extrabold text-gray-900 truncate">{profile.name || "—"}</p>
                  )}
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
                  <p className="text-xs font-extrabold text-gray-500">Email</p>
                  {isLoading ? (
                    <div className="mt-2 space-y-2">
                      <SkeletonLine w="w-44" />
                    </div>
                  ) : (
                    <p className="mt-1 text-sm font-extrabold text-gray-900 truncate">{profile.email || "—"}</p>
                  )}
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
                  <p className="text-xs font-extrabold text-gray-500">Security</p>
                  <p className="mt-1 text-sm font-extrabold text-gray-900">
                    {showChangePassword && hasPasswordChanges ? "Password changes pending" : "No password changes"}
                  </p>
                </div>
              </div>

              {/* short message (no "locked") */}
              <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3 text-sm text-indigo-700 font-semibold">
                Contact admin to change name or email.
              </div>
            </div>
          </div>
        </motion.div>

        {loadError && (
          <div className="mb-5 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
            <FiAlertCircle className="w-5 h-5 mt-0.5" />
            <span className="text-sm font-semibold">{loadError}</span>
          </div>
        )}

        {/* Content */}
        <Section
          title="Account"
          subtitle="Photo & security"
          icon={<FiLock className="w-5 h-5" />}
          right={
            <div className="flex items-center gap-2">
              {showChangePassword && hasPasswordChanges ? <Badge tone="amber">UNSAVED</Badge> : <Badge>SYNCED</Badge>}
            </div>
          }
        >
          {formError && (
            <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold">
              {formError}
            </div>
          )}

          {/* Profile photo */}
          <div className="mb-5 rounded-3xl border border-gray-100 bg-gray-50/60 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="p-[2px] rounded-full bg-indigo-600 shadow-[0_12px_26px_-18px_rgba(79,70,229,0.9)]">
                    <div className="p-[2px] rounded-full bg-white">
                      <div className="relative w-[64px] h-[64px] rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                        {showAvatar ? (
                          <img
                            src={displayAvatar}
                            alt="Profile"
                            className="w-full h-full object-cover"
                            onError={() => setAvatarBroken(true)}
                            draggable={false}
                          />
                        ) : (
                          <span className="text-lg font-extrabold text-gray-800">{initials}</span>
                        )}
                        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/10 to-black/10" />
                      </div>
                    </div>
                  </div>

                  <span
                    className="absolute bottom-0 right-0 translate-x-[2px] translate-y-[2px] w-4 h-4 rounded-full bg-emerald-500 ring-4 ring-white shadow-[0_8px_16px_-10px_rgba(16,185,129,0.95)]"
                    title="Active"
                    aria-label="Active"
                  />
                </div>

                <div>
                  <p className="text-sm font-extrabold text-gray-900">Profile photo</p>
                  <p className="text-xs text-gray-600">Upload a square image (max 3MB).</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 sm:justify-end">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

                <button
                  type="button"
                  onClick={onPickAvatar}
                  disabled={isLoading || isAvatarUploading || isAvatarRemoving}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 active:scale-[0.99] transition font-semibold"
                >
                  <FiUploadCloud className="w-4 h-4" />
                  {isAvatarUploading ? "Uploading..." : "Upload photo"}
                </button>

                <button
                  type="button"
                  onClick={removeAvatar}
                  disabled={isLoading || isAvatarUploading || isAvatarRemoving || !user?.avatarUrl}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60 active:scale-[0.99] transition font-semibold"
                  title={!user?.avatarUrl ? "No photo to remove" : "Remove photo"}
                >
                  <FiTrash2 className="w-4 h-4 text-rose-600" />
                  {isAvatarRemoving ? "Removing..." : "Remove"}
                </button>
              </div>
            </div>
          </div>

          {/* Name + Email (read-only) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Name" icon={<FiUser className="w-4 h-4" />} hint="Contact admin to change">
              {isLoading ? (
                <SkeletonInput />
              ) : (
                <input
                  value={profile.name}
                  readOnly
                  disabled
                  className="w-full px-3 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-gray-600 focus:outline-none"
                />
              )}
            </Field>

            <Field label="Email" icon={<FiMail className="w-4 h-4" />} hint="Contact admin to change">
              {isLoading ? (
                <SkeletonInput />
              ) : (
                <input
                  value={profile.email}
                  readOnly
                  disabled
                  className="w-full px-3 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-gray-600 focus:outline-none"
                  type="email"
                />
              )}
            </Field>
          </div>

          {/* ✅ Change password button (primary style + highlighted when open) */}
          <div className="mt-5 flex flex-col sm:flex-row sm:justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setFormError("")
                setShowChangePassword((prev) => {
                  const next = !prev
                  if (next) {
                    shouldScrollRef.current = true
                  } else {
                    shouldScrollRef.current = false
                    resetPasswordFields()
                  }
                  return next
                })
              }}
              disabled={isLoading || isSaving || isAvatarUploading || isAvatarRemoving}
              className={cn(
                "inline-flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-white disabled:opacity-60 active:scale-[0.99] transition font-semibold",
                changePwdBtnClass
              )}
            >
              <FiLock className="w-4 h-4" />
              {showChangePassword ? "Hide Password Fields" : "Change Password"}
              {showChangePassword ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
            </button>
          </div>

          <AnimatePresence initial={false}>
            {showChangePassword ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.16 }}
                className="overflow-hidden"
              >
                <div ref={passwordSectionRef} className="mt-4">
                  <DividerLabel label="PASSWORD" />

                 

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Current password" icon={<FiLock className="w-4 h-4" />}>
                      <div className="relative">
                        <input
                          value={pwd.currentPassword}
                          onChange={(e) => setPwd((p) => ({ ...p, currentPassword: e.target.value }))}
                          className="w-full px-3 py-3 pr-11 border border-gray-200 rounded-2xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          type={showPwd.current ? "text" : "password"}
                          placeholder="••••••••"
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPwd((s) => ({ ...s, current: !s.current }))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl hover:bg-gray-100 active:scale-95 transition"
                          aria-label={showPwd.current ? "Hide password" : "Show password"}
                          disabled={isLoading}
                        >
                          {showPwd.current ? (
                            <FiEyeOff className="w-4 h-4 text-gray-600" />
                          ) : (
                            <FiEye className="w-4 h-4 text-gray-600" />
                          )}
                        </button>
                      </div>
                    </Field>

                    <Field label="New password" icon={<FiLock className="w-4 h-4" />} hint="Minimum 6 characters">
                      <div className="relative">
                        <input
                          value={pwd.newPassword}
                          onChange={(e) => setPwd((p) => ({ ...p, newPassword: e.target.value }))}
                          className="w-full px-3 py-3 pr-11 border border-gray-200 rounded-2xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          type={showPwd.next ? "text" : "password"}
                          placeholder="••••••••"
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPwd((s) => ({ ...s, next: !s.next }))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl hover:bg-gray-100 active:scale-95 transition"
                          aria-label={showPwd.next ? "Hide password" : "Show password"}
                          disabled={isLoading}
                        >
                          {showPwd.next ? (
                            <FiEyeOff className="w-4 h-4 text-gray-600" />
                          ) : (
                            <FiEye className="w-4 h-4 text-gray-600" />
                          )}
                        </button>
                      </div>

                      <p className="mt-1.5 text-xs font-semibold text-gray-500">
                        Must be at least <span className="text-gray-700 font-extrabold">6 characters</span>.
                      </p>
                    </Field>

                    <div className="md:col-span-2">
                      <Field label="Confirm new password" icon={<FiLock className="w-4 h-4" />}>
                        <div className="relative">
                          <input
                            value={pwd.confirmPassword}
                            onChange={(e) => setPwd((p) => ({ ...p, confirmPassword: e.target.value }))}
                            className="w-full px-3 py-3 pr-11 border border-gray-200 rounded-2xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            type={showPwd.confirm ? "text" : "password"}
                            placeholder="••••••••"
                            disabled={isLoading}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPwd((s) => ({ ...s, confirm: !s.confirm }))}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl hover:bg-gray-100 active:scale-95 transition"
                            aria-label={showPwd.confirm ? "Hide password" : "Show password"}
                            disabled={isLoading}
                          >
                            {showPwd.confirm ? (
                              <FiEyeOff className="w-4 h-4 text-gray-600" />
                            ) : (
                              <FiEye className="w-4 h-4 text-gray-600" />
                            )}
                          </button>
                        </div>
                      </Field>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Actions */}
          <div className="mt-6 rounded-2xl border border-gray-100 bg-gray-50/70 p-4 flex flex-col sm:flex-row gap-2 sm:justify-end">
            <button
              onClick={revertAll}
              disabled={disableCancel || isAvatarUploading || isAvatarRemoving}
              className="px-4 py-2.5 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60 active:scale-[0.99] transition font-semibold"
            >
              Cancel
            </button>

            <button
              onClick={save}
              disabled={disableSave || isAvatarUploading || isAvatarRemoving}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 active:scale-[0.99] transition font-semibold"
            >
              <FiSave className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </Section>
      </div>
    </div>
  )
}
