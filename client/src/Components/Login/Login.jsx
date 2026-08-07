"use client"

import { useEffect, useRef, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Cancel01Icon,
  CustomerSupportIcon,
  Globe02Icon,
  LockPasswordIcon,
  Mail01Icon,
  ViewIcon,
  ViewOffSlashIcon,
  WhatsappIcon,
} from "@hugeicons/core-free-icons"
import { AnimatePresence, motion } from "framer-motion"
import { useDispatch, useSelector } from "react-redux"
import {
  signInSuccess,
  signOut,
} from "../../Redux/UserSlice/UserSlice"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import {
  getDashboardPathForRole,
  getJwtExpirationMs,
} from "../Auth/authRouting"

import suitelogo from "../../assets/logo/suite.png"

const ERROR_AUTO_DISMISS_MS = 5000

export default function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const requestControllerRef = useRef(null)

  const dispatch = useDispatch()
  const navigate = useNavigate()

  const currentUser = useSelector(
    (state) => state.user.currentUser,
  )

  useEffect(() => {
    if (!currentUser?.isActive) return

    const token = localStorage.getItem("token")
    const expiresAt = getJwtExpirationMs(token)

    const tokenIsValid =
      Boolean(token) &&
      (expiresAt === null || expiresAt > Date.now())

    if (!tokenIsValid) {
      localStorage.removeItem("token")
      localStorage.removeItem("user")

      dispatch(signOut())
      return
    }

    const dashboardPath = getDashboardPathForRole(
      currentUser.role,
    )

    if (dashboardPath) {
      navigate(dashboardPath, {
        replace: true,
      })
    }
  }, [currentUser, dispatch, navigate])

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

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [errorMessage])

  useEffect(() => {
    if (!showSupportModal) return undefined

    const previousOverflow = document.body.style.overflow

    document.body.style.overflow = "hidden"

    const handleEscapeKey = (event) => {
      if (event.key === "Escape") {
        setShowSupportModal(false)
      }
    }

    window.addEventListener("keydown", handleEscapeKey)

    return () => {
      document.body.style.overflow = previousOverflow

      window.removeEventListener(
        "keydown",
        handleEscapeKey,
      )
    }
  }, [showSupportModal])

  const clearError = () => {
    if (errorMessage) {
      setErrorMessage("")
    }
  }

  const handleEmailChange = (event) => {
    setEmail(event.target.value)
    clearError()
  }

  const handlePasswordChange = (event) => {
    setPassword(event.target.value)
    clearError()
  }

  const getLoginErrorMessage = (error) => {
    if (!axios.isAxiosError(error)) {
      return (
        error?.message ||
        "Login failed. Please try again."
      )
    }

    if (error.code === "ECONNABORTED") {
      return "The login request timed out. Please check your connection and try again."
    }

    if (error.code === "ERR_CANCELED") {
      return "The login request was cancelled. Please try again."
    }

    const status = error.response?.status
    const serverMessage = error.response?.data?.message

    if (status === 401) {
      return serverMessage || "Invalid email or password."
    }

    if (status === 403) {
      return (
        serverMessage ||
        "Your account does not have permission to sign in."
      )
    }

    if (status === 429) {
      return "Too many login attempts. Please wait a moment and try again."
    }

    if (!error.response) {
      return "Unable to reach the server. Please check your internet connection and try again."
    }

    return (
      serverMessage ||
      "Login failed. Please try again."
    )
  }

  const handleLogin = async (event) => {
    event.preventDefault()

    if (isSubmitting) return

    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail || !password) {
      setErrorMessage(
        "Please enter both your email and password.",
      )
      return
    }

    const apiBaseUrl = import.meta.env.VITE_API_URL?.replace(
      /\/+$/,
      "",
    )

    if (!apiBaseUrl) {
      setErrorMessage(
        "Login service is not configured. Please contact support.",
      )
      return
    }

    requestControllerRef.current?.abort()

    const controller = new AbortController()
    requestControllerRef.current = controller

    setErrorMessage("")
    setIsSubmitting(true)

    try {
      const response = await axios.post(
        `${apiBaseUrl}/api/users/login`,
        {
          email: normalizedEmail,
          password,
        },
        {
          signal: controller.signal,
          timeout: 15000,
          headers: {
            "Content-Type": "application/json",
          },
        },
      )

      const user = response.data?.user
      const token = response.data?.token

      if (response.status !== 200 || !user?.role || !token) {
        throw new Error(
          "The server returned an invalid login response.",
        )
      }

      if (!user.isActive) {
        throw new Error(
          "User account is inactive. Please contact admin.",
        )
      }

      const dashboardPath = getDashboardPathForRole(
        user.role,
      )

      if (!dashboardPath) {
        throw new Error(
          "Invalid role received from server.",
        )
      }

      localStorage.setItem("token", token)
      localStorage.setItem("user", JSON.stringify(user))

      dispatch(signInSuccess(user))

      navigate(dashboardPath, {
        replace: true,
      })
    } catch (error) {
      if (controller.signal.aborted) return

      localStorage.removeItem("token")
      localStorage.removeItem("user")

      setErrorMessage(getLoginErrorMessage(error))
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
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800 px-4 py-20 sm:p-6">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[20%] top-[-20%] h-[600px] w-[600px] rounded-full bg-purple-600 opacity-20 blur-[120px]" />

        <div className="absolute bottom-[-30%] right-[20%] h-[700px] w-[700px] rounded-full bg-blue-600 opacity-20 blur-[140px]" />
      </div>

      {/* Support button */}
      <button
        type="button"
        onClick={() => setShowSupportModal(true)}
        aria-label="Open Business Hub Suite support"
        aria-expanded={showSupportModal}
        className="absolute right-4 top-4 z-30 flex cursor-pointer items-center gap-2 rounded-full border border-gray-700/50 bg-gray-800/50 px-4 py-2 text-gray-300 backdrop-blur-sm transition-all duration-300 hover:border-gray-600/60 hover:bg-gray-700/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 sm:right-6 sm:top-6"
      >
        <HugeiconsIcon
          icon={CustomerSupportIcon}
          size={19}
          strokeWidth={1.8}
        />

        <span className="text-sm font-medium">
          Support
        </span>
      </button>

      {/* Support modal */}
      <AnimatePresence>
        {showSupportModal && (
          <motion.div
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setShowSupportModal(false)
              }
            }}
          >
            <motion.div
              initial={{
                opacity: 0,
                y: 24,
                scale: 0.96,
              }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
              }}
              exit={{
                opacity: 0,
                y: 18,
                scale: 0.96,
              }}
              transition={{
                duration: 0.2,
                ease: "easeOut",
              }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="support-modal-title"
              className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-gray-700/50 bg-gray-900/95 p-6 text-white shadow-2xl backdrop-blur-xl sm:rounded-2xl sm:p-8"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              {/* Close button */}
              <button
                type="button"
                onClick={() =>
                  setShowSupportModal(false)
                }
                aria-label="Close support modal"
                className="absolute right-4 top-4 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              >
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  size={22}
                  strokeWidth={1.8}
                />
              </button>

              {/* Support header */}
              <div className="mb-6 flex items-center gap-3 pr-10">
                <div className="rounded-full bg-purple-500/20 p-3">
                  <HugeiconsIcon
                    icon={CustomerSupportIcon}
                    size={28}
                    strokeWidth={1.8}
                    className="text-purple-400"
                  />
                </div>

                <h2
                  id="support-modal-title"
                  className="text-xl font-bold text-white sm:text-2xl"
                >
                  Business Hub SUITE Support
                </h2>
              </div>

              <p className="mb-6 text-sm leading-6 text-gray-300 sm:text-base">
                Need help? Contact the Business Hub BD
                support team through any channel below.
              </p>

              <div className="space-y-4">
                {/* Website */}
                <a
                  href="https://businesshubbd.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Visit Business Hub BD website"
                  className="group flex cursor-pointer items-center gap-3 rounded-lg border border-gray-700/50 bg-gray-800/50 p-3 transition-all duration-300 hover:border-blue-500/30 hover:bg-blue-500/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
                    <HugeiconsIcon
                      icon={Globe02Icon}
                      size={21}
                      strokeWidth={1.8}
                      className="text-blue-400"
                    />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm text-gray-400">
                      Website
                    </p>

                    <p className="truncate text-sm font-medium text-blue-400 transition-colors group-hover:text-blue-300 sm:text-base">
                      businesshubbd.com
                    </p>
                  </div>
                </a>

                {/* Email */}
                <a
                  href="mailto:info@businesshubbd.com"
                  aria-label="Email Business Hub BD support"
                  className="group flex cursor-pointer items-center gap-3 rounded-lg border border-gray-700/50 bg-gray-800/50 p-3 transition-all duration-300 hover:border-emerald-500/30 hover:bg-emerald-500/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
                    <HugeiconsIcon
                      icon={Mail01Icon}
                      size={21}
                      strokeWidth={1.8}
                      className="text-emerald-400"
                    />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm text-gray-400">
                      Email
                    </p>

                    <p className="truncate text-sm font-medium text-emerald-400 transition-colors group-hover:text-emerald-300 sm:text-base">
                      info@businesshubbd.com
                    </p>
                  </div>
                </a>

                {/* WhatsApp */}
                <a
                  href="https://wa.me/8801712244886"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Chat with Business Hub BD on WhatsApp"
                  className="group flex cursor-pointer items-center gap-3 rounded-lg border border-gray-700/50 bg-gray-800/50 p-3 transition-all duration-300 hover:border-[#25D366]/40 hover:bg-[#25D366]/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#25D366]/10 transition-colors group-hover:bg-[#25D366]/15">
                    <HugeiconsIcon
                      icon={WhatsappIcon}
                      size={22}
                      strokeWidth={1.8}
                      className="text-[#25D366]"
                    />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm text-gray-400">
                      WhatsApp
                    </p>

                    <p className="truncate text-sm font-medium text-[#25D366] transition-colors group-hover:text-[#46e27c] sm:text-base">
                      +880 1712-244886
                    </p>
                  </div>
                </a>
              </div>

              {/* Support availability */}
              <div className="mt-6 border-t border-gray-700/50 pt-4 text-center">
                <span className="inline-flex rounded-full bg-yellow-500/10 px-4 py-1.5 text-sm font-medium text-yellow-400">
                  24/7 Support
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Login card */}
      <motion.div
        initial={{
          opacity: 0,
          y: 16,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          duration: 0.4,
          ease: "easeOut",
        }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="absolute inset-0 -rotate-3 scale-105 transform rounded-2xl bg-gradient-to-r from-purple-600/20 to-blue-600/20 blur-xl" />

        <div className="relative overflow-hidden rounded-2xl border border-gray-700/50 bg-gray-900/80 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          {/* Login header */}
          <div className="mb-7 flex flex-col items-center">
            <img
              src={suitelogo}
              alt="Business Hub Suite"
              className="mb-3 h-auto w-[76px] object-contain sm:w-[84px]"
            />

            <p className="mt-1 text-center text-gray-400">
              Sign in to your account
            </p>
          </div>

          {/* Error message */}
          <AnimatePresence mode="wait">
            {errorMessage && (
              <motion.div
                key={errorMessage}
                initial={{
                  opacity: 0,
                  y: -6,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  y: -6,
                }}
                transition={{
                  duration: 0.2,
                  ease: "easeOut",
                }}
                role="alert"
                aria-live="assertive"
                className="mb-6 flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"
              >
                <span className="min-w-0 flex-1">
                  {errorMessage}
                </span>

                <button
                  type="button"
                  onClick={clearError}
                  aria-label="Dismiss login error"
                  className="-mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-red-300/80 transition-colors hover:bg-red-500/10 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                >
                  <HugeiconsIcon
                    icon={Cancel01Icon}
                    size={16}
                    strokeWidth={2}
                  />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Login form */}
          <form
            onSubmit={handleLogin}
            className="space-y-5"
          >
            {/* Email */}
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block pl-1 text-sm font-medium text-gray-300"
              >
                Email
              </label>

              <div className="group relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <HugeiconsIcon
                    icon={Mail01Icon}
                    size={19}
                    strokeWidth={1.8}
                    className="text-gray-400 transition-colors group-focus-within:text-purple-400"
                  />
                </div>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  autoComplete="email"
                  inputMode="email"
                  className="w-full rounded-lg border border-gray-700 bg-gray-800/50 py-3 pl-10 pr-4 text-white placeholder-gray-500 transition-all duration-300 hover:border-gray-600 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block pl-1 text-sm font-medium text-gray-300"
              >
                Password
              </label>

              <div className="group relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <HugeiconsIcon
                    icon={LockPasswordIcon}
                    size={19}
                    strokeWidth={1.8}
                    className="text-gray-400 transition-colors group-focus-within:text-purple-400"
                  />
                </div>

                <input
                  id="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={password}
                  onChange={handlePasswordChange}
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-gray-700 bg-gray-800/50 py-3 pl-10 pr-11 text-white placeholder-gray-500 transition-all duration-300 hover:border-gray-600 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter your password"
                  required
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      (previousValue) =>
                        !previousValue,
                    )
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center text-gray-400 transition-colors hover:text-gray-200 focus-visible:outline-none focus-visible:text-purple-400"
                >
                  <HugeiconsIcon
                    icon={
                      showPassword
                        ? ViewOffSlashIcon
                        : ViewIcon
                    }
                    size={20}
                    strokeWidth={1.8}
                  />
                </button>
              </div>
            </div>

            {/* Sign-in button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full cursor-pointer items-center justify-center rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-purple-600/20 transition-all duration-300 hover:-translate-y-0.5 hover:from-purple-700 hover:to-blue-700 hover:shadow-purple-600/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {isSubmitting ? (
                <span
                  aria-hidden="true"
                  className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"
                />
              ) : (
                "Sign In"
              )}
              <span className="sr-only" aria-live="polite">
                {isSubmitting ? "Signing in" : ""}
              </span>
            </button>
          </form>

          {/* Copyright */}
          <div className="mt-8 border-t border-gray-800 pt-4 text-center text-xs text-gray-400">
            &copy; {new Date().getFullYear()} Business
            Hub SUITE. All rights reserved.
          </div>
        </div>
      </motion.div>
    </main>
  )
}