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
} from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`;

const card =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_28px_-16px_rgba(0,0,0,0.22)]"

function getAuthHeaders() {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function Toast({ type = "success", message, onClose }) {
  if (!message) return null
  const styles =
    type === "error"
      ? "bg-red-50 border-red-200 text-red-700"
      : "bg-green-50 border-green-200 text-green-700"
  const Icon = type === "error" ? FiAlertCircle : FiCheckCircle

  return (
    <div className="fixed top-4 right-4 z-[60] max-w-sm w-[92vw] sm:w-auto">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className={`rounded-2xl border p-3 shadow-lg ${styles}`}
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

function Field({ label, icon, hint, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-semibold text-gray-800">{label}</label>
        {hint ? <span className="text-xs text-gray-500">{hint}</span> : null}
      </div>
      <div className="relative">
        {icon ? (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-600">
            {icon}
          </span>
        ) : null}
        <div className={icon ? "pl-10" : ""}>{children}</div>
      </div>
    </div>
  )
}

function SkeletonLine({ w = "w-40" }) {
  return <div className={`h-3 ${w} bg-gray-200 rounded animate-pulse`} />
}

function SkeletonInput() {
  return <div className="h-[42px] w-full bg-gray-200 rounded-xl animate-pulse" />
}

export default function ProfileSettingsEmployee() {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [toast, setToast] = useState({ type: "success", message: "" })
  const toastTimer = useRef(null)

  const [profile, setProfile] = useState({ name: "", email: "" })
  const [pwd, setPwd] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [showPwd, setShowPwd] = useState({ current: false, next: false, confirm: false })
  const [formError, setFormError] = useState("")
  const [loadError, setLoadError] = useState("")

  const abortRef = useRef(null)

  const showToast = (type, message) => {
    setToast({ type, message })
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(
      () => setToast({ type: "success", message: "" }),
      2200
    )
  }

  const hydrateFromStorage = () => {
    try {
      const stored = localStorage.getItem("user")
      const u = stored ? JSON.parse(stored) : null
      if (u) {
        setUser(u)
        setProfile({ name: u?.name || "", email: u?.email || "" })
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
        signal,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to load profile")

      const u = data?.user
      setUser(u)
      setProfile({ name: u?.name || "", email: u?.email || "" })
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

  // 1) show cached user immediately
  // 2) fetch server
  useEffect(() => {
    hydrateFromStorage()
    const ac = new AbortController()
    abortRef.current = ac
    fetchMe({ signal: ac.signal, silent: false })
    return () => ac.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const role = useMemo(() => String(user?.role || "—"), [user])
  const isEmployee = useMemo(() => String(user?.role || "").toLowerCase() === "employee", [user])

  const hasPasswordChanges = useMemo(() => {
    return !!pwd.currentPassword || !!pwd.newPassword || !!pwd.confirmPassword
  }, [pwd])

  // Employee UX: email is read-only (managed by admin), name editable.
  const hasProfileChanges = useMemo(() => {
    const nameChanged = (profile.name || "") !== (user?.name || "")
    const emailChanged = (profile.email || "") !== (user?.email || "")
    return isEmployee ? nameChanged : nameChanged || emailChanged
  }, [profile, user, isEmployee])

  const resetPasswordFields = () => {
    setPwd({ currentPassword: "", newPassword: "", confirmPassword: "" })
    setShowPwd({ current: false, next: false, confirm: false })
  }

  const revertAll = () => {
    setFormError("")
    setProfile({ name: user?.name || "", email: user?.email || "" })
    resetPasswordFields()
  }

  const validate = () => {
    const name = String(profile.name || "").trim()
    const email = String(profile.email || "").trim()

    // Only validate profile fields if they’re being changed
    if (hasProfileChanges) {
      if (!name) return "Name is required."
      if (!isEmployee && !email) return "Email is required."
    }

    if (hasPasswordChanges) {
      if (!pwd.currentPassword) return "Current password is required."
      if (!pwd.newPassword) return "New password is required."
      if (pwd.newPassword.length < 6) return "New password must be at least 6 characters."
      if (pwd.newPassword !== pwd.confirmPassword) return "Passwords do not match."
    }

    return ""
  }

  const save = async () => {
    const err = validate()
    if (err) return setFormError(err)

    const payload = {}

    const name = String(profile.name || "").trim()
    const email = String(profile.email || "").trim()

    // Employee: only allow updating name (and password). Email stays read-only.
    if (name && name !== (user?.name || "")) payload.name = name
    if (!isEmployee && email && email !== (user?.email || "")) payload.email = email

    if (hasPasswordChanges) {
      payload.currentPassword = pwd.currentPassword
      payload.newPassword = pwd.newPassword
    }

    if (Object.keys(payload).length === 0) {
      showToast("success", "Nothing to update.")
      return
    }

    setIsSaving(true)
    setFormError("")
    try {
      const res = await fetch(`${API_BASE}/users/me`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Update failed")

      const updated = data?.user || null
      if (updated) {
        setUser(updated)
        setProfile({ name: updated?.name || "", email: updated?.email || "" })
        localStorage.setItem("user", JSON.stringify(updated))
      }

      if (hasPasswordChanges) resetPasswordFields()

      // background refresh (no flicker)
      const ac = new AbortController()
      fetchMe({ signal: ac.signal, silent: true })

      showToast("success", "Profile updated.")
    } catch (e) {
      showToast("error", e?.message || "Update failed")
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

  const disableSave = isSaving || isLoading || (!hasProfileChanges && !hasPasswordChanges)
  const disableCancel = isSaving || isLoading || (!hasProfileChanges && !hasPasswordChanges)

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <AnimatePresence>
        {toast.message && (
          <Toast
            type={toast.type}
            message={toast.message}
            onClose={() => setToast({ type: "success", message: "" })}
          />
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className={`${card} p-6`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative shrink-0">
                <div className="absolute inset-0 bg-indigo-500/20 rounded-2xl blur-lg" />
                <div className="relative bg-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm">
                  <FiUser className="w-6 h-6" />
                </div>
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                  Profile Settings
                </h1>
                <p className="text-sm text-gray-500">
                  {isEmployee
                    ? "Update your name & password (email is managed by admin)"
                    : "Update your account details"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:justify-end">
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10 px-3 py-1.5 text-xs font-semibold">
                <FiShield className="w-4 h-4" />
                {role}
              </div>

              <button
                onClick={refresh}
                disabled={isLoading || isSaving || isRefreshing}
                className="h-9 inline-flex items-center gap-2 px-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60"
                title="Refresh"
              >
                <FiRefreshCcw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {loadError && (
        <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-2">
          <FiAlertCircle className="w-5 h-5 mt-0.5" />
          <span className="text-sm font-semibold">{loadError}</span>
        </div>
      )}

      <div className={`${card} overflow-hidden`}>
        <div className="p-6 border-b border-gray-100 bg-white">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">Account</h2>
              <p className="text-sm text-gray-500 mt-1">Name, email & password</p>
            </div>

            <div className="text-right min-w-[10rem]">
              <p className="text-xs text-gray-500">Signed in</p>
              {isLoading ? (
                <div className="mt-1 flex flex-col items-end gap-2">
                  <SkeletonLine w="w-40" />
                  <SkeletonLine w="w-28" />
                </div>
              ) : (
                <p className="text-sm font-semibold text-gray-900 truncate max-w-[18rem]">
                  {user?.name || user?.email || "—"}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 bg-white">
          {formError && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Name" icon={<FiUser className="w-4 h-4" />}>
              {isLoading ? (
                <SkeletonInput />
              ) : (
                <input
                  value={profile.name}
                  onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Your name"
                />
              )}
            </Field>

            <Field
              label="Email"
              icon={<FiMail className="w-4 h-4" />}
              hint={isEmployee ? "Managed by admin" : ""}
            >
              {isLoading ? (
                <SkeletonInput />
              ) : (
                <input
                  value={profile.email}
                  onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                  className={[
                    "w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent",
                    isEmployee ? "opacity-70 cursor-not-allowed bg-gray-50" : "",
                  ].join(" ")}
                  placeholder="email@example.com"
                  type="email"
                  disabled={isEmployee}
                />
              )}
            </Field>
          </div>

          <div className="my-6 border-t border-gray-100" />

          <h3 className="text-sm font-extrabold text-gray-900 mb-3">Change Password</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Current password" icon={<FiLock className="w-4 h-4" />}>
              <div className="relative">
                <input
                  value={pwd.currentPassword}
                  onChange={(e) => setPwd((p) => ({ ...p, currentPassword: e.target.value }))}
                  className="w-full px-3 py-2.5 pr-11 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  type={showPwd.current ? "text" : "password"}
                  placeholder="••••••••"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => ({ ...s, current: !s.current }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-100 active:scale-95 transition"
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

            <Field label="New password" icon={<FiLock className="w-4 h-4" />} hint="min 6 chars">
              <div className="relative">
                <input
                  value={pwd.newPassword}
                  onChange={(e) => setPwd((p) => ({ ...p, newPassword: e.target.value }))}
                  className="w-full px-3 py-2.5 pr-11 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  type={showPwd.next ? "text" : "password"}
                  placeholder="••••••••"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => ({ ...s, next: !s.next }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-100 active:scale-95 transition"
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
            </Field>

            <div className="md:col-span-2">
              <Field label="Confirm new password" icon={<FiLock className="w-4 h-4" />}>
                <div className="relative">
                  <input
                    value={pwd.confirmPassword}
                    onChange={(e) => setPwd((p) => ({ ...p, confirmPassword: e.target.value }))}
                    className="w-full px-3 py-2.5 pr-11 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    type={showPwd.confirm ? "text" : "password"}
                    placeholder="••••••••"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((s) => ({ ...s, confirm: !s.confirm }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-100 active:scale-95 transition"
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

        {/* Actions area */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button
            onClick={revertAll}
            disabled={disableCancel}
            className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60 active:scale-[0.99] transition"
          >
            Cancel
          </button>

          <button
            onClick={save}
            disabled={disableSave}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 active:scale-[0.99] transition"
          >
            <FiSave className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}
