// Sidebar.jsx (EmployeeSidebar.jsx / MarketingSidebar.jsx)
// ✅ UPDATED: Adds "Profile Settings" section (uses your new MarketingTeamProfileSettings component)
// ✅ Keeps avatarUrl refresh logic (localStorage + /api/users/me)
// ✅ Same design + flyout + compact + notifications

"use client"

import { useState, useEffect, useCallback, memo, useRef, useMemo, useId } from "react"
import { useNavigate } from "react-router-dom"
import {
  FaChevronDown,
  FaSignOutAlt,
  FaMoon,
  FaSun,
  FaSearch,
  FaTimes,
  FaAngleDoubleLeft,
  FaUserCircle,
} from "react-icons/fa"
import { useDispatch } from "react-redux"
import { signOut } from "../../Redux/UserSlice/UserSlice"

import jetsky from "../../../public/jetsky.svg"
import JetskyModal from "./JetskyModal"

// ✅ optional (keep if you already have it)
import NotificationModal from "./NotificationModal"
import { Bell } from "lucide-react"


const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const NOTIF_BADGE_COLOR = "#5850EC"

function getAuthHeaders() {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function fetchInboxUnreadCount({ signal } = {}) {
  const res = await fetch(`${API_BASE}/lead-messages/unread-count`, {
    headers: getAuthHeaders(),
    signal,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to fetch inbox count")
  return Number(data?.unreadCount || 0)
}

// ✅ fetch logged-in user profile (including avatarUrl)
async function fetchMe({ signal } = {}) {
  const res = await fetch(`${API_BASE}/users/me`, {
    method: "GET",
    headers: getAuthHeaders(),
    signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to fetch profile")
  return data?.user || null
}

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const m = window.matchMedia?.("(prefers-reduced-motion: reduce)")
    const onChange = () => setReduced(!!m?.matches)
    onChange()
    m?.addEventListener?.("change", onChange)
    return () => m?.removeEventListener?.("change", onChange)
  }, [])
  return reduced
}

const useIsMobileViewport = (breakpointPx = 768) => {
  const [isMobileVp, setIsMobileVp] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const mq = window.matchMedia?.(`(max-width: ${breakpointPx - 1}px)`)
    const update = () => setIsMobileVp(!!mq?.matches)
    update()
    mq?.addEventListener?.("change", update)
    window.addEventListener("resize", update)
    return () => {
      mq?.removeEventListener?.("change", update)
      window.removeEventListener("resize", update)
    }
  }, [breakpointPx])

  return isMobileVp
}

function useSubmenuMeasure(sections) {
  const [heights, setHeights] = useState({})
  const observersRef = useRef({})
  const elMapRef = useRef({})
  const refCallbacksRef = useRef({})

  const setHeight = useCallback((section, value) => {
    setHeights((prev) => {
      if (prev[section] === value) return prev
      return { ...prev, [section]: value }
    })
  }, [])

  const getSubmenuRef = useCallback(
    (section) => {
      if (refCallbacksRef.current[section]) return refCallbacksRef.current[section]

      const refCb = (el) => {
        if (observersRef.current[section]) {
          try {
            observersRef.current[section].disconnect()
          } catch {}
          delete observersRef.current[section]
        }

        elMapRef.current[section] = el

        if (!el || !sections?.[section]?.subcategories) {
          setHeight(section, 0)
          return
        }

        setHeight(section, el.scrollHeight)

        const ro = new ResizeObserver(() => setHeight(section, el.scrollHeight))
        ro.observe(el)
        observersRef.current[section] = ro
      }

      refCallbacksRef.current[section] = refCb
      return refCb
    },
    [sections, setHeight]
  )

  useEffect(() => {
    Object.keys(elMapRef.current).forEach((section) => {
      const el = elMapRef.current[section]
      if (el && sections?.[section]?.subcategories) setHeight(section, el.scrollHeight)
      else setHeight(section, 0)
    })
  }, [sections, setHeight])

  useEffect(() => {
    return () => {
      Object.values(observersRef.current).forEach((ro) => {
        try {
          ro.disconnect()
        } catch {}
      })
      observersRef.current = {}
      elMapRef.current = {}
      refCallbacksRef.current = {}
    }
  }, [])

  return { heights, getSubmenuRef }
}

