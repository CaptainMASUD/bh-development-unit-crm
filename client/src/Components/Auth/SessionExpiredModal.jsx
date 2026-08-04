import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useDispatch, useSelector } from "react-redux"
import { useNavigate } from "react-router-dom"
import { FiClock, FiLogOut } from "react-icons/fi"
import { signOut } from "../../Redux/UserSlice/UserSlice"
import { getJwtExpirationMs } from "./authRouting"
import { SESSION_EXPIRED_EVENT } from "./sessionEvents"

const WARNING_SECONDS = 5 * 60
const WARNING_MS = WARNING_SECONDS * 1000

function formatRemaining(totalSeconds) {
  const seconds = Math.max(Number(totalSeconds || 0), 0)
  const minutesPart = Math.floor(seconds / 60)
  const secondsPart = seconds % 60
  return `${String(minutesPart).padStart(2, "0")}:${String(secondsPart).padStart(2, "0")}`
}

function SessionExpiryWarning({ seconds, onLogout }) {
  if (seconds === null || typeof document === "undefined") return null

  const progress = Math.max(Math.min((seconds / WARNING_SECONDS) * 100, 100), 0)

  return createPortal(
    <aside
      className="fixed right-4 top-4 z-[10000] w-[calc(100%-2rem)] max-w-sm overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-[0_24px_65px_-24px_rgba(15,23,42,0.55)] sm:right-6 sm:top-6"
      role="status"
      aria-live="assertive"
      aria-label={`Session expires in ${formatRemaining(seconds)}`}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
          <FiClock className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">Session ending soon</p>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <p className="text-sm font-bold text-gray-700">Automatic logout in</p>
            <time className="font-mono text-xl font-black tabular-nums text-gray-950">{formatRemaining(seconds)}</time>
          </div>
          <p className="mt-1 text-xs font-semibold leading-5 text-gray-500">Save your work before the countdown reaches zero.</p>
          <button
            type="button"
            onClick={onLogout}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-black text-rose-600 transition hover:text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30"
          >
            <FiLogOut className="h-3.5 w-3.5" />
            Log out now
          </button>
        </div>
      </div>
      <div className="h-1.5 bg-amber-100">
        <div className="h-full bg-amber-500 transition-[width] duration-1000 ease-linear" style={{ width: `${progress}%` }} />
      </div>
    </aside>,
    document.body
  )
}

export default function SessionExpiryGuard() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const currentUser = useSelector((state) => state.user?.currentUser)
  const [warningExpiresAt, setWarningExpiresAt] = useState(null)
  const [remainingSeconds, setRemainingSeconds] = useState(null)
  const redirectedRef = useRef(false)

  const goToLogin = useCallback(() => {
    if (redirectedRef.current) return
    redirectedRef.current = true
    setWarningExpiresAt(null)
    setRemainingSeconds(null)
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    dispatch(signOut())
    navigate("/login", { replace: true })
  }, [dispatch, navigate])

  useEffect(() => {
    if (currentUser) redirectedRef.current = false
  }, [currentUser])

  useEffect(() => {
    if (!currentUser) {
      setWarningExpiresAt(null)
      setRemainingSeconds(null)
      return undefined
    }

    let warningTimeoutId = null
    let expirationTimeoutId = null

    const clearTimers = () => {
      if (warningTimeoutId) window.clearTimeout(warningTimeoutId)
      if (expirationTimeoutId) window.clearTimeout(expirationTimeoutId)
      warningTimeoutId = null
      expirationTimeoutId = null
    }

    const scheduleExpiration = () => {
      clearTimers()
      const token = localStorage.getItem("token")
      const expiresAt = getJwtExpirationMs(token)

      if (!token) {
        goToLogin()
        return
      }

      if (!expiresAt) {
        setWarningExpiresAt(null)
        setRemainingSeconds(null)
        return
      }

      const remainingMs = expiresAt - Date.now()
      if (remainingMs <= 0) {
        goToLogin()
        return
      }

      const showWarning = () => setWarningExpiresAt(expiresAt)
      if (remainingMs <= WARNING_MS) showWarning()
      else warningTimeoutId = window.setTimeout(showWarning, remainingMs - WARNING_MS)

      expirationTimeoutId = window.setTimeout(goToLogin, remainingMs)
    }

    const handleVisibility = () => {
      if (document.visibilityState === "visible") scheduleExpiration()
    }
    const handleStorage = (event) => {
      if (event.key === "token") scheduleExpiration()
    }
    const handleExpiredResponse = () => goToLogin()

    scheduleExpiration()
    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("storage", handleStorage)
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpiredResponse)

    return () => {
      clearTimers()
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpiredResponse)
    }
  }, [currentUser, goToLogin])

  useEffect(() => {
    if (!warningExpiresAt) return undefined

    const updateCountdown = () => {
      const seconds = Math.max(Math.ceil((warningExpiresAt - Date.now()) / 1000), 0)
      setRemainingSeconds(seconds)
      if (seconds <= 0) goToLogin()
    }

    updateCountdown()
    const countdownId = window.setInterval(updateCountdown, 1000)
    return () => window.clearInterval(countdownId)
  }, [warningExpiresAt, goToLogin])

  return <SessionExpiryWarning seconds={remainingSeconds} onLogout={goToLogin} />
}
