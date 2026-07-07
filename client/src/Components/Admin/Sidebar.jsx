// Sidebar.jsx
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
} from "react-icons/fa"
import { useDispatch } from "react-redux"
import { signOut } from "../../Redux/UserSlice/UserSlice"

import jetsky from "../../../public/jetsky.svg"
import JetskyModal from "./JetskyModal"
import NotificationModal from "./NotificationModal"
import { Bell } from "lucide-react"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const NOTIF_BADGE_COLOR = "#5850EC"

const SIDEBAR_GROUPS = [
  {
    title: "CRM",
    matchers: [
      "dashboard",
      "client",
      "customer",
      "lead",
      "deal",
      "pipeline",
      "workflow setup",
      "report",
      "analytics",
      "campaign",
    ],
  },
  {
    title: "Task",
    matchers: [
      "task",
      "work queue",
      "job",
      "follow",
      "activity",
      "calendar",
      "workflow procedure",
      "procedure",
    ],
  },
  {
    title: "Payroll",
    matchers: [
      "payroll",
      "employee",
      "employees",
      "staff",
      "salary",
      "tax",
      "tds",
      "attendance",
      "leave",
    ],
  },
  {
    title: "Accounting",
    matchers: [
      "accounting",
      "finance",
      "chart",
      "journal",
      "invoice",
      "income",
      "expense",
      "payable",
      "receivable",
      "ledger",
      "opening balance",
      "trial balance",
      "balance sheet",
      "cash flow",
      "cash",
      "bank",
    ],
  },
  {
    title: "System Access",
    matchers: [
      "user",
      "admin",
      "role",
      "permission",
      "department",
      "position",
      "access",
      "profile settings",
      "settings",
      "software version",
    ],
  },
  { title: "Others", matchers: [] },
]

const normalizeSectionLabel = (value) => String(value || "").trim().toLowerCase()

const getSidebarGroupForSection = (section) => {
  const name = normalizeSectionLabel(section)

  for (const group of SIDEBAR_GROUPS) {
    if (group.title === "Others") continue
    if (group.matchers.some((matcher) => name.includes(matcher))) return group.title
  }

  return "Others"
}