const SubMenuInline = memo(function SubMenuInline({
  subcategories,
  section,
  activeSection,
  activeSubcategory,
  handleSubcategoryClick,
  isExpanded,
  height,
  isDarkMode,
  subMenuRef,
  reducedMotion,
}) {
  const regionId = `submenu-${section.replace(/\s+/g, "_")}`
  if (!subcategories) return null

  return (
    <div
      id={regionId}
      ref={subMenuRef}
      className={`overflow-hidden ${
        reducedMotion ? "" : `transition-[max-height,opacity] duration-300 ease-in-out ${isExpanded ? "opacity-100" : "opacity-0"}`
      }`}
      style={{ maxHeight: isExpanded ? height ?? 0 : 0 }}
      role="region"
      aria-hidden={!isExpanded}
      aria-label={`${section} submenu`}
    >
      <div className="pl-3 py-2 space-y-1">
        {Object.keys(subcategories).map((subcategory) => {
          const isActive = activeSection === section && activeSubcategory === subcategory
          return (
            <button
              key={subcategory}
              type="button"
              onClick={() => handleSubcategoryClick(section, subcategory)}
              className={`group w-full flex items-center px-4 py-2.5 rounded-xl text-sm relative ${
                reducedMotion ? "" : "transition-all duration-200"
              } focus:outline-none focus:ring-2 focus:ring-purple-500/60 ${
                isActive
                  ? isDarkMode
                    ? "bg-white/8 text-white font-semibold"
                    : "bg-gray-900/5 text-gray-900 font-semibold"
                  : isDarkMode
                  ? "text-gray-400 hover:bg-white/5 hover:text-white"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <div className="relative flex items-center gap-2 w-full">
                <span
                  className={`absolute left-0 w-1.5 h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 ${
                    reducedMotion ? "" : "transition-all duration-300"
                  } ${isActive ? "opacity-100 scale-100" : "opacity-0 scale-0"}`}
                />
                <span className="ml-3 relative z-10">{subcategory}</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
})

const FlyoutSubmenu = memo(function FlyoutSubmenu({
  open,
  top,
  left,
  section,
  subcategories,
  onSelect,
  onClose,
  isDarkMode,
  reducedMotion,
  activeSection,
  activeSubcategory,
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null
  const keys = Object.keys(subcategories || {})
  if (!keys.length) return null

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[99998] cursor-default"
        onClick={onClose}
        aria-label="Close submenu"
      />
      <div
        className={`fixed z-[99999] w-[280px] rounded-2xl border shadow-2xl overflow-hidden ${
          isDarkMode ? "bg-gray-900 text-white border-white/10" : "bg-white text-gray-900 border-gray-200"
        } ${reducedMotion ? "" : "animate-[fadeIn_.12s_ease-out]"}`}
        style={{ top: `${top}px`, left: `${left}px` }}
        role="dialog"
        aria-label={`${section} submenu`}
        onMouseLeave={onClose}
      >
        <div className={`px-4 py-3 border-b ${isDarkMode ? "border-white/10" : "border-gray-200"}`}>
          <div className="text-sm font-semibold truncate">{section}</div>
          <div className={`text-xs mt-0.5 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>Choose an option</div>
        </div>

        <div className="p-2">
          {keys.map((subcategory) => {
            const isActive = activeSection === section && activeSubcategory === subcategory
            return (
              <button
                key={subcategory}
                type="button"
                onClick={() => onSelect(section, subcategory)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm ${
                  reducedMotion ? "" : "transition-all duration-150"
                } focus:outline-none focus:ring-2 focus:ring-purple-500/60 ${
                  isActive
                    ? isDarkMode
                      ? "bg-white/8 text-white font-semibold"
                      : "bg-gray-900/5 text-gray-900 font-semibold"
                    : isDarkMode
                    ? "text-gray-300 hover:bg-white/5 hover:text-white"
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                {subcategory}
              </button>
            )
          })}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </>
  )
})

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

export default function Sidebar({
  setActiveSection,
  setActiveSubcategory,
  sections,
  activeSection,
  activeSubcategory,
  isMobile,
  isOpen,
  toggleSidebar,
  isDarkMode,
  setIsDarkMode,
  onOpenCustomer,
}) {
  const [expandedSection, setExpandedSection] = useState(null)
  const [user, setUser] = useState(null)
  const [avatarBroken, setAvatarBroken] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [showJetsky, setShowJetsky] = useState(false)

  const [showNotifications, setShowNotifications] = useState(false)
  const [notifCount7d, setNotifCount7d] = useState(0)
  const [notifLoading, setNotifLoading] = useState(false)

  const [showBellTip, setShowBellTip] = useState(false)
  const tipTimerRef = useRef(null)
  const bellBtnRef = useRef(null)
  const [tipPos, setTipPos] = useState({ top: 0, left: 0 })

  const abortNotifRef = useRef(null)
  const abortMeRef = useRef(null)

  const [compact, setCompact] = useState(false)

  const [flyout, setFlyout] = useState({ open: false, section: "", top: 0, left: 0 })
  const openTimerRef = useRef(null)

  const navigate = useNavigate()
  const dispatch = useDispatch()

  const sidebarId = useId()
  const reducedMotion = usePrefersReducedMotion()
  const isMobileViewport = useIsMobileViewport(768)

  const safeSections = sections || {}
  const { heights: subMenuHeights, getSubmenuRef } = useSubmenuMeasure(safeSections)

  useEffect(() => {
    try {
      const v = localStorage.getItem("sidebar_compact_employee")
      setCompact(v === "1")
    } catch {}
  }, [])

  useEffect(() => {
    if (isMobileViewport) setCompact(false)
  }, [isMobileViewport])

  const toggleCompact = useCallback(() => {
    setCompact((prev) => {
      const next = !prev
      try {
        localStorage.setItem("sidebar_compact_employee", next ? "1" : "0")
      } catch {}
      return next
    })
    setExpandedSection(null)
    setFlyout({ open: false, section: "", top: 0, left: 0 })
  }, [])

  const toggleTheme = useCallback(() => {
    setIsDarkMode((prev) => {
      const next = !prev
      localStorage.setItem("theme", next ? "dark" : "light")
      return next
    })
  }, [setIsDarkMode])

  const toggleSection = useCallback((section) => {
    setExpandedSection((prev) => (prev === section ? null : section))
  }, [])

  const handleSubcategoryClick = useCallback(
    (section, subcategory) => {
      setActiveSection(section)
      setActiveSubcategory(subcategory)
      setFlyout({ open: false, section: "", top: 0, left: 0 })
      if (isMobile) toggleSidebar()
    },
    [setActiveSection, setActiveSubcategory, isMobile, toggleSidebar]
  )

  const closeFlyout = useCallback(() => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current)
    setFlyout((p) => ({ ...p, open: false, section: "" }))
  }, [])

  const openFlyout = useCallback((section, anchorEl) => {
    if (!anchorEl) return
    if (openTimerRef.current) clearTimeout(openTimerRef.current)

    const r = anchorEl.getBoundingClientRect()
    const desiredTop = r.top - 8
    const maxTop = window.innerHeight - 220
    const top = clamp(desiredTop, 12, Math.max(12, maxTop))
    const left = r.right + 12

    setFlyout({ open: true, section, top, left })
  }, [])

  const handleSectionClick = useCallback(
    (section, anchorEl) => {
      const def = safeSections?.[section]
      if (!def) return
      const hasSubs = !!def.subcategories

      if (!isMobileViewport && compact && hasSubs) {
        openFlyout(section, anchorEl)
        return
      }

      if (hasSubs) {
        toggleSection(section)
      } else {
        setActiveSection(section)
        setActiveSubcategory("")
        closeFlyout()
        if (isMobile) toggleSidebar()
      }
    },
    [
      safeSections,
      compact,
      isMobileViewport,
      openFlyout,
      toggleSection,
      setActiveSection,
      setActiveSubcategory,
      closeFlyout,
      isMobile,
      toggleSidebar,
    ]
  )

  const handleLogout = useCallback(() => {
    localStorage.removeItem("user")
    localStorage.removeItem("token")
    dispatch(signOut())
    navigate("/login")
  }, [dispatch, navigate])

  // ✅ load user from localStorage immediately, then refresh from /users/me
  useEffect(() => {
    let parsed = null
    try {
      const stored = localStorage.getItem("user")
      parsed = stored ? JSON.parse(stored) : null
    } catch {
      parsed = null
    }

    if (!parsed) {
      setUser(null)
      navigate("/login")
      return
    }

    const role = parsed?.role
    const displayName = parsed?.name || parsed?.email || "User"
    setAvatarBroken(false)
    setUser({
      username: displayName,
      role,
      avatarUrl: parsed?.avatarUrl || "",
      email: parsed?.email || "",
      id: parsed?._id || parsed?.id || "",
    })

    const controller = new AbortController()
    abortMeRef.current?.abort?.()
    abortMeRef.current = controller

    ;(async () => {
      try {
        const fresh = await fetchMe({ signal: controller.signal })
        if (!fresh) return

        const nextUser = {
          username: fresh?.name || fresh?.email || displayName,
          role: fresh?.role || role,
          avatarUrl: fresh?.avatarUrl || "",
          email: fresh?.email || parsed?.email || "",
          id: fresh?._id || parsed?._id || parsed?.id || "",
        }

        setAvatarBroken(false)
        setUser(nextUser)

        try {
          localStorage.setItem(
            "user",
            JSON.stringify({
              ...(parsed || {}),
              ...fresh,
            })
          )
        } catch {}
      } catch {
        // ignore
      }
    })()

    return () => controller.abort()
  }, [navigate])

  const refreshNotifCount = useCallback(async () => {
    try {
      if (abortNotifRef.current) abortNotifRef.current.abort()
      const controller = new AbortController()
      abortNotifRef.current = controller

      setNotifLoading(true)
      const inboxUnread = await fetchInboxUnreadCount({ signal: controller.signal })
      setNotifCount7d(Number(inboxUnread || 0))
    } catch {
      // ignore
    } finally {
      setNotifLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshNotifCount()
    const id = setInterval(refreshNotifCount, 120_000)
    return () => {
      clearInterval(id)
      abortNotifRef.current?.abort?.()
    }
  }, [refreshNotifCount])

  useEffect(() => {
    if (!showNotifications) refreshNotifCount()
  }, [showNotifications, refreshNotifCount])

  const recomputeTipPos = useCallback(() => {
    const el = bellBtnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setTipPos({ top: r.top + r.height / 2, left: r.right + 14 })
  }, [])

  useEffect(() => {
    if (isMobileViewport) {
      setShowBellTip(false)
      if (tipTimerRef.current) clearTimeout(tipTimerRef.current)
      return
    }
    if (notifCount7d <= 0) return

    recomputeTipPos()
    setShowBellTip(true)

    if (tipTimerRef.current) clearTimeout(tipTimerRef.current)
    tipTimerRef.current = setTimeout(() => setShowBellTip(false), 4000)

    return () => {
      if (tipTimerRef.current) clearTimeout(tipTimerRef.current)
    }
  }, [notifCount7d, recomputeTipPos, isMobileViewport])

  useEffect(() => {
    if (!showBellTip) return
    const on = () => recomputeTipPos()
    window.addEventListener("resize", on)
    window.addEventListener("scroll", on, true)
    return () => {
      window.removeEventListener("resize", on)
      window.removeEventListener("scroll", on, true)
    }
  }, [showBellTip, recomputeTipPos])

  const dismissBellTip = useCallback(() => {
    setShowBellTip(false)
    if (tipTimerRef.current) clearTimeout(tipTimerRef.current)
  }, [])

  // ✅ keep Profile Settings before About (if both exist)
  const orderedSectionKeys = useMemo(() => {
    const keys = Object.keys(safeSections)
    const hasAbout = keys.includes("About")
    const hasProfile = keys.includes("Profile Settings")
    if (!hasAbout || !hasProfile) return keys

    const without = keys.filter((k) => k !== "About" && k !== "Profile Settings")
    const aboutIndex = keys.indexOf("About")
    const before = without.slice(0, Math.max(0, aboutIndex - 1))
    const after = without.slice(Math.max(0, aboutIndex - 1))
    return [...before, "Profile Settings", "About", ...after]
  }, [safeSections])

  const filteredSectionKeys = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return orderedSectionKeys

    return orderedSectionKeys.filter((name) => {
      const def = safeSections[name]
      if (!def) return false
      if (name.toLowerCase().includes(q)) return true
      if (!def.subcategories) return false
      return Object.keys(def.subcategories).some((sc) => (name + " " + sc).toLowerCase().includes(q))
    })
  }, [orderedSectionKeys, safeSections, searchTerm])

  const shouldRingBell = !reducedMotion && notifCount7d > 0 && showBellTip && !isMobileViewport

  const asideWidth = compact ? "w-[96px]" : "w-80"
  const headerPad = compact ? "p-4" : "p-6"
  const navPad = compact ? "p-3" : "p-4"

  const avatarUrl = (user?.avatarUrl || "").trim()
  const showAvatar = !!avatarUrl && !avatarBroken

  return (
    <>
      <style>{`
        @keyframes bellRing {
          0%   { transform: rotate(0deg); }
          10%  { transform: rotate(10deg); }
          20%  { transform: rotate(-10deg); }
          30%  { transform: rotate(12deg); }
          40%  { transform: rotate(-12deg); }
          50%  { transform: rotate(8deg); }
          60%  { transform: rotate(-8deg); }
          70%  { transform: rotate(4deg); }
          80%  { transform: rotate(-4deg); }
          90%  { transform: rotate(2deg); }
          100% { transform: rotate(0deg); }
        }
        .bell-ring { transform-origin: 50% 10%; animation: bellRing 1.2s ease-in-out infinite; }
      `}</style>

      <NotificationModal
        open={showNotifications}
        onClose={() => setShowNotifications(false)}
        isDarkMode={isDarkMode}
        onOpenCustomer={onOpenCustomer}
      />

      {/* bell tooltip (desktop only) */}
      {!isMobileViewport && showBellTip && notifCount7d > 0 ? (
        <div
          className="fixed z-[999999] pointer-events-auto"
          style={{ top: `${tipPos.top}px`, left: `${tipPos.left}px`, transform: "translateY(-50%)" }}
          onClick={dismissBellTip}
          role="status"
          aria-live="polite"
        >
          <div
            className={`relative w-[340px] sm:w-[380px] rounded-2xl border shadow-2xl px-4 py-3 ${
              isDarkMode ? "bg-gray-900 text-white border-white/10" : "bg-white text-gray-900 border-gray-200"
            }`}
          >
            <p className="text-sm font-bold leading-snug">
              {notifCount7d} notification{notifCount7d === 1 ? "" : "s"}
            </p>
            <p className={`text-xs mt-1 leading-relaxed ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
              Click the bell to review inbox messages.
            </p>

            <div
              className={`absolute left-[-7px] top-1/2 -translate-y-1/2 w-3.5 h-3.5 rotate-45 border-l border-b ${
                isDarkMode ? "bg-gray-900 border-white/10" : "bg-white border-gray-200"
              }`}
              aria-hidden="true"
            />
          </div>
        </div>
      ) : null}

      {/* mobile overlay */}
      {isMobile && isOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px]"
          onClick={toggleSidebar}
          aria-label="Close sidebar"
        />
      )}

      {/* flyout submenu for compact */}
      <FlyoutSubmenu
        open={!isMobileViewport && compact && flyout.open && !!safeSections?.[flyout.section]?.subcategories}
        top={flyout.top}
        left={flyout.left}
        section={flyout.section}
        subcategories={safeSections?.[flyout.section]?.subcategories || {}}
        onSelect={handleSubcategoryClick}
        onClose={closeFlyout}
        isDarkMode={isDarkMode}
        reducedMotion={reducedMotion}
        activeSection={activeSection}
        activeSubcategory={activeSubcategory}
      />

      <aside
        id={sidebarId}
        className={`${asideWidth} flex flex-col h-screen min-w-0 ${
          isDarkMode ? "bg-gray-900 text-white border-white/10" : "bg-white text-gray-900 border-gray-200"
        } ${isMobile ? "fixed left-0 top-0 z-40" : "sticky top-0"} ${
          reducedMotion ? "" : "transition-all duration-300 ease-in-out"
        } ${isMobile && !isOpen ? "-translate-x-full" : "translate-x-0"} border-r ${
          isDarkMode ? "shadow-2xl shadow-purple-500/10" : "shadow-xl shadow-gray-200/70"
        } backdrop-blur-lg`}
        aria-label="Sidebar Navigation"
      >
        {/* HEADER */}
        <div className={`relative ${headerPad} border-b ${isDarkMode ? "border-white/10" : "border-gray-200"}`}>
          <div className={`flex items-center ${compact ? "justify-center" : "justify-between"} gap-3`}>
            {/* user */}
            <div className={`flex items-center gap-4 ${compact ? "justify-center" : ""}`}>
              <div className="relative">
                <div className="p-[2px] rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-[0_12px_34px_-22px_rgba(99,102,241,0.95)]">
                  <div className={`rounded-full p-[2px] ${isDarkMode ? "bg-gray-900" : "bg-white"}`}>
                    <div className="relative w-[46px] h-[46px] rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                      {showAvatar ? (
                        <img
                          src={avatarUrl}
                          alt={user?.username ? `${user.username} avatar` : "User avatar"}
                          className="w-full h-full object-cover"
                          draggable={false}
                          onError={() => setAvatarBroken(true)}
                        />
                      ) : (
                        <FaUserCircle size={46} className={isDarkMode ? "text-white" : "text-gray-700"} />
                      )}
                      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/10 to-black/10" />
                    </div>
                  </div>
                </div>

                <span
                  className={`absolute bottom-0 right-0 translate-x-[2px] translate-y-[2px] w-3.5 h-3.5 rounded-full bg-emerald-500 ring-4 ${
                    isDarkMode ? "ring-gray-900" : "ring-white"
                  } shadow-[0_6px_14px_-8px_rgba(16,185,129,0.95)]`}
                  title="Active"
                  aria-label="Active"
                />
              </div>

              {!compact ? (
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold tracking-tight truncate">{user?.username || "Guest"}</h2>
                  <p className={`text-sm truncate ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                    {user?.role || "Marketing Team"}
                  </p>
                </div>
              ) : null}
            </div>

            {/* collapse button (desktop only) */}
            {!isMobileViewport ? (
              <button
                onClick={toggleCompact}
                type="button"
                className={`hidden md:flex items-center justify-center h-9 w-9 rounded-xl border ${
                  isDarkMode
                    ? "border-white/10 bg-white/5 hover:bg-white/10 text-gray-200"
                    : "border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-800"
                } ${reducedMotion ? "" : "transition-all duration-200"} focus:outline-none focus:ring-2 focus:ring-purple-500/60`}
                aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
                title={compact ? "Expand" : "Collapse"}
              >
                <FaAngleDoubleLeft
                  className={`${compact ? "rotate-180" : ""} ${reducedMotion ? "" : "transition-transform duration-200"}`}
                />
              </button>
            ) : null}
          </div>

          {/* ACTIONS ROW */}
          <div className={`mt-5 flex ${compact ? "justify-center" : "justify-between"} items-center`}>
            {!compact ? (
              <button
                onClick={toggleTheme}
                className={`p-2 rounded-xl ${reducedMotion ? "" : "transition-all duration-200"} ${
                  isDarkMode ? "hover:bg-white/10 text-gray-300 hover:text-white" : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"
                } hover:scale-110 transform focus:outline-none focus:ring-2 focus:ring-purple-500/60`}
                aria-label="Toggle theme"
                title="Toggle theme"
                type="button"
              >
                {isDarkMode ? <FaMoon size={18} /> : <FaSun size={18} />}
              </button>
            ) : null}

            <div className={`flex items-center ${compact ? "justify-center" : "gap-2"}`}>
              <button
                ref={bellBtnRef}
                onClick={() => {
                  dismissBellTip()
                  setShowNotifications(true)
                }}
                className={`relative h-11 w-11 flex items-center justify-center rounded-2xl ${
                  isDarkMode ? "bg-white/90 text-gray-900" : "bg-gray-900 text-white"
                } ${reducedMotion ? "" : "hover:scale-110 transition-transform"} focus:outline-none focus:ring-2 focus:ring-purple-500/60`}
                aria-label="Open notifications"
                title="Notifications"
                type="button"
              >
                <span className={shouldRingBell ? "bell-ring" : ""}>
                  <Bell className="w-4 h-4" />
                </span>

                {notifCount7d > 0 ? (
                  <span className="absolute -top-1.5 -right-1.5">
                    <span className="absolute inset-0 rounded-full blur-md opacity-90" style={{ backgroundColor: NOTIF_BADGE_COLOR }} />
                    <span
                      className="relative min-w-[20px] h-[20px] px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center bg-white/10 backdrop-blur-md text-white border border-white/10"
                      style={{ boxShadow: `0 0 0 1px rgba(255,255,255,0.08) inset` }}
                    >
                      {notifCount7d > 99 ? "99+" : notifCount7d}
                    </span>
                  </span>
                ) : null}

                {notifLoading ? <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-purple-400" /> : null}
              </button>

              {!compact ? (
                <button
                  onClick={() => setShowJetsky(true)}
                  className={`h-11 w-11 flex items-center justify-center rounded-2xl ${
                    isDarkMode ? "bg-white/90" : "bg-gray-900/5"
                  } ${reducedMotion ? "" : "hover:scale-110 transition-transform"} focus:outline-none focus:ring-2 focus:ring-purple-500/60`}
                  aria-label="Open Jetsky modal"
                  title="Jetsky"
                  type="button"
                >
                  <img
                    src={(jetsky && (jetsky.src || jetsky)) || "/jetsky.svg"}
                    alt="Jetsky"
                    className="h-9 w-9 select-none"
                    draggable={false}
                  />
                </button>
              ) : null}
            </div>
          </div>

          <div
            className={`absolute inset-x-0 -bottom-px h-px ${
              isDarkMode ? "bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" : "bg-gradient-to-r from-transparent via-purple-500/30 to-transparent"
            }`}
            aria-hidden="true"
          />
        </div>

        {/* SEARCH */}
        <div className={`${navPad} pb-2`}>
          {!compact ? (
            <div className="relative group">
              <FaSearch
                className={`absolute left-3 top-1/2 -translate-y-1/2 ${
                  isDarkMode ? "text-gray-400" : "text-gray-500"
                } group-hover:text-purple-500 ${reducedMotion ? "" : "transition-colors duration-200"}`}
                aria-hidden
              />
              <input
                type="text"
                placeholder="Search…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-10 py-2.5 rounded-2xl ${reducedMotion ? "" : "transition-all duration-200"} ${
                  isDarkMode
                    ? "bg-gray-800/60 focus:bg-gray-800 text-white placeholder-gray-400"
                    : "bg-gray-100/60 focus:bg-gray-100 text-gray-900 placeholder-gray-500"
                } border border-transparent focus:border-purple-500/70 outline-none focus:ring-2 focus:ring-purple-500/20`}
                aria-label="Search sections"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl ${
                    isDarkMode ? "text-gray-300 hover:bg-white/10" : "text-gray-600 hover:bg-gray-200/70"
                  } focus:outline-none focus:ring-2 focus:ring-purple-500/60`}
                  aria-label="Clear search"
                  title="Clear search"
                >
                  <FaTimes size={14} />
                </button>
              )}
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => {
                  setCompact(false)
                  try {
                    localStorage.setItem("sidebar_compact_employee", "0")
                  } catch {}
                  setTimeout(() => {
                    const el = document.querySelector(`#${CSS.escape(sidebarId)} input[aria-label="Search sections"]`)
                    el?.focus?.()
                  }, 0)
                }}
                className={`h-11 w-11 rounded-2xl flex items-center justify-center border ${
                  isDarkMode
                    ? "border-white/10 bg-white/5 hover:bg-white/10 text-gray-200"
                    : "border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-800"
                } ${reducedMotion ? "" : "transition-all duration-200"} focus:outline-none focus:ring-2 focus:ring-purple-500/60`}
                aria-label="Search"
                title="Search"
              >
                <FaSearch />
              </button>
            </div>
          )}
        </div>

        {/* NAV */}
        <nav
          aria-label="Primary"
          className={`flex-1 overflow-y-auto ${navPad} pt-2 space-y-2 scrollbar-thin ${
            isDarkMode ? "scrollbar-thumb-purple-500 scrollbar-track-transparent" : "scrollbar-thumb-purple-400 scrollbar-track-gray-100"
          }`}
          onScroll={() => {
            if (compact && flyout.open) closeFlyout()
          }}
        >
          {filteredSectionKeys.map((section) => {
            const def = safeSections[section]
            if (!def) return null

            const hasSubs = !!def.subcategories
            const isExpanded = expandedSection === section
            const isActiveSection = activeSection === section && !activeSubcategory
            const controlsId = hasSubs ? `submenu-${section.replace(/\s+/g, "_")}` : undefined

            return (
              <div key={section} className="select-none">
                <button
                  type="button"
                  onClick={(e) => handleSectionClick(section, e.currentTarget)}
                  onMouseEnter={(e) => {
                    if (!isMobileViewport && compact && hasSubs) {
                      if (openTimerRef.current) clearTimeout(openTimerRef.current)
                      openTimerRef.current = setTimeout(() => openFlyout(section, e.currentTarget), 120)
                    }
                  }}
                  onMouseLeave={() => {
                    if (openTimerRef.current) clearTimeout(openTimerRef.current)
                  }}
                  onFocus={(e) => {
                    if (!isMobileViewport && compact && hasSubs) openFlyout(section, e.currentTarget)
                  }}
                  className={`group w-full flex items-center ${
                    compact ? "justify-center px-3 py-3" : "justify-between px-4 py-3"
                  } rounded-2xl ${reducedMotion ? "" : "transition-all duration-200 ease-in-out"} relative overflow-hidden border ${
                    activeSection === section
                      ? isDarkMode
                        ? "bg-white/8 border-white/10 text-white"
                        : "bg-gray-900/5 border-gray-200 text-gray-900"
                      : isDarkMode
                      ? "border-transparent text-gray-300 hover:text-white hover:bg-white/5"
                      : "border-transparent text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                  } focus:outline-none focus:ring-2 focus:ring-purple-500/60`}
                  aria-expanded={hasSubs && !compact ? isExpanded : undefined}
                  aria-controls={hasSubs && !compact ? controlsId : undefined}
                  aria-current={isActiveSection ? "page" : undefined}
                  title={section}
                >
                  {activeSection === section ? (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 rounded-r-full bg-gradient-to-b from-indigo-500 via-purple-500 to-pink-500"
                      aria-hidden="true"
                    />
                  ) : null}

                  <div className={`flex items-center ${compact ? "justify-center" : "gap-3"} relative z-10`}>
                    <span
                      className={`text-[18px] ${reducedMotion ? "" : "transition-transform duration-200"} ${
                        activeSection === section ? "scale-110" : "group-hover:scale-105"
                      }`}
                    >
                      {def.icon}
                    </span>
                    {!compact ? <span className="font-medium">{section}</span> : null}
                  </div>

                  {hasSubs && !compact ? (
                    <FaChevronDown
                      className={`${reducedMotion ? "" : "transition-transform duration-300"} relative z-10 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                      aria-hidden
                    />
                  ) : null}
                </button>

                {hasSubs && !compact ? (
                  <SubMenuInline
                    subcategories={def.subcategories}
                    section={section}
                    activeSection={activeSection}
                    activeSubcategory={activeSubcategory}
                    handleSubcategoryClick={handleSubcategoryClick}
                    isExpanded={isExpanded}
                    height={subMenuHeights[section]}
                    isDarkMode={isDarkMode}
                    subMenuRef={getSubmenuRef(section)}
                    reducedMotion={reducedMotion}
                  />
                ) : null}
              </div>
            )
          })}
        </nav>

        {/* LOGOUT */}
        <button
          onClick={handleLogout}
          className={`group ${navPad} py-4 flex items-center ${compact ? "justify-center" : "justify-center gap-3"} ${
            reducedMotion ? "" : "transition-all duration-200"
          } border-t relative overflow-hidden ${
            isDarkMode ? "border-white/10 text-gray-300 hover:text-white hover:bg-white/5" : "border-gray-200 text-gray-700 hover:text-gray-900 hover:bg-gray-50"
          } focus:outline-none focus:ring-2 focus:ring-purple-500/60`}
          aria-label="Logout"
          title="Logout"
          type="button"
        >
          <FaSignOutAlt
            className={`text-lg ${reducedMotion ? "" : "transition-transform duration-200"} group-hover:-translate-x-1 relative z-10`}
          />
          {!compact ? <span className="font-medium relative z-10">Logout</span> : null}
        </button>
      </aside>

      <JetskyModal isOpen={showJetsky} onClose={() => setShowJetsky(false)} isDarkMode={isDarkMode} />
    </>
  )
}

