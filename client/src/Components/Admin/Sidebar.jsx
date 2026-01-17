// Sidebar.jsx
"use client"

import { useState, useEffect, useCallback, memo, useRef, useMemo, useId } from "react"
import { useNavigate } from "react-router-dom"
import { FaChevronDown, FaSignOutAlt, FaMoon, FaSun, FaSearch, FaTimes } from "react-icons/fa"
import { useDispatch } from "react-redux"
import { signOut } from "../../Redux/UserSlice/UserSlice"

import jetsky from "../../../public/jetsky.svg"
import JetskyModal from "./JetskyModal"
import NotificationModal from "./NotificationModal"
import { Bell } from "lucide-react"

/** ✅ LOCAL API */
const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const NOTIF_BADGE_COLOR = "#5850EC"

function getAuthHeaders() {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

/**
 * ✅ GET /api/notifications/deadlines
 * returns: { items: [...] }
 */
async function fetchDeadlineNotifications({ windowDays = 7, includeOverdue = true, limit = 500, signal }) {
  const qs = new URLSearchParams({
    windowDays: String(windowDays),
    includeOverdue: String(includeOverdue),
    limit: String(limit),
  })

  const res = await fetch(`${API_BASE}/notifications/deadlines?${qs.toString()}`, {
    headers: getAuthHeaders(),
    credentials: "include",
    signal,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to fetch notifications")
  return Array.isArray(data?.items) ? data.items : []
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
  const buttonsRef = useRef([])
  buttonsRef.current = []

  const setBtnRef = (el) => {
    if (el) buttonsRef.current.push(el)
  }

  const onKeyDown = (e) => {
    if (!isExpanded) return
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"]
    if (!keys.includes(e.key)) return
    e.preventDefault()

    const idx = buttonsRef.current.indexOf(document.activeElement)
    if (e.key === "ArrowDown") {
      const next = Math.min(idx + 1, buttonsRef.current.length - 1)
      buttonsRef.current[next]?.focus()
    } else if (e.key === "ArrowUp") {
      const prev = Math.max(idx - 1, 0)
      buttonsRef.current[prev]?.focus()
    } else if (e.key === "Home") {
      buttonsRef.current[0]?.focus()
    } else if (e.key === "End") {
      buttonsRef.current[buttonsRef.current.length - 1]?.focus()
    }
  }

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
      onKeyDown={onKeyDown}
    >
      <div className="pl-4 py-2 space-y-1">
        {Object.keys(subcategories).map((subcategory) => {
          const isActive = activeSection === section && activeSubcategory === subcategory
          return (
            <button
              key={subcategory}
              ref={setBtnRef}
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

function getInitials(nameOrEmail) {
  const s = String(nameOrEmail || "").trim()
  if (!s) return "U"
  const parts = s.split(" ").filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return (parts[0].slice(0, 1) + parts[1].slice(0, 1)).toUpperCase()
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
}) {
  const [expandedSection, setExpandedSection] = useState(null)
  const [user, setUser] = useState(null) // { username, role, prettyRole, avatarUrl }
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

  const navigate = useNavigate()
  const dispatch = useDispatch()

  const sidebarId = useId()
  const reducedMotion = usePrefersReducedMotion()
  const isMobileViewport = useIsMobileViewport(768)

  const safeSections = sections || {}
  const { heights: subMenuHeights, getSubmenuRef } = useSubmenuMeasure(safeSections)

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
      const def = safeSections?.[section]
      if (!def) return

      if (def.subcategories) toggleSection(section)
      else {
        setActiveSection(section)
        setActiveSubcategory("")
        if (isMobile) toggleSidebar()
      }
    },
    [safeSections, setActiveSection, setActiveSubcategory, toggleSection, isMobile, toggleSidebar]
  )

  const handleKeyToggle = useCallback(
    (e, section) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        handleSectionClick(section)
      } else if (e.key === "ArrowRight") {
        if (safeSections?.[section]?.subcategories) setExpandedSection(section)
      } else if (e.key === "ArrowLeft") {
        if (expandedSection === section) setExpandedSection(null)
      }
    },
    [handleSectionClick, safeSections, expandedSection]
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

  // ✅ load user fast (localStorage) then sync /users/me for avatar
  useEffect(() => {
    let mounted = true

    const setFromLocal = () => {
      try {
        const stored = localStorage.getItem("user")
        const loggedInUser = stored ? JSON.parse(stored) : null

        if (!loggedInUser) {
          setUser(null)
          navigate("/login")
          return
        }

        const displayName = loggedInUser?.name || loggedInUser?.email || "User"
        const roleRaw = loggedInUser?.role || "admin"
        const prettyRole =
          roleRaw === "superadmin"
            ? "Super Admin"
            : roleRaw === "admin"
            ? "Admin"
            : roleRaw === "employee"
            ? "Employee"
            : roleRaw === "marketing_team"
            ? "Marketing Team"
            : roleRaw

        setUser({
          username: displayName,
          role: roleRaw,
          prettyRole,
          avatarUrl: loggedInUser?.avatarUrl || "",
        })
      } catch {
        setUser(null)
        navigate("/login")
      }
    }

    const syncMe = async () => {
      try {
        const res = await fetch(`${API_BASE}/users/me`, {
          method: "GET",
          headers: getAuthHeaders(),
          credentials: "include",
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) return

        const me = data?.user
        if (!me) return

        const displayName = me?.name || me?.email || "User"
        const roleRaw = me?.role || "admin"
        const prettyRole =
          roleRaw === "superadmin"
            ? "Super Admin"
            : roleRaw === "admin"
            ? "Admin"
            : roleRaw === "employee"
            ? "Employee"
            : roleRaw === "marketing_team"
            ? "Marketing Team"
            : roleRaw

        if (!mounted) return
        setUser({
          username: displayName,
          role: roleRaw,
          prettyRole,
          avatarUrl: me?.avatarUrl || "",
        })

        try {
          const stored = localStorage.getItem("user")
          const prev = stored ? JSON.parse(stored) : {}
          localStorage.setItem("user", JSON.stringify({ ...prev, ...me }))
        } catch {}
      } catch {
        // ignore
      }
    }

    setFromLocal()
    syncMe()

    return () => {
      mounted = false
    }
  }, [navigate])

  const refreshNotifCount = useCallback(async () => {
    try {
      if (abortNotifRef.current) abortNotifRef.current.abort()
      const controller = new AbortController()
      abortNotifRef.current = controller

      setNotifLoading(true)
      const items = await fetchDeadlineNotifications({
        windowDays: 7,
        includeOverdue: true,
        limit: 500,
        signal: controller.signal,
      })
      setNotifCount7d(Array.isArray(items) ? items.length : 0)
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

  // ✅ Keep Profile Settings ABOVE About (always)
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

  // ✅ Filter by search (section + subcategories)
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

  const initials = getInitials(user?.username)

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
        .bell-ring {
          transform-origin: 50% 10%;
          animation: bellRing 1.2s ease-in-out infinite;
        }
      `}</style>

      {/* Tooltip */}
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

      {/* Mobile overlay */}
      {isMobile && isOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/35 backdrop-blur-[1px]"
          onClick={toggleSidebar}
          aria-label="Close sidebar"
        />
      )}

      {/* Notifications modal */}
      <NotificationModal open={showNotifications} onClose={() => setShowNotifications(false)} isDarkMode={isDarkMode} />

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
        {/* Header */}
        <div className={`relative p-6 border-b ${isDarkMode ? "border-white/10" : "border-gray-200"}`}>
          <div className="flex items-center gap-4">
            {/* ✅ Updated profile picture design:
                - smaller glow ring (not too big)
                - uses a gradient "frame" with subtle shadow
                - active dot (Messenger style) */}
            <div className="relative">
              {/* Gradient frame */}
              <div className="p-[2px] rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-[0_10px_26px_-18px_rgba(99,102,241,0.85)]">
                {/* Inner */}
                <div className={`rounded-full p-[2px] ${isDarkMode ? "bg-gray-900" : "bg-white"}`}>
                  <div className="relative w-[46px] h-[46px] rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                    {user?.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt="Profile"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // If broken, hide img so initials show
                          e.currentTarget.style.display = "none"
                        }}
                      />
                    ) : null}

                    {!user?.avatarUrl ? (
                      <span className={`text-sm font-extrabold ${isDarkMode ? "text-gray-900" : "text-gray-800"}`}>
                        {initials}
                      </span>
                    ) : null}

                    {/* soft image-colored overlay feel (subtle) */}
                    <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/10 to-black/10" />
                  </div>
                </div>
              </div>

              {/* ✅ Active dot (Facebook/Messenger style) */}
              <span
                className={`absolute bottom-0 right-0 translate-x-[2px] translate-y-[2px] w-3.5 h-3.5 rounded-full bg-emerald-500 ring-4 ${
                  isDarkMode ? "ring-gray-900" : "ring-white"
                } shadow-[0_6px_14px_-8px_rgba(16,185,129,0.95)]`}
                title="Active"
                aria-label="Active"
              />
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold tracking-tight truncate">{user?.username || "User"}</h2>
              <p className={`text-sm truncate ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                {user?.prettyRole || user?.role || "—"}
              </p>
            </div>
          </div>

          <div className="flex justify-between items-center mt-6">
            <button
              onClick={() => {
                setIsDarkMode((prev) => {
                  const next = !prev
                  localStorage.setItem("theme", next ? "dark" : "light")
                  return next
                })
              }}
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
              {/* Bell */}
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

              {/* Jetsky */}
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
              } border-2 border-transparent focus:border-purple-500 outline-none group-hover:bg-opacity-100`}
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

        {/* Nav */}
        <nav
          aria-label="Primary"
          className={`flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin ${
            isDarkMode
              ? "scrollbar-thumb-purple-500 scrollbar-track-transparent"
              : "scrollbar-thumb-purple-400 scrollbar-track-gray-100"
          }`}
        >
          {Object.keys(sections || {}).length === 0 ? null : null}

          {filteredSectionKeys.map((section) => {
            const def = safeSections[section]
            if (!def) return null

            const hasSubs = !!def.subcategories
            const isActiveSection = activeSection === section && !activeSubcategory
            const controlsId = hasSubs ? `submenu-${section.replace(/\s+/g, "_")}` : undefined

            return (
              <div key={section} className="select-none">
                <button
                  onClick={() => handleSectionClick(section)}
                  onKeyDown={(e) => handleKeyToggle(e, section)}
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
                  aria-expanded={hasSubs ? expandedSection === section : undefined}
                  aria-controls={controlsId}
                  aria-current={isActiveSection ? "page" : undefined}
                  title={section}
                >
                  <div className="flex items-center gap-3 relative z-10">
                    <span
                      className={`text-lg ${reducedMotion ? "" : "transition-all duration-200"} ${
                        activeSection === section ? "scale-110" : ""
                      }`}
                    >
                      {def.icon}
                    </span>
                    <span className="font-medium">{section}</span>
                  </div>

                  {hasSubs && (
                    <FaChevronDown
                      className={`${reducedMotion ? "" : "transition-transform duration-300"} relative z-10 ${
                        expandedSection === section ? "rotate-180" : ""
                      }`}
                      aria-hidden
                    />
                  )}
                </button>

                {hasSubs && (
                  <SubMenu
                    subcategories={def.subcategories}
                    section={section}
                    activeSection={activeSection}
                    activeSubcategory={activeSubcategory}
                    handleSubcategoryClick={handleSubcategoryClick}
                    isExpanded={expandedSection === section}
                    height={subMenuHeights[section]}
                    isDarkMode={isDarkMode}
                    subMenuRef={getSubmenuRef(section)}
                    reducedMotion={reducedMotion}
                  />
                )}
              </div>
            )
          })}
        </nav>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className={`group p-4 flex items-center justify-center gap-3 ${reducedMotion ? "" : "transition-all duration-200"} border-t relative overflow-hidden ${
            isDarkMode
              ? "border-white/10 text-gray-400 hover:text-white hover:bg-white/5"
              : "border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          }`}
          aria-label="Logout"
          title="Logout"
        >
          <FaSignOutAlt
            className={`text-lg ${reducedMotion ? "" : "transition-transform duration-200"} group-hover:-translate-x-1 relative z-10`}
          />
          <span className="font-medium relative z-10">Logout</span>
        </button>
      </aside>

      <JetskyModal isOpen={showJetsky} onClose={() => setShowJetsky(false)} isDarkMode={isDarkMode} />
    </>
  )
}
