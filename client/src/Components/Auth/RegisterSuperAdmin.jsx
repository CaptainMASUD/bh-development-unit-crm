"use client"

import { useEffect, useRef, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  LockPasswordIcon,
  Mail01Icon,
  SecurityCheckIcon,
  UserIcon,
  ViewIcon,
  ViewOffSlashIcon,
} from "@hugeicons/core-free-icons"
import { AnimatePresence, motion } from "framer-motion"
import { useDispatch } from "react-redux"
import { signInSuccess } from "../../Redux/UserSlice/UserSlice"
import { useNavigate, Link } from "react-router-dom"
import axios from "axios"
import { getDashboardPathForRole } from "./authRouting"
import suitelogo from "../../assets/logo/suite.png"

const ERROR_AUTO_DISMISS_MS = 6000

export default function RegisterSuperAdmin() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [superAdminKey, setSuperAdminKey] = useState("")
  const [phone, setPhone] = useState("")

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showKey, setShowKey] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [successPayload, setSuccessPayload] = useState(null)

  const requestControllerRef = useRef(null)
  const dispatch = useDispatch()
  const navigate = useNavigate()

  useEffect(() => {
    return () => {
      requestControllerRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (!errorMessage) return undefined
    const timeoutId = window.setTimeout(() => {
      setErrorMessage("")
    }, ERROR_AUTO_DISMISS_MS)
    return () => window.clearTimeout(timeoutId)
  }, [errorMessage])

  const clearError = () => {
    if (errorMessage) setErrorMessage("")
  }

  const getRegisterErrorMessage = (error) => {
    if (!axios.isAxiosError(error)) {
      return error?.message || "Registration failed. Please try again."
    }
    if (error.code === "ECONNABORTED") {
      return "The registration request timed out. Please verify your server is running."
    }
    if (error.code === "ERR_CANCELED") {
      return "The registration request was cancelled."
    }
    const status = error.response?.status
    const serverMessage = error.response?.data?.message

    if (status === 401) {
      return serverMessage || "Invalid Super Admin registration key. Check your server's SUPERADMINKEY env variable."
    }
    if (status === 409) {
      return serverMessage || "A user with this email address already exists."
    }
    if (status === 400) {
      return serverMessage || "Please verify your input fields."
    }
    if (status === 500) {
      return serverMessage || "Server configuration error. Ensure SUPERADMINKEY is set in server/.env."
    }
    return serverMessage || "Registration failed. Please try again."
  }

  const handleRegister = async (event) => {
    event.preventDefault()
    if (isSubmitting) return

    const normalizedName = name.trim()
    const normalizedEmail = email.trim().toLowerCase()
    const normalizedKey = superAdminKey.trim()

    if (!normalizedName || !normalizedEmail || !password || !normalizedKey) {
      setErrorMessage("Please fill in all required fields, including the Super Admin key.")
      return
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.")
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please re-enter your password.")
      return
    }

    const apiBaseUrl = import.meta.env.VITE_API_URL?.replace(/\/+$/, "")
    if (!apiBaseUrl) {
      setErrorMessage("API base URL is not configured. Please check VITE_API_URL.")
      return
    }

    requestControllerRef.current?.abort()
    const controller = new AbortController()
    requestControllerRef.current = controller

    setErrorMessage("")
    setIsSubmitting(true)

    try {
      const response = await axios.post(
        `${apiBaseUrl}/api/users/register-superadmin`,
        {
          name: normalizedName,
          email: normalizedEmail,
          password,
          key: normalizedKey,
          phone: phone.trim(),
        },
        {
          signal: controller.signal,
          timeout: 15000,
          headers: {
            "Content-Type": "application/json",
          },
        }
      )

      const user = response.data?.user
      const token = response.data?.token

      if (!user?.role || !token) {
        throw new Error("The server returned an invalid response structure.")
      }

      // Store in localStorage & Redux for instant login
      localStorage.setItem("token", token)
      localStorage.setItem("user", JSON.stringify(user))
      dispatch(signInSuccess(user))

      setSuccessPayload({ user, token })

      // Auto-navigate to dashboard after 1.8 seconds
      setTimeout(() => {
        const dashboardPath = getDashboardPathForRole(user.role) || "/module"
        navigate(dashboardPath, { replace: true })
      }, 1800)
    } catch (error) {
      if (controller.signal.aborted) return
      setErrorMessage(getRegisterErrorMessage(error))
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null
      }
      if (!controller.signal.aborted) {
        setIsSubmitting(false)
      }
    }
  }

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800 px-4 py-16 sm:p-6">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[15%] top-[-15%] h-[600px] w-[600px] rounded-full bg-purple-600 opacity-20 blur-[130px]" />
        <div className="absolute bottom-[-25%] right-[15%] h-[700px] w-[700px] rounded-full bg-blue-600 opacity-20 blur-[140px]" />
      </div>

      {/* Top back link */}
      <Link
        to="/login"
        aria-label="Back to Login"
        className="absolute left-4 top-4 z-30 flex items-center gap-2 rounded-full border border-gray-700/50 bg-gray-800/50 px-4 py-2 text-sm font-medium text-gray-300 backdrop-blur-sm transition-all duration-300 hover:border-gray-600 hover:bg-gray-700/60 hover:text-white sm:left-6 sm:top-6"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} size={18} strokeWidth={1.8} />
        <span>Back to Login</span>
      </Link>

      {/* Register Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative z-10 w-full max-w-lg"
      >
        <div className="absolute inset-0 -rotate-2 scale-105 transform rounded-3xl bg-gradient-to-r from-purple-600/20 via-indigo-600/20 to-blue-600/20 blur-xl" />

        <div className="relative overflow-hidden rounded-3xl border border-gray-700/50 bg-gray-900/85 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          {/* Card Header */}
          <div className="mb-6 flex flex-col items-center text-center">
            <img
              src={suitelogo}
              alt="Business Hub Suite"
              className="mb-3 h-auto w-[80px] object-contain sm:w-[90px]"
            />
            <div className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-purple-300">
              <HugeiconsIcon icon={SecurityCheckIcon} size={14} />
              Platform Super Admin Setup
            </div>
            <p className="mt-2 text-sm text-gray-400">
              Create the root Super Admin account for platform administration and development.
            </p>
          </div>

          {/* Success Screen */}
          {successPayload ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center py-8 text-center"
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                <HugeiconsIcon icon={CheckmarkCircle02Icon} size={40} strokeWidth={2} />
              </div>
              <h3 className="text-xl font-bold text-white">Super Admin Created!</h3>
              <p className="mt-2 text-sm text-gray-300">
                Welcome, <span className="font-semibold text-purple-300">{successPayload.user?.name}</span>. You have been authenticated with root platform privileges.
              </p>
              <div className="mt-6 flex items-center gap-2 text-xs text-gray-400">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
                Redirecting to dashboard...
              </div>
              <button
                type="button"
                onClick={() => navigate("/module", { replace: true })}
                className="mt-6 rounded-xl bg-purple-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-purple-500"
              >
                Go to Modules Now
              </button>
            </motion.div>
          ) : (
            <>
              {/* Error Message */}
              <AnimatePresence mode="wait">
                {errorMessage && (
                  <motion.div
                    key={errorMessage}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    role="alert"
                    className="mb-5 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-sm text-red-400"
                  >
                    <span className="min-w-0 flex-1">{errorMessage}</span>
                    <button
                      type="button"
                      onClick={clearError}
                      className="text-red-300 hover:text-red-100"
                      aria-label="Dismiss error"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Dev notice */}
              <div className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-300/90 leading-relaxed">
                <span className="font-bold text-amber-200">Dev Security Notice:</span> Registration requires the matching <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-amber-200">SUPERADMINKEY</code> configured in your <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-amber-200">server/.env</code> file.
              </div>

              {/* Registration Form */}
              <form onSubmit={handleRegister} className="space-y-4">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="block pl-1 text-xs font-semibold uppercase tracking-wider text-gray-300">
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                      <HugeiconsIcon icon={UserIcon} size={18} className="text-gray-400 group-focus-within:text-purple-400" />
                    </div>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => { setName(e.target.value); clearError(); }}
                      placeholder="e.g. System Administrator"
                      className="w-full rounded-xl border border-gray-700 bg-gray-800/60 py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 transition focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      required
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="block pl-1 text-xs font-semibold uppercase tracking-wider text-gray-300">
                    Super Admin Email <span className="text-red-400">*</span>
                  </label>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                      <HugeiconsIcon icon={Mail01Icon} size={18} className="text-gray-400 group-focus-within:text-purple-400" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); clearError(); }}
                      placeholder="superadmin@businesshub.com"
                      className="w-full rounded-xl border border-gray-700 bg-gray-800/60 py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 transition focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      required
                    />
                  </div>
                </div>

                {/* Password & Confirm Grid */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Password */}
                  <div className="space-y-1.5">
                    <label className="block pl-1 text-xs font-semibold uppercase tracking-wider text-gray-300">
                      Password <span className="text-red-400">*</span>
                    </label>
                    <div className="group relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                        <HugeiconsIcon icon={LockPasswordIcon} size={18} className="text-gray-400 group-focus-within:text-purple-400" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); clearError(); }}
                        placeholder="••••••••"
                        className="w-full rounded-xl border border-gray-700 bg-gray-800/60 py-2.5 pl-10 pr-10 text-sm text-white placeholder-gray-500 transition focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-gray-400 hover:text-gray-200"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        <HugeiconsIcon icon={showPassword ? ViewOffSlashIcon : ViewIcon} size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1.5">
                    <label className="block pl-1 text-xs font-semibold uppercase tracking-wider text-gray-300">
                      Confirm Password <span className="text-red-400">*</span>
                    </label>
                    <div className="group relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                        <HugeiconsIcon icon={LockPasswordIcon} size={18} className="text-gray-400 group-focus-within:text-purple-400" />
                      </div>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => { setConfirmPassword(e.target.value); clearError(); }}
                        placeholder="••••••••"
                        className="w-full rounded-xl border border-gray-700 bg-gray-800/60 py-2.5 pl-10 pr-10 text-sm text-white placeholder-gray-500 transition focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-gray-400 hover:text-gray-200"
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        <HugeiconsIcon icon={showConfirmPassword ? ViewOffSlashIcon : ViewIcon} size={18} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Super Admin Secret Key */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between pl-1">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-amber-300">
                      Super Admin Key (SUPERADMINKEY) <span className="text-red-400">*</span>
                    </label>
                    <span className="text-[11px] text-gray-400 font-mono">From server/.env</span>
                  </div>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                      <HugeiconsIcon icon={SecurityCheckIcon} size={18} className="text-amber-400 group-focus-within:text-amber-300" />
                    </div>
                    <input
                      type={showKey ? "text" : "password"}
                      value={superAdminKey}
                      onChange={(e) => { setSuperAdminKey(e.target.value); clearError(); }}
                      placeholder="Enter the secret SUPERADMINKEY"
                      className="w-full rounded-xl border border-amber-500/40 bg-gray-800/60 py-2.5 pl-10 pr-10 text-sm text-white placeholder-gray-500 transition focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-gray-400 hover:text-gray-200"
                      aria-label={showKey ? "Hide key" : "Show key"}
                    >
                      <HugeiconsIcon icon={showKey ? ViewOffSlashIcon : ViewIcon} size={18} />
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-2 flex w-full cursor-pointer items-center justify-center rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-600/25 transition-all duration-200 hover:-translate-y-0.5 hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Verifying & Registering...
                    </span>
                  ) : (
                    "Register Super Admin Account"
                  )}
                </button>
              </form>

              {/* Footer */}
              <div className="mt-6 border-t border-gray-800 pt-4 text-center">
                <p className="text-xs text-gray-400">
                  Already have a Super Admin or User account?{" "}
                  <Link to="/login" className="font-semibold text-purple-400 hover:text-purple-300">
                    Sign In
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </main>
  )
}