function getAuthHeaders() {
  const token = localStorage.getItem("token")

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function fetchDeadlineNotifications({
  windowDays = 7,
  includeOverdue = true,
  limit = 500,
  signal,
}) {
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

async function fetchInboxUnreadCount({ signal } = {}) {
  const res = await fetch(`${API_BASE}/lead-messages/unread-count`, {
    headers: getAuthHeaders(),
    credentials: "include",
    signal,
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) throw new Error(data?.message || "Failed to fetch inbox count")

  return Number(data?.unreadCount || 0)
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
        reducedMotion
          ? ""
          : `transition-[max-height,opacity] duration-300 ease-in-out ${
              isExpanded ? "opacity-100" : "opacity-0"
            }`
      }`}
      style={{ maxHeight: isExpanded ? height ?? 0 : 0 }}
      role="region"
      aria-hidden={!isExpanded}
      aria-label={`${section} submenu`}
      onKeyDown={onKeyDown}
    >
      <div className="space-y-1 py-1.5 pl-2.5">
        {Object.keys(subcategories).map((subcategory) => {
          const isActive = activeSection === section && activeSubcategory === subcategory

          return (
            <button
              key={subcategory}
              ref={setBtnRef}
              onClick={() => handleSubcategoryClick(section, subcategory)}
              className={`group relative flex w-full items-center rounded-xl px-3 py-2 text-[12.5px] ${
                reducedMotion ? "" : "transition-all duration-200"
              } focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                isActive
                  ? isDarkMode
                    ? "bg-white/[0.08] font-semibold text-white"
                    : "bg-gray-900/[0.06] font-semibold text-gray-950"
                  : isDarkMode
                    ? "text-gray-400 hover:bg-white/[0.06] hover:text-white"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-950"
              }`}
              aria-current={isActive ? "page" : undefined}
              type="button"
            >
              <div className="relative flex w-full items-center gap-2">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 ${
                    reducedMotion ? "" : "transition-all duration-200"
                  } ${isActive ? "opacity-100 scale-100" : "opacity-35 scale-75"}`}
                />
                <span className="relative z-10 truncate">{subcategory}</span>
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
        className={`fixed z-[99999] w-[264px] overflow-hidden rounded-2xl border shadow-[0_24px_60px_-30px_rgba(15,23,42,0.45)] ${
          isDarkMode
            ? "border-white/10 bg-gray-900 text-white"
            : "border-gray-200 bg-white text-gray-900"
        } ${reducedMotion ? "" : "animate-[fadeIn_.12s_ease-out]"}`}
        style={{ top: `${top}px`, left: `${left}px` }}
        role="dialog"
        aria-label={`${section} submenu`}
        onMouseLeave={onClose}
      >
        <div className={`border-b px-4 py-3 ${isDarkMode ? "border-white/10" : "border-gray-100"}`}>
          <div className="truncate text-sm font-bold">{section}</div>
          <div className={`mt-0.5 text-xs ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
            Choose an option
          </div>
        </div>

        <div className="max-h-[360px] overflow-y-auto p-2">
          {keys.map((subcategory) => {
            const isActive = activeSection === section && activeSubcategory === subcategory

            return (
              <button
                key={subcategory}
                type="button"
                onClick={() => onSelect(section, subcategory)}
                className={`w-full rounded-xl px-3 py-2.5 text-left text-sm ${
                  reducedMotion ? "" : "transition-all duration-150"
                } focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                  isActive
                    ? isDarkMode
                      ? "bg-white/[0.08] font-semibold text-white"
                      : "bg-gray-900/[0.06] font-semibold text-gray-950"
                    : isDarkMode
                      ? "text-gray-300 hover:bg-white/[0.06] hover:text-white"
                      : "text-gray-700 hover:bg-gray-100 hover:text-gray-950"
                }`}
              >
                {subcategory}
              </button>
            )
          })}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
})

function getInitials(nameOrEmail) {
  const s = String(nameOrEmail || "").trim()

  if (!s) return "U"

  const parts = s.split(" ").filter(Boolean)

  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()

  return (parts[0].slice(0, 1) + parts[1].slice(0, 1)).toUpperCase()
}

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
}) {
  const [expandedSection, setExpandedSection] = useState(null)
  const [user, setUser] = useState(null)
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
      const v = localStorage.getItem("sidebar_compact")
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
        localStorage.setItem("sidebar_compact", next ? "1" : "0")
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

  const handleLogout = useCallback(() => {
    localStorage.removeItem("user")
    localStorage.removeItem("token")
    dispatch(signOut())
    navigate("/login")
  }, [dispatch, navigate])

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
      } catch {}
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

      const [items, inboxUnread] = await Promise.all([
        fetchDeadlineNotifications({
          windowDays: 7,
          includeOverdue: true,
          limit: 500,
          signal: controller.signal,
        }),
        fetchInboxUnreadCount({ signal: controller.signal }),
      ])

      setNotifCount7d((Array.isArray(items) ? items.length : 0) + Number(inboxUnread || 0))
    } catch {
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

      return Object.keys(def.subcategories).some((sc) =>
        `${name} ${sc}`.toLowerCase().includes(q)
      )
    })
  }, [orderedSectionKeys, safeSections, searchTerm])

  const groupedSectionBlocks = useMemo(() => {
    const groupMap = new Map(
      SIDEBAR_GROUPS.map((group) => [group.title, { ...group, sections: [] }])
    )

    filteredSectionKeys.forEach((section) => {
      const groupTitle = getSidebarGroupForSection(section)
      const group = groupMap.get(groupTitle) || groupMap.get("Others")
      group.sections.push(section)
    })

    return SIDEBAR_GROUPS.map((group) => groupMap.get(group.title)).filter(
      (group) => group?.sections?.length
    )
  }, [filteredSectionKeys])

  const shouldRingBell = !reducedMotion && notifCount7d > 0 && showBellTip && !isMobileViewport
  const initials = getInitials(user?.username)

  const asideWidth = compact ? "w-[86px]" : "w-[292px]"
  const headerPad = compact ? "p-3.5" : "p-4"
  const navPad = compact ? "p-3" : "px-3.5"

  const closeFlyout = useCallback(() => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current)
    setFlyout((p) => ({ ...p, open: false, section: "" }))
  }, [])

  const openFlyout = useCallback((section, anchorEl) => {
    if (!anchorEl) return
    if (openTimerRef.current) clearTimeout(openTimerRef.current)

    const r = anchorEl.getBoundingClientRect()
    const desiredTop = r.top - 8
    const maxTop = window.innerHeight - 240
    const top = clamp(desiredTop, 12, Math.max(12, maxTop))
    const left = r.right + 10

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

  const handleSubcategoryClick = useCallback(
    (section, subcategory) => {
      setActiveSection(section)
      setActiveSubcategory(subcategory)
      closeFlyout()

      if (isMobile) toggleSidebar()
    },
    [setActiveSection, setActiveSubcategory, closeFlyout, isMobile, toggleSidebar]
  )

  const handleKeyToggle = useCallback(
    (e, section, anchorEl) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        handleSectionClick(section, anchorEl)
      } else if (e.key === "ArrowRight") {
        if (safeSections?.[section]?.subcategories) {
          if (!isMobileViewport && compact) openFlyout(section, anchorEl)
          else setExpandedSection(section)
        }
      } else if (e.key === "ArrowLeft") {
        if (!isMobileViewport && compact) closeFlyout()
        else if (expandedSection === section) setExpandedSection(null)
      } else if (e.key === "Escape") {
        closeFlyout()
      }
    },
    [
      handleSectionClick,
      safeSections,
      expandedSection,
      compact,
      isMobileViewport,
      openFlyout,
      closeFlyout,
    ]
  )

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

      {!isMobileViewport && showBellTip && notifCount7d > 0 ? (
        <div
          className="pointer-events-auto fixed z-[999999]"
          style={{
            top: `${tipPos.top}px`,
            left: `${tipPos.left}px`,
            transform: "translateY(-50%)",
          }}
          onClick={dismissBellTip}
          role="status"
          aria-live="polite"
        >
          <div
            className={`relative w-[320px] rounded-2xl border px-4 py-3 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.45)] ${
              isDarkMode
                ? "border-white/10 bg-gray-900 text-white"
                : "border-gray-200 bg-white text-gray-900"
            }`}
          >
            <p className="text-sm font-bold leading-snug">
              {notifCount7d} notification{notifCount7d === 1 ? "" : "s"}
            </p>

            <p className={`mt-1 text-xs leading-relaxed ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
              Click the bell to review deadlines and inbox alerts.
            </p>

            <div
              className={`absolute left-[-7px] top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-45 border-b border-l ${
                isDarkMode ? "border-white/10 bg-gray-900" : "border-gray-200 bg-white"
              }`}
              aria-hidden="true"
            />
          </div>
        </div>
      ) : null}

      {isMobile && isOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px]"
          onClick={toggleSidebar}
          aria-label="Close sidebar"
        />
      ) : null}

      <NotificationModal
        open={showNotifications}
        onClose={() => setShowNotifications(false)}
        isDarkMode={isDarkMode}
      />

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
        className={`${asideWidth} flex h-screen min-w-0 flex-col ${
          isDarkMode
            ? "border-white/10 bg-gray-950 text-white shadow-2xl shadow-purple-500/10"
            : "border-gray-200 bg-white text-gray-900 shadow-xl shadow-gray-200/70"
        } ${isMobile ? "fixed left-0 top-0 z-40" : "sticky top-0"} ${
          reducedMotion ? "" : "transition-all duration-300 ease-in-out"
        } ${isMobile && !isOpen ? "-translate-x-full" : "translate-x-0"} border-r backdrop-blur-lg`}
        aria-label="Sidebar Navigation"
      >
        <div className={`relative ${headerPad} border-b ${isDarkMode ? "border-white/10" : "border-gray-100"}`}>
          <div className={`flex items-center ${compact ? "justify-center" : "justify-between"} gap-3`}>
            <div className={`flex min-w-0 items-center ${compact ? "justify-center" : "gap-3"}`}>
              <div className="relative shrink-0">
                <div className="rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-[2px] shadow-[0_12px_34px_-22px_rgba(99,102,241,0.95)]">
                  <div className={`rounded-full p-[2px] ${isDarkMode ? "bg-gray-950" : "bg-white"}`}>
                    <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gray-100">
                      {user?.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt="Profile"
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none"
                          }}
                        />
                      ) : null}

                      {!user?.avatarUrl ? (
                        <span className="text-sm font-extrabold text-gray-800">{initials}</span>
                      ) : null}

                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 to-black/10" />
                    </div>
                  </div>
                </div>

                <span
                  className={`absolute bottom-0 right-0 h-3 w-3 translate-x-[2px] translate-y-[2px] rounded-full bg-emerald-500 ring-[3px] ${
                    isDarkMode ? "ring-gray-950" : "ring-white"
                  } shadow-[0_6px_14px_-8px_rgba(16,185,129,0.95)]`}
                  title="Active"
                  aria-label="Active"
                />
              </div>

              {!compact ? (
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[15px] font-bold tracking-tight">
                    {user?.username || "User"}
                  </h2>
                  <p className={`mt-0.5 truncate text-xs font-medium ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                    {user?.prettyRole || user?.role || "—"}
                  </p>
                </div>
              ) : null}
            </div>

            {!isMobileViewport ? (
              <button
                onClick={toggleCompact}
                type="button"
                className={`hidden h-9 w-9 items-center justify-center rounded-xl border md:flex ${
                  isDarkMode
                    ? "border-white/10 bg-white/[0.06] text-gray-200 hover:bg-white/[0.1]"
                    : "border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100"
                } ${
                  reducedMotion ? "" : "transition-all duration-200"
                } focus:outline-none focus:ring-2 focus:ring-purple-500/50`}
                aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
                title={compact ? "Expand" : "Collapse"}
              >
                <FaAngleDoubleLeft
                  className={`${compact ? "rotate-180" : ""} ${
                    reducedMotion ? "" : "transition-transform duration-200"
                  }`}
                />
              </button>
            ) : null}
          </div>

          <div className={`mt-4 flex items-center ${compact ? "justify-center" : "justify-between"}`}>
            {!compact ? (
              <button
                onClick={toggleTheme}
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  reducedMotion ? "" : "transition-all duration-200 hover:scale-[1.03]"
                } ${
                  isDarkMode
                    ? "text-gray-300 hover:bg-white/[0.08] hover:text-white"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-950"
                } focus:outline-none focus:ring-2 focus:ring-purple-500/50`}
                aria-label="Toggle theme"
                title="Toggle theme"
                type="button"
              >
                {isDarkMode ? <FaMoon size={16} /> : <FaSun size={16} />}
              </button>
            ) : null}

            <div className={`flex items-center ${compact ? "justify-center" : "gap-2"}`}>
              <button
                ref={bellBtnRef}
                onClick={() => {
                  dismissBellTip()
                  setShowNotifications(true)
                }}
                className={`relative flex h-10 w-10 items-center justify-center rounded-xl ${
                  isDarkMode ? "bg-white text-gray-950" : "bg-gray-950 text-white"
                } ${
                  reducedMotion ? "" : "transition-transform hover:scale-[1.03]"
                } focus:outline-none focus:ring-2 focus:ring-purple-500/50`}
                aria-label="Open notifications"
                title="Notifications"
                type="button"
              >
                <span className={shouldRingBell ? "bell-ring" : ""}>
                  <Bell className="h-4 w-4" />
                </span>

                {notifCount7d > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5">
                    <span
                      className="absolute inset-0 rounded-full opacity-90 blur-md"
                      style={{ backgroundColor: NOTIF_BADGE_COLOR }}
                    />
                    <span
                      className="relative flex h-[19px] min-w-[19px] items-center justify-center rounded-full border border-white/10 bg-white/10 px-1.5 text-[10px] font-bold text-white backdrop-blur-md"
                      style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.08) inset" }}
                    >
                      {notifCount7d > 99 ? "99+" : notifCount7d}
                    </span>
                  </span>
                ) : null}

                {notifLoading ? (
                  <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-purple-400" />
                ) : null}
              </button>

              {!compact ? (
                <button
                  onClick={() => setShowJetsky(true)}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    isDarkMode ? "bg-white text-gray-950" : "bg-gray-900/[0.05]"
                  } ${
                    reducedMotion ? "" : "transition-transform hover:scale-[1.03]"
                  } focus:outline-none focus:ring-2 focus:ring-purple-500/50`}
                  aria-label="Open Jetsky modal"
                  title="Jetsky"
                  type="button"
                >
                  <img
                    src={(jetsky && (jetsky.src || jetsky)) || "/jetsky.svg"}
                    alt="Jetsky"
                    className="h-8 w-8 select-none"
                    draggable={false}
                  />
                </button>
              ) : null}
            </div>
          </div>

          <div
            className={`absolute inset-x-0 -bottom-px h-px ${
              isDarkMode
                ? "bg-gradient-to-r from-transparent via-purple-500/40 to-transparent"
                : "bg-gradient-to-r from-transparent via-purple-500/25 to-transparent"
            }`}
            aria-hidden="true"
          />
        </div>

        <div className={`${navPad} pb-2 pt-3`}>
          <div className={`relative ${compact ? "flex justify-center" : ""}`}>
            {!compact ? (
              <div className="group relative w-full">
                <FaSearch
                  className={`absolute left-3 top-1/2 -translate-y-1/2 ${
                    isDarkMode ? "text-gray-500" : "text-gray-400"
                  } ${reducedMotion ? "" : "transition-colors duration-200"} group-focus-within:text-purple-500`}
                  aria-hidden
                />

                <input
                  type="text"
                  placeholder="Search menu..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full rounded-xl border px-10 py-2.5 text-sm outline-none ${
                    reducedMotion ? "" : "transition-all duration-200"
                  } ${
                    isDarkMode
                      ? "border-white/10 bg-white/[0.06] text-white placeholder-gray-500 focus:border-purple-500/50 focus:bg-white/[0.08]"
                      : "border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 focus:border-purple-500/40 focus:bg-white"
                  } focus:ring-4 focus:ring-purple-500/10`}
                  aria-label="Search sections"
                />

                {searchTerm ? (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className={`absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg ${
                      isDarkMode
                        ? "text-gray-300 hover:bg-white/[0.08]"
                        : "text-gray-500 hover:bg-gray-200/70"
                    } focus:outline-none focus:ring-2 focus:ring-purple-500/50`}
                    aria-label="Clear search"
                    title="Clear search"
                  >
                    <FaTimes size={13} />
                  </button>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setCompact(false)

                  try {
                    localStorage.setItem("sidebar_compact", "0")
                  } catch {}

                  setTimeout(() => {
                    const el = document.querySelector(
                      `#${CSS.escape(sidebarId)} input[aria-label="Search sections"]`
                    )
                    el?.focus?.()
                  }, 0)
                }}
                className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                  isDarkMode
                    ? "border-white/10 bg-white/[0.06] text-gray-200 hover:bg-white/[0.1]"
                    : "border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100"
                } ${
                  reducedMotion ? "" : "transition-all duration-200"
                } focus:outline-none focus:ring-2 focus:ring-purple-500/50`}
                aria-label="Search"
                title="Search"
              >
                <FaSearch size={14} />
              </button>
            )}
          </div>
        </div>

        <nav
          aria-label="Primary"
          className={`flex-1 overflow-y-auto ${navPad} space-y-2.5 pt-1 scrollbar-thin ${
            isDarkMode
              ? "scrollbar-thumb-purple-500 scrollbar-track-transparent"
              : "scrollbar-thumb-purple-400 scrollbar-track-gray-100"
          }`}
          onScroll={() => {
            if (compact && flyout.open) closeFlyout()
          }}
        >
          {groupedSectionBlocks.map((group) => (
            <div key={group.title} className={compact ? "space-y-1" : "space-y-1.5"}>
              {!compact ? (
                <div
                  className={`px-3 pb-1 pt-2 text-[10px] font-black uppercase tracking-[0.16em] ${
                    isDarkMode ? "text-gray-600" : "text-gray-400"
                  }`}
                >
                  {group.title}
                </div>
              ) : group.title !== "Others" ? (
                <div
                  className={`mx-auto my-2 h-px w-8 ${
                    isDarkMode ? "bg-white/10" : "bg-gray-200"
                  }`}
                  aria-hidden="true"
                />
              ) : null}

              {group.sections.map((section) => {
                const def = safeSections[section]
                if (!def) return null

                const hasSubs = !!def.subcategories
                const isActiveSection = activeSection === section && !activeSubcategory
                const isExpanded = expandedSection === section
                const controlsId = hasSubs ? `submenu-${section.replace(/\s+/g, "_")}` : undefined

                return (
                  <div key={section} className="select-none">
                    <button
                      onClick={(e) => handleSectionClick(section, e.currentTarget)}
                      onMouseEnter={(e) => {
                        if (!isMobileViewport && compact && hasSubs) {
                          if (openTimerRef.current) clearTimeout(openTimerRef.current)
                          openTimerRef.current = setTimeout(
                            () => openFlyout(section, e.currentTarget),
                            120
                          )
                        }
                      }}
                      onMouseLeave={() => {
                        if (openTimerRef.current) clearTimeout(openTimerRef.current)
                      }}
                      onFocus={(e) => {
                        if (!isMobileViewport && compact && hasSubs) {
                          openFlyout(section, e.currentTarget)
                        }
                      }}
                      onKeyDown={(e) => handleKeyToggle(e, section, e.currentTarget)}
                      className={`group relative flex w-full items-center overflow-hidden rounded-xl border text-sm ${
                        compact ? "justify-center px-2.5 py-2.5" : "justify-between px-3 py-2.5"
                      } ${
                        reducedMotion ? "" : "transition-all duration-200 ease-in-out"
                      } ${
                        activeSection === section
                          ? isDarkMode
                            ? "border-white/10 bg-white/[0.08] text-white shadow-[0_10px_26px_-22px_rgba(124,58,237,0.9)]"
                            : "border-gray-200 bg-gray-950/[0.05] text-gray-950 shadow-sm"
                          : isDarkMode
                            ? "border-transparent text-gray-300 hover:bg-white/[0.06] hover:text-white"
                            : "border-transparent text-gray-700 hover:bg-gray-100 hover:text-gray-950"
                      } focus:outline-none focus:ring-2 focus:ring-purple-500/50`}
                      aria-expanded={hasSubs && !compact ? isExpanded : undefined}
                      aria-controls={hasSubs && !compact ? controlsId : undefined}
                      aria-current={isActiveSection ? "page" : undefined}
                      title={section}
                      type="button"
                    >
                      {activeSection === section ? (
                        <span
                          className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-indigo-500 via-purple-500 to-pink-500"
                          aria-hidden="true"
                        />
                      ) : null}

                      <div
                        className={`relative z-10 flex min-w-0 items-center ${
                          compact ? "justify-center" : "gap-2.5"
                        }`}
                      >
                        <span
                          className={`shrink-0 text-[15px] ${
                            reducedMotion ? "" : "transition-transform duration-200"
                          } ${activeSection === section ? "scale-105" : "group-hover:scale-105"}`}
                        >
                          {def.icon}
                        </span>

                        {!compact ? (
                          <span className="truncate font-semibold leading-none">{section}</span>
                        ) : null}
                      </div>

                      {hasSubs && !compact ? (
                        <FaChevronDown
                          className={`relative z-10 text-[11px] ${
                            reducedMotion ? "" : "transition-transform duration-300"
                          } ${isExpanded ? "rotate-180" : ""}`}
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
            </div>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          className={`group flex items-center ${
            compact ? "justify-center px-3 py-3" : "justify-center gap-3 px-4 py-3.5"
          } ${
            reducedMotion ? "" : "transition-all duration-200"
          } relative overflow-hidden border-t ${
            isDarkMode
              ? "border-white/10 text-gray-300 hover:bg-white/[0.06] hover:text-white"
              : "border-gray-100 text-gray-700 hover:bg-gray-50 hover:text-gray-950"
          } focus:outline-none focus:ring-2 focus:ring-purple-500/50`}
          aria-label="Logout"
          title="Logout"
          type="button"
        >
          <FaSignOutAlt
            className={`relative z-10 text-base ${
              reducedMotion ? "" : "transition-transform duration-200 group-hover:-translate-x-1"
            }`}
          />

          {!compact ? <span className="relative z-10 text-sm font-semibold">Logout</span> : null}
        </button>
      </aside>

      <JetskyModal isOpen={showJetsky} onClose={() => setShowJetsky(false)} isDarkMode={isDarkMode} />
    </>
  )
}