import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useDispatch, useSelector } from "react-redux"
import { useNavigate } from "react-router-dom"
import { FiClock, FiLogIn } from "react-icons/fi"
import { signOut } from "../../Redux/UserSlice/UserSlice"
import { getJwtExpirationMs } from "./authRouting"
import { SESSION_EXPIRED_EVENT } from "./sessionEvents"

function SessionExpiredModal({ open, onLogin, seconds }) {
  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="session-expired-title">
      <div className="w-full max-w-md rounded-3xl border border-white/70 bg-white p-6 text-center shadow-[0_30px_90px_-30px_rgba(15,23,42,0.65)] sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
          <FiClock className="h-7 w-7" />
        </div>
        <h2 id="session-expired-title" className="mt-5 text-2xl font-black tracking-tight text-gray-950">Session expired</h2>
        <p className="mt-2 text-sm font-medium leading-6 text-gray-600">
          Your login session has ended. Please sign in again to continue securely.
        </p>
        <button
          type="button"
          onClick={onLogin}
          className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
        >
          <FiLogIn className="h-4 w-4" />
          Go to login
        </button>
        <p className="mt-3 text-xs font-semibold text-gray-400">Redirecting automatically in {seconds}s</p>
      </div>
    </div>,
    document.body
  )
}

export default function SessionExpiryGuard() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const currentUser = useSelector((state) => state.user?.currentUser)
  const [expired, setExpired] = useState(false)
  const [seconds, setSeconds] = useState(4)
  const redirectedRef = useRef(false)

  const goToLogin = useCallback(() => {
    if (redirectedRef.current) return
    redirectedRef.current = true
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    dispatch(signOut())
    navigate("/login", { replace: true })
  }, [dispatch, navigate])

  useEffect(() => {
    if (!currentUser) return

    const checkExpiration = () => {
      const token = localStorage.getItem("token")
      const expiresAt = getJwtExpirationMs(token)

      if (!token || (expiresAt !== null && expiresAt <= Date.now())) {
        setExpired(true)
        return true
      }

      return false
    }

    if (checkExpiration()) return

    const token = localStorage.getItem("token")
    const expiresAt = getJwtExpirationMs(token)
    const timeoutId = expiresAt
      ? window.setTimeout(() => setExpired(true), Math.max(expiresAt - Date.now(), 0))
      : null

    const handleVisibility = () => {
      if (document.visibilityState === "visible") checkExpiration()
    }
    const handleStorage = (event) => {
      if (event.key === "token") checkExpiration()
    }
    const handleExpiredResponse = () => setExpired(true)

    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("storage", handleStorage)
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpiredResponse)

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId)
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpiredResponse)
    }
  }, [currentUser])

  useEffect(() => {
    if (!expired) return

    setSeconds(4)
    const countdownId = window.setInterval(() => {
      setSeconds((value) => Math.max(value - 1, 0))
    }, 1000)
    const redirectId = window.setTimeout(goToLogin, 4000)

    return () => {
      window.clearInterval(countdownId)
      window.clearTimeout(redirectId)
    }
  }, [expired, goToLogin])

  return <SessionExpiredModal open={expired} onLogin={goToLogin} seconds={seconds} />
}
