"use client"

import { useState, useEffect, useCallback, memo, useRef, useMemo, useId } from "react"
import { useNavigate } from "react-router-dom"
import { FaChevronDown, FaSignOutAlt, FaUserCircle, FaMoon, FaSun, FaSearch, FaTimes } from "react-icons/fa"
import { useDispatch } from "react-redux"
import { signOut } from "../../Redux/UserSlice/UserSlice"

import jetsky from "../../../public/jetsky.svg"
import JetskyModal from "./JetskyModal"

// ✅ optional (keep if you already have it)
import NotificationModal from "./NotificationModal"
import { Bell } from "lucide-react"

const API_BASE = "http://localhost:4000/api"

// ✅ your sample color (purple/indigo)
const NOTIF_BADGE_COLOR = "#5850EC"

function getAuthHeaders() {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function fetchDeadlineNotifications({ windowDays = 7, includeOverdue = true, limit = 500 }) {
  const qs = new URLSearchParams({
    windowDays: String(windowDays),
    includeOverdue: String(includeOverdue),
    limit: String(limit),
  })

  const res = await fetch(`${API_BASE}/notifications/deadlines?${qs.toString()}`, {
    headers: getAuthHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to fetch notifications")
  return data?.items || []
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

// ✅ hide tooltip on mobile screen widths
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

        if (!el || !sections[section]?.subcategories) {
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
      if (el && sections[section]?.subcategories) setHeight(section, el.scrollHeight)
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

const SubMenu = memo(function SubMenu({
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

  return (
    <div
      id={regionId}
      ref={subMenuRef}
      className={`overflow-hidden ${
        reducedMotion ? "" : `transition-all duration-300 ease-in-out ${isExpanded ? "opacity-100" : "opacity-0"}`
      }`}
      style={{ maxHeight: isExpanded ? height ?? 0 : 0 }}
      role="region"
      aria-hidden={!isExpanded}
      aria-label={`${section} submenu`}
    >
      <div className="pl-4 py-2 space-y-1">
        {Object.keys(subcategories).map((subcategory) => {
          const isActive = activeSection === section && activeSubcategory === subcategory
          return (
            <button
              key={subcategory}
              onClick={() => handleSubcategoryClick(section, subcategory)}
              className={`group w-full flex items-center px-4 py-2.5 rounded-lg text-sm relative ${
                reducedMotion ? "" : "transition-all duration-200"
              } ${
                isActive
                  ? isDarkMode
                    ? "bg-gradient-to-r from-indigo-600/20 via-purple-600/20 to-pink-600/20 text-white font-medium"
                    : "bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 text-gray-900 font-medium"
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
  onOpenCustomer, // optional
}) {
  const [expandedSection, setExpandedSection] = useState(null)
  const [user, setUser] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [showJetsky, setShowJetsky] = useState(false)

  // ✅ notifications (keep if you have notifications endpoint)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifCount7d, setNotifCount7d] = useState(0)
  const [notifLoading, setNotifLoading] = useState(false)

  // ✅ tooltip
  const [showBellTip, setShowBellTip] = useState(false)
  const tipTimerRef = useRef(null)
  const bellBtnRef = useRef(null)
  const [tipPos, setTipPos] = useState({ top: 0, left: 0 })

  const navigate = useNavigate()
  const dispatch = useDispatch()

  const sidebarId = useId()
  const reducedMotion = usePrefersReducedMotion()
  const isMobileViewport = useIsMobileViewport(768)
  const searchInputRef = useRef(null)

  const { heights: subMenuHeights, getSubmenuRef } = useSubmenuMeasure(sections)

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

  const handleSectionClick = useCallback(
    (section) => {
      if (sections[section].subcategories) {
        toggleSection(section)
      } else {
        setActiveSection(section)
        setActiveSubcategory("")
        if (isMobile) toggleSidebar()
      }
    },
    [sections, setActiveSection, setActiveSubcategory, toggleSection, isMobile, toggleSidebar]
  )

  const handleSubcategoryClick = useCallback(
    (section, subcategory) => {
      setActiveSection(section)
      setActiveSubcategory(subcategory)
      if (isMobile) toggleSidebar()
    },
    [setActiveSection, setActiveSubcategory, isMobile, toggleSidebar]
  )

  const handleLogout = useCallback(() => {
    localStorage.removeItem("user")
    localStorage.removeItem("token")
    dispatch(signOut())
    navigate("/login")
  }, [dispatch, navigate])

  // ✅ ensure marketing-only sidebar behavior
  useEffect(() => {
    try {
      const stored = localStorage.getItem("user")
      const loggedInUser = stored ? JSON.parse(stored) : null

      if (!loggedInUser) {
        setUser(null)
        navigate("/login")
        return
      }

      const role = loggedInUser?.role
      const displayName = loggedInUser?.name || loggedInUser?.email || "User"

      // optional guard: if not marketing_team, redirect
      // if (role !== "marketing_team") navigate("/login")

      setUser({ username: displayName, role })
    } catch {
      setUser(null)
      navigate("/login")
    }
  }, [navigate])

  const refreshNotifCount = useCallback(async () => {
    try {
      setNotifLoading(true)
      const items = await fetchDeadlineNotifications({ windowDays: 7, includeOverdue: true, limit: 500 })
      const n = Array.isArray(items) ? items.length : 0
      setNotifCount7d(n)
      return n
    } catch {
      return null
    } finally {
      setNotifLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshNotifCount()
    const id = setInterval(refreshNotifCount, 120_000)
    return () => clearInterval(id)
  }, [refreshNotifCount])

  useEffect(() => {
    if (!showNotifications) refreshNotifCount()
  }, [showNotifications, refreshNotifCount])

  const recomputeTipPos = useCallback(() => {
    const el = bellBtnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setTipPos({
      top: r.top + r.height / 2,
      left: r.right + 14,
    })
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

  const searchable = useMemo(() => {
    return Object.entries(sections).flatMap(([s, def]) => {
      const base = [{ kind: "section", section: s }]
      if (!def.subcategories) return base
      return base.concat(Object.keys(def.subcategories).map((sc) => ({ kind: "sub", section: s, subcategory: sc })))
    })
  }, [sections])

  const results = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return null
    return searchable.filter((item) => {
      if (item.kind === "section") return item.section.toLowerCase().includes(q)
      return (item.section + " " + item.subcategory).toLowerCase().includes(q)
    })
  }, [searchable, searchTerm])

  const filteredSections = useMemo(() => {
    if (results) {
      const matchedSections = new Set(results.map((r) => r.section))
      return Object.keys(sections).filter((s) => matchedSections.has(s))
    }
    return Object.keys(sections)
  }, [results, sections])

  const shouldRingBell = !reducedMotion && notifCount7d > 0 && showBellTip && !isMobileViewport

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

      {/* ✅ notification modal (keep if you use it) */}
      <NotificationModal
        open={showNotifications}
        onClose={() => setShowNotifications(false)}
        isDarkMode={isDarkMode}
        onOpenCustomer={onOpenCustomer}
      />

      {/* ✅ tooltip hidden on mobile */}
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
              {notifCount7d} deadline{notifCount7d === 1 ? "" : "s"} within 7 days
            </p>
            <p className={`text-xs mt-1 leading-relaxed ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
              Click the bell to review and open the deadlines modal.
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

      <aside
        id={sidebarId}
        className={`w-80 flex flex-col h-screen ${
          isDarkMode ? "bg-gray-900 text-white border-white/10" : "bg-white text-gray-900 border-gray-200"
        } ${isMobile ? "fixed left-0 top-0 z-40" : "sticky top-0"} ${
          reducedMotion ? "" : "transition-all duration-300 ease-in-out"
        } ${isMobile && !isOpen ? "-translate-x-full" : "translate-x-0"} border-r ${
          isDarkMode ? "shadow-2xl shadow-purple-500/5" : "shadow-xl shadow-gray-200/50"
        } backdrop-blur-lg`}
        aria-label="Sidebar Navigation"
      >
        {/* Top user area */}
        <div className={`relative p-6 border-b ${isDarkMode ? "border-white/10" : "border-gray-200"}`}>
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-pulse blur-md opacity-75" />
              <div
                className={`relative p-1 rounded-full ${isDarkMode ? "bg-gray-800" : "bg-white"} ring-2 ring-purple-500/20`}
              >
                <FaUserCircle size={48} className={isDarkMode ? "text-white" : "text-gray-700"} />
              </div>
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-gray-900">
                <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold tracking-tight truncate">{user?.username || "Guest"}</h2>
              <p className={`text-sm truncate ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                {user?.role || "No Role"}
              </p>
            </div>
          </div>

          {/* Theme + Bell + Jetsky */}
          <div className="flex justify-between items-center mt-6">
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg ${reducedMotion ? "" : "transition-all duration-200"} ${
                isDarkMode
                  ? "hover:bg-white/10 text-gray-400 hover:text-white"
                  : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"
              } hover:scale-110 transform`}
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {isDarkMode ? <FaMoon size={20} /> : <FaSun size={20} />}
            </button>

            <div className="flex items-center gap-2">
              {/* bell */}
              <button
                ref={bellBtnRef}
                onClick={() => {
                  dismissBellTip()
                  setShowNotifications(true)
                }}
                className={`relative h-9 w-9 flex items-center justify-center rounded-full ${
                  isDarkMode ? "bg-white/90 text-gray-900" : "bg-gray-900 text-white"
                } ${reducedMotion ? "" : "hover:scale-110 transition-transform"}`}
                aria-label="Open notifications"
                title="Notifications"
              >
                <span className={shouldRingBell ? "bell-ring" : ""}>
                  <Bell className="w-4 h-4" />
                </span>

                {notifCount7d > 0 ? (
                  <span className="absolute -top-1 -right-1">
                    <span
                      className="absolute inset-0 rounded-full blur-md opacity-90"
                      style={{ backgroundColor: NOTIF_BADGE_COLOR }}
                    />
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

              {/* jetsky */}
              <button
                onClick={() => setShowJetsky(true)}
                className={`h-9 w-9 flex items-center justify-center rounded-full ${isDarkMode ? "bg-white" : ""} ${
                  reducedMotion ? "" : "hover:scale-110 transition-transform"
                }`}
                aria-label="Open Jetsky modal"
                title="Jetsky"
              >
                <img
                  src={(jetsky && (jetsky.src || jetsky)) || "/jetsky.svg"}
                  alt="Jetsky"
                  className="h-9 w-9 select-none"
                  draggable={false}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="p-4">
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
              className={`w-full pl-10 pr-10 py-2 rounded-lg ${reducedMotion ? "" : "transition-all duration-200"} ${
                isDarkMode
                  ? "bg-gray-800/50 focus:bg-gray-800 text-white placeholder-gray-400"
                  : "bg-gray-100/50 focus:bg-gray-100 text-gray-900 placeholder-gray-500"
              } border-2 border-transparent focus:border-purple-500 outline-none`}
              aria-label="Search sections"
            />

            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded ${
                  isDarkMode ? "text-gray-300 hover:bg-white/10" : "text-gray-600 hover:bg-gray-200/70"
                }`}
                aria-label="Clear search"
                title="Clear search"
              >
                <FaTimes size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Nav (Dashboard, Leads, About only) */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2" aria-label="Primary">
          {Object.keys(sections).map((section) => (
            <div key={section} className="select-none">
              <button
                onClick={() => handleSectionClick(section)}
                className={`group w-full flex items-center justify-between px-4 py-3 rounded-lg ${
                  reducedMotion ? "" : "transition-all duration-200 ease-in-out"
                } relative overflow-hidden ${
                  activeSection === section
                    ? isDarkMode
                      ? "bg-gradient-to-r from-indigo-600/20 via-purple-600/20 to-pink-600/20 text-white"
                      : "bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 text-gray-900"
                    : isDarkMode
                      ? "text-gray-400 hover:text-white"
                      : "text-gray-600 hover:text-gray-900"
                }`}
                aria-current={activeSection === section ? "page" : undefined}
                title={section}
              >
                <div className="flex items-center gap-3 relative z-10">
                  <span className="text-lg">{sections[section].icon}</span>
                  <span className="font-medium">{section}</span>
                </div>
              </button>
            </div>
          ))}
        </nav>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className={`group p-4 flex items-center justify-center gap-3 ${
            reducedMotion ? "" : "transition-all duration-200"
          } border-t relative overflow-hidden ${
            isDarkMode
              ? "border-white/10 text-gray-400 hover:text-white hover:bg-white/5"
              : "border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          }`}
          aria-label="Logout"
          title="Logout"
        >
          <FaSignOutAlt className="text-lg group-hover:-translate-x-1 relative z-10" />
          <span className="font-medium relative z-10">Logout</span>
        </button>
      </aside>

      <JetskyModal isOpen={showJetsky} onClose={() => setShowJetsky(false)} isDarkMode={isDarkMode} />
    </>
  )
}
