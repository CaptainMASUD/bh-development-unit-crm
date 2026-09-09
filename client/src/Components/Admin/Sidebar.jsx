// Sidebar.jsx
"use client"

import { useState, useEffect, useCallback, memo, useRef, useMemo, useId } from "react"
import { useNavigate } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeftDoubleIcon,
  BellIcon,
  Cancel01Icon,
  ChevronDownIcon,
  GridViewIcon,
  Logout03Icon,
  Moon02Icon,
  Search01Icon,
  Sun03Icon,
} from "@hugeicons/core-free-icons"
import { useDispatch } from "react-redux"
import { signOut } from "../../Redux/UserSlice/UserSlice"

import suitelogo from "../../assets/logo/suite.png"
const jetsky = "/jetsky.svg"
import JetskyModal from "./JetskyModal"
import NotificationModal from "./NotificationModal"

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

async function fetchNotificationUnreadCount({ signal } = {}) {
  const res = await fetch(`${API_BASE}/notifications/my?isRead=false&limit=1`, {
    headers: getAuthHeaders(),
    credentials: "include",
    signal,
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) throw new Error(data?.message || "Failed to fetch notification count")
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

  const setBtnRef = (element) => {
    if (element) buttonsRef.current.push(element)
  }

  const onKeyDown = (event) => {
    if (!isExpanded) return

    const keys = ["ArrowDown", "ArrowUp", "Home", "End"]
    if (!keys.includes(event.key)) return

    event.preventDefault()
    const currentIndex = buttonsRef.current.indexOf(document.activeElement)

    if (event.key === "ArrowDown") {
      buttonsRef.current[Math.min(currentIndex + 1, buttonsRef.current.length - 1)]?.focus()
    } else if (event.key === "ArrowUp") {
      buttonsRef.current[Math.max(currentIndex - 1, 0)]?.focus()
    } else if (event.key === "Home") {
      buttonsRef.current[0]?.focus()
    } else if (event.key === "End") {
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
          : `transition-[max-height,opacity] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] ${
              isExpanded ? "opacity-100" : "opacity-0"
            }`
      }`}
      style={{ maxHeight: isExpanded ? height ?? 0 : 0 }}
      role="region"
      aria-hidden={!isExpanded}
      aria-label={`${section} submenu`}
      onKeyDown={onKeyDown}
    >
      <div
        className={`relative ml-[21px] space-y-0.5 border-l py-1.5 pl-3 ${
          isDarkMode ? "border-white/10" : "border-slate-200"
        }`}
      >
        {Object.keys(subcategories).map((subcategory) => {
          const isActive = activeSection === section && activeSubcategory === subcategory

          return (
            <button
              key={subcategory}
              ref={setBtnRef}
              onClick={() => handleSubcategoryClick(section, subcategory)}
              className={`group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium ${
                reducedMotion ? "" : "transition-colors duration-150"
              } focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 ${
                isActive
                  ? isDarkMode
                    ? "bg-white/[0.08] text-white"
                    : "bg-slate-100 text-slate-950"
                  : isDarkMode
                    ? "text-slate-400 hover:bg-white/[0.05] hover:text-white"
                    : "text-slate-500 hover:bg-slate-100/80 hover:text-slate-900"
              }`}
              aria-current={isActive ? "page" : undefined}
              type="button"
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  isActive ? "bg-indigo-500" : isDarkMode ? "bg-slate-600" : "bg-slate-300"
                }`}
              />
              <span className="truncate">{subcategory}</span>
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
  anchorElement,
  onSelect,
  onOpenSection,
  onClose,
  onPointerEnter,
  onPointerLeave,
  isDarkMode,
  reducedMotion,
  activeSection,
  activeSubcategory,
}) {
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.()
    }

    const onPointerDown = (event) => {
      const target = event.target
      const clickedPanel = panelRef.current?.contains(target)
      const clickedAnchor = anchorElement?.contains?.(target)

      if (!clickedPanel && !clickedAnchor) onClose?.()
    }

    window.addEventListener("keydown", onKeyDown)
    document.addEventListener("pointerdown", onPointerDown, true)

    return () => {
      window.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("pointerdown", onPointerDown, true)
    }
  }, [open, onClose, anchorElement])

  const items = Object.keys(subcategories || {})
  if (!open) return null

  return (
    <motion.div
      ref={panelRef}
      initial={reducedMotion ? false : { opacity: 0, x: -5, scale: 0.99 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={reducedMotion ? undefined : { opacity: 0, x: -4, scale: 0.99 }}
      transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed z-[99999] w-[248px] overflow-hidden rounded-xl border p-2 shadow-[0_20px_50px_-26px_rgba(15,23,42,.5)] ${
        isDarkMode
          ? "border-white/10 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-950"
      }`}
      style={{ top: `${top}px`, left: `${left}px` }}
      role="dialog"
      aria-label={`${section} navigation options`}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <span
        className={`pointer-events-none absolute -left-1.5 top-5 h-3 w-3 rotate-45 border-b border-l ${
          isDarkMode ? "border-white/10 bg-slate-950" : "border-slate-200 bg-white"
        }`}
        aria-hidden="true"
      />

      <div className="relative px-2.5 pb-2 pt-1.5">
        <p className="truncate text-sm font-semibold">{section}</p>
        <p className={`mt-0.5 text-xs ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
          {items.length ? `${items.length} option${items.length === 1 ? "" : "s"}` : "Open this page"}
        </p>
      </div>

      {items.length ? (
        <div className="relative max-h-[360px] space-y-0.5 overflow-y-auto">
          {items.map((subcategory) => {
            const isActive = activeSection === section && activeSubcategory === subcategory

            return (
              <button
                key={subcategory}
                type="button"
                onClick={() => onSelect(section, subcategory)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium ${
                  reducedMotion ? "" : "transition-colors duration-100"
                } focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 ${
                  isActive
                    ? isDarkMode
                      ? "bg-white/[0.09] text-white"
                      : "bg-indigo-50 text-indigo-700"
                    : isDarkMode
                      ? "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    isActive ? "bg-indigo-500" : isDarkMode ? "bg-slate-600" : "bg-slate-300"
                  }`}
                />
                <span className="truncate">{subcategory}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onOpenSection?.(section)}
          className={`relative flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium ${
            reducedMotion ? "" : "transition-colors duration-100"
          } focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 ${
            activeSection === section
              ? isDarkMode
                ? "bg-white/[0.09] text-white"
                : "bg-indigo-50 text-indigo-700"
              : isDarkMode
                ? "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
          }`}
        >
          <span>Open {section}</span>
          <HugeiconsIcon
            icon={ArrowLeftDoubleIcon}
            size={14}
            color="currentColor"
            strokeWidth={1.9}
            className="rotate-180"
            aria-hidden="true"
          />
        </button>
      )}
    </motion.div>
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
  moduleLabel,
  onOpenModules,
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

  const [flyout, setFlyout] = useState({
    open: false,
    section: "",
    top: 0,
    left: 0,
    anchorElement: null,
  })
  const openTimerRef = useRef(null)
  const closeTimerRef = useRef(null)

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
    setFlyout({ open: false, section: "", top: 0, left: 0, anchorElement: null })
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
          enabledModules: loggedInUser?.enabledModules || [],
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
          enabledModules: me?.enabledModules || [],
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
      let sessionUser = null
      try {
        sessionUser = JSON.parse(localStorage.getItem("user") || "null")
      } catch {
        sessionUser = null
      }

      // Deadline and lead-inbox notifications belong to the tenant CRM
      // workspace. The platform Super Admin shell must never issue tenant
      // operational requests, and companies without CRM must fail closed.
      const canUseCrmNotifications =
        sessionUser?.role !== "superadmin" &&
        Array.isArray(sessionUser?.enabledModules) &&
        sessionUser.enabledModules.includes("crm")

      if (abortNotifRef.current) abortNotifRef.current.abort()

      const controller = new AbortController()
      abortNotifRef.current = controller

      setNotifLoading(true)

      const [items, unread] = await Promise.all([
        canUseCrmNotifications
          ? fetchDeadlineNotifications({
              windowDays: 7,
              includeOverdue: true,
              limit: 500,
              signal: controller.signal,
            })
          : Promise.resolve([]),
        fetchNotificationUnreadCount({ signal: controller.signal }),
      ])

      setNotifCount7d((Array.isArray(items) ? items.length : 0) + Number(unread || 0))
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
    if (moduleLabel) return [{ title: moduleLabel, sections: filteredSectionKeys }]
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
  }, [filteredSectionKeys, moduleLabel])

  const shouldRingBell = !reducedMotion && notifCount7d > 0 && showBellTip && !isMobileViewport
  const crmNotificationsEnabled =
    user?.role !== "superadmin" &&
    Array.isArray(user?.enabledModules) &&
    user.enabledModules.includes("crm")
  const initials = getInitials(user?.username)

  const asideWidth = compact ? "w-[76px]" : "w-[260px]"
  const navPad = compact ? "px-2.5" : "px-3"

  const clearFlyoutTimers = useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current)
      openTimerRef.current = null
    }

    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const closeFlyout = useCallback(() => {
    clearFlyoutTimers()
    setFlyout({ open: false, section: "", top: 0, left: 0, anchorElement: null })
  }, [clearFlyoutTimers])

  const scheduleFlyoutClose = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)

    closeTimerRef.current = setTimeout(() => {
      setFlyout({ open: false, section: "", top: 0, left: 0, anchorElement: null })
      closeTimerRef.current = null
    }, 150)
  }, [])

  const keepFlyoutOpen = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const openFlyout = useCallback(
    (section, anchorEl, immediate = false) => {
      if (!anchorEl) return

      clearFlyoutTimers()

      const show = () => {
        const rect = anchorEl.getBoundingClientRect()
        const desiredTop = rect.top - 8
        const estimatedHeight = safeSections?.[section]?.subcategories ? 280 : 104
        const maxTop = window.innerHeight - estimatedHeight - 12
        const top = clamp(desiredTop, 12, Math.max(12, maxTop))
        const left = rect.right + 10

        setFlyout({
          open: true,
          section,
          top,
          left,
          anchorElement: anchorEl,
        })
      }

      if (immediate) {
        show()
        return
      }

      openTimerRef.current = setTimeout(() => {
        show()
        openTimerRef.current = null
      }, 70)
    },
    [clearFlyoutTimers, safeSections]
  )

  useEffect(() => {
    return () => clearFlyoutTimers()
  }, [clearFlyoutTimers])

  const openDirectSection = useCallback(
    (section) => {
      setActiveSection(section)
      setActiveSubcategory("")
      closeFlyout()

      if (isMobile) toggleSidebar()
    },
    [setActiveSection, setActiveSubcategory, closeFlyout, isMobile, toggleSidebar]
  )

  const handleSectionClick = useCallback(
    (section, anchorEl) => {
      const def = safeSections?.[section]
      if (!def) return

      const hasSubs = !!def.subcategories

      if (!isMobileViewport && compact && hasSubs) {
        openFlyout(section, anchorEl, true)
        return
      }

      if (hasSubs) {
        toggleSection(section)
      } else {
        openDirectSection(section)
      }
    },
    [
      safeSections,
      compact,
      isMobileViewport,
      openFlyout,
      toggleSection,
      openDirectSection,
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
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(10deg); }
          40% { transform: rotate(-10deg); }
          60% { transform: rotate(7deg); }
          80% { transform: rotate(-7deg); }
        }

        .bell-ring {
          transform-origin: 50% 10%;
          animation: bellRing 0.72s cubic-bezier(.22,.61,.36,1) 2;
          will-change: transform;
        }

        .bh-icon-button {
          transform: translate3d(0, 0, 0);
          backface-visibility: hidden;
          -webkit-font-smoothing: antialiased;
          transition-property: transform, background-color, border-color, color;
          transition-duration: 120ms;
          transition-timing-function: cubic-bezier(.2,.8,.2,1);
        }

        .bh-icon-button:hover {
          transform: translate3d(0, -1px, 0);
        }

        .bh-icon-button:active {
          transform: translate3d(0, 0, 0) scale(.97);
          transition-duration: 70ms;
        }

        .bh-icon-glyph {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transform: translateZ(0);
          backface-visibility: hidden;
          transition: transform 120ms cubic-bezier(.2,.8,.2,1);
        }

        .bh-icon-button:hover .bh-icon-glyph {
          transform: translateZ(0) scale(1.04);
        }

        .bh-action-button {
          transform: translate3d(0, 0, 0);
          backface-visibility: hidden;
          transition-property: transform, background-color, border-color, color;
          transition-duration: 140ms;
          transition-timing-function: cubic-bezier(.2,.8,.2,1);
        }

        .bh-action-button:hover {
          transform: translate3d(0, -1px, 0);
        }

        .bh-action-button:active {
          transform: translate3d(0, 0, 0) scale(.985);
          transition-duration: 80ms;
        }

        @media (prefers-reduced-motion: reduce) {
          .bell-ring {
            animation: none;
            will-change: auto;
          }

          .bh-icon-button,
          .bh-icon-glyph,
          .bh-action-button {
            transform: none !important;
            transition: none !important;
          }
        }

        .bh-sidebar-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(148, 163, 184, .35) transparent;
        }

        .bh-sidebar-scrollbar::-webkit-scrollbar {
          width: 5px;
        }

        .bh-sidebar-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }

        .bh-sidebar-scrollbar::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: rgba(148, 163, 184, .35);
        }
      `}</style>

      <AnimatePresence>
        {!isMobileViewport && showBellTip && notifCount7d > 0 ? (
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, x: -8, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -4, scale: 0.98 }}
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
              className={`relative w-[290px] rounded-xl border px-4 py-3 shadow-[0_22px_55px_-28px_rgba(15,23,42,.45)] ${
                isDarkMode
                  ? "border-white/10 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-900"
              }`}
            >
              <p className="text-sm font-semibold">
                {notifCount7d} notification{notifCount7d === 1 ? "" : "s"}
              </p>
              <p className={`mt-1 text-xs leading-5 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Open notifications to review pending activity.
              </p>
              <span
                className={`absolute left-[-6px] top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border-b border-l ${
                  isDarkMode ? "border-white/10 bg-slate-950" : "border-slate-200 bg-white"
                }`}
                aria-hidden="true"
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {isMobile && isOpen ? (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            type="button"
            className="fixed inset-0 z-30 bg-slate-950/35 backdrop-blur-[2px]"
            onClick={toggleSidebar}
            aria-label="Close sidebar"
          />
        ) : null}
      </AnimatePresence>

      <NotificationModal
        open={showNotifications}
        onClose={() => setShowNotifications(false)}
        isDarkMode={isDarkMode}
        crmEnabled={crmNotificationsEnabled}
      />

      <AnimatePresence>
        {!isMobileViewport && compact && flyout.open ? (
          <FlyoutSubmenu
            open={flyout.open}
            top={flyout.top}
            left={flyout.left}
            section={flyout.section}
            subcategories={safeSections?.[flyout.section]?.subcategories || {}}
            anchorElement={flyout.anchorElement}
            onSelect={handleSubcategoryClick}
            onOpenSection={openDirectSection}
            onClose={closeFlyout}
            onPointerEnter={keepFlyoutOpen}
            onPointerLeave={scheduleFlyoutClose}
            isDarkMode={isDarkMode}
            reducedMotion={reducedMotion}
            activeSection={activeSection}
            activeSubcategory={activeSubcategory}
          />
        ) : null}
      </AnimatePresence>

      <aside
        id={sidebarId}
        className={`${asideWidth} flex h-[100dvh] min-w-0 flex-col overflow-hidden border-r ${
          isDarkMode
            ? "border-white/10 bg-slate-950 text-white"
            : "border-slate-200/80 bg-[#fbfcfe] text-slate-900"
        } ${isMobile ? "fixed left-0 top-0 z-40 shadow-2xl" : "sticky top-0"} ${
          reducedMotion ? "" : "transition-[width,transform] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
        } ${isMobile && !isOpen ? "-translate-x-full" : "translate-x-0"}`}
        aria-label="Sidebar navigation"
      >
        {/* Brand and top actions */}
        <div
          className={`shrink-0 border-b ${
            isDarkMode ? "border-white/10" : "border-slate-200/75"
          } ${
            compact
              ? "flex h-[108px] flex-col items-center justify-center gap-2 px-2"
              : "flex h-[68px] items-center justify-between gap-3 px-3"
          }`}
        >
          {compact ? (
            <>
              <button
                type="button"
                onClick={toggleCompact}
                className={`bh-icon-button flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border shadow-sm ${
                  isDarkMode
                    ? "border-white/10 bg-white text-slate-950"
                    : "border-indigo-100 bg-white text-indigo-700"
                } focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30`}
                title="Expand BH SUITE sidebar"
                aria-label="Expand BH SUITE sidebar"
              >
                <img
                  src={suitelogo}
                  alt="BH SUITE"
                  className="h-8 w-8 object-contain"
                  draggable={false}
                />
              </button>

              <button
                ref={bellBtnRef}
                type="button"
                onClick={() => {
                  dismissBellTip()
                  setShowNotifications(true)
                }}
                className={`bh-icon-button relative flex h-9 w-9 items-center justify-center rounded-xl border ${
                  isDarkMode
                    ? "border-white/10 bg-white/[0.06] text-slate-300 hover:bg-white/[0.1] hover:text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                } focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30`}
                aria-label="Open notifications"
                title="Notifications"
              >
                <span className="bh-icon-glyph">
                  <span className={shouldRingBell ? "bell-ring" : ""}>
                    <HugeiconsIcon icon={BellIcon} size={16} color="currentColor" strokeWidth={1.9} />
                  </span>
                </span>
                {notifCount7d > 0 ? (
                  <span
                    className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[8px] font-bold text-white shadow-sm"
                    style={{ backgroundColor: NOTIF_BADGE_COLOR }}
                  >
                    {notifCount7d > 99 ? "99+" : notifCount7d}
                  </span>
                ) : null}
                {notifLoading ? (
                  <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-indigo-400" />
                ) : null}
              </button>
            </>
          ) : (
            <>
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border shadow-sm ${
                    isDarkMode
                      ? "border-white/10 bg-white"
                      : "border-indigo-100 bg-white"
                  }`}
                >
                  <img
                    src={suitelogo}
                    alt="BH SUITE"
                    className="h-8 w-8 object-contain"
                    draggable={false}
                  />
                </span>

                <div className="min-w-0">
                  <p className="truncate text-[15px] font-extrabold tracking-[-0.025em]">
                    BH SUITE
                  </p>
                  <p
                    className={`truncate text-[10px] font-medium ${
                      isDarkMode ? "text-slate-500" : "text-slate-400"
                    }`}
                  >
                    Business Hub ERP
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  ref={bellBtnRef}
                  type="button"
                  onClick={() => {
                    dismissBellTip()
                    setShowNotifications(true)
                  }}
                  className={`bh-icon-button relative flex h-9 w-9 items-center justify-center rounded-xl border ${
                    isDarkMode
                      ? "border-white/10 bg-white/[0.06] text-slate-300 hover:bg-white/[0.1] hover:text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                  } focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30`}
                  aria-label="Open notifications"
                  title="Notifications"
                >
                  <span className="bh-icon-glyph">
                    <span className={shouldRingBell ? "bell-ring" : ""}>
                      <HugeiconsIcon icon={BellIcon} size={16} color="currentColor" strokeWidth={1.9} />
                    </span>
                  </span>
                  {notifCount7d > 0 ? (
                    <span
                      className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[8px] font-bold text-white shadow-sm"
                      style={{ backgroundColor: NOTIF_BADGE_COLOR }}
                    >
                      {notifCount7d > 99 ? "99+" : notifCount7d}
                    </span>
                  ) : null}
                  {notifLoading ? (
                    <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-indigo-400" />
                  ) : null}
                </button>

                <button
                  onClick={isMobileViewport ? toggleSidebar : toggleCompact}
                  type="button"
                  className={`bh-icon-button flex h-9 w-9 items-center justify-center rounded-xl border ${
                    isDarkMode
                      ? "border-white/10 text-slate-400 hover:bg-white/[0.06] hover:text-white"
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  } focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30`}
                  aria-label={isMobileViewport ? "Close sidebar" : "Collapse sidebar"}
                  title={isMobileViewport ? "Close" : "Collapse"}
                >
                  <span className="bh-icon-glyph">
                    <HugeiconsIcon
                      icon={isMobileViewport ? Cancel01Icon : ArrowLeftDoubleIcon}
                      size={15}
                      color="currentColor"
                      strokeWidth={1.9}
                    />
                  </span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Search and module switch */}
        <div className={`${compact ? "px-2.5" : "px-3"} pb-2 pt-3`}>
          {!compact ? (
            <div className="space-y-2">
              <div className="group relative">
                <HugeiconsIcon
                  icon={Search01Icon}
                  size={15}
                  color="currentColor"
                  strokeWidth={1.9}
                  className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${
                    isDarkMode ? "text-slate-600" : "text-slate-400"
                  } group-focus-within:text-indigo-500`}
                />
                <input
                  type="search"
                  placeholder="Search menu"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className={`h-9 w-full rounded-lg border py-2 pl-9 pr-9 text-xs font-medium outline-none ${
                    isDarkMode
                      ? "border-white/10 bg-white/[0.04] text-white placeholder:text-slate-600 focus:border-indigo-400/40 focus:bg-white/[0.06]"
                      : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-indigo-300"
                  } ${reducedMotion ? "" : "transition-colors duration-150"} focus:ring-2 focus:ring-indigo-500/10`}
                  aria-label="Search sections"
                />
                {searchTerm ? (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className={`absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md ${
                      isDarkMode ? "text-slate-500 hover:bg-white/[0.06] hover:text-white" : "text-slate-400 hover:bg-slate-100"
                    }`}
                    aria-label="Clear search"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} size={13} color="currentColor" strokeWidth={2} />
                  </button>
                ) : null}
              </div>

              <button
                type="button"
                onClick={onOpenModules}
                className="bh-action-button group relative flex min-h-[56px] w-full items-center gap-3 overflow-hidden rounded-xl border border-violet-400/35 bg-violet-600 px-3 py-2.5 text-left text-white shadow-[0_14px_30px_-20px_rgba(109,40,217,.95)] hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                aria-label="Switch ERP module"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/15 transition-transform duration-200 group-hover:scale-105">
                  <HugeiconsIcon icon={GridViewIcon} size={17} color="currentColor" strokeWidth={1.9} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-semibold text-violet-100">Current module</span>
                  <span className="mt-0.5 block truncate text-xs font-bold">
                    {moduleLabel || "All modules"}
                  </span>
                </span>

                <span className="rounded-lg bg-white/15 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-white ring-1 ring-white/15">
                  Switch
                </span>
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  setCompact(false)
                  try {
                    localStorage.setItem("sidebar_compact", "0")
                  } catch {}
                  window.setTimeout(() => {
                    const input = document.querySelector(
                      `#${CSS.escape(sidebarId)} input[aria-label="Search sections"]`
                    )
                    input?.focus?.()
                  }, 0)
                }}
                className={`bh-icon-button mx-auto flex h-9 w-9 items-center justify-center rounded-lg ${
                  isDarkMode ? "text-slate-400 hover:bg-white/[0.06] hover:text-white" : "text-slate-500 hover:bg-slate-100"
                }`}
                aria-label="Search menu"
                title="Search"
              >
                <span className="bh-icon-glyph">
                  <HugeiconsIcon icon={Search01Icon} size={16} color="currentColor" strokeWidth={1.9} />
                </span>
              </button>
              <button
                type="button"
                onClick={onOpenModules}
                className="bh-icon-button mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-violet-400/35 bg-violet-600 text-white shadow-[0_12px_24px_-16px_rgba(109,40,217,.95)] hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
                aria-label="Switch ERP module"
                title={`Switch module: ${moduleLabel || "All modules"}`}
              >
                <span className="bh-icon-glyph">
                  <HugeiconsIcon icon={GridViewIcon} size={17} color="currentColor" strokeWidth={1.9} />
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav
          aria-label="Primary"
          className={`bh-sidebar-scrollbar flex-1 overflow-y-auto ${navPad} pb-3 pt-1`}
          onScroll={() => {
            if (compact && flyout.open) closeFlyout()
          }}
        >
          <AnimatePresence initial={false}>
            {groupedSectionBlocks.length ? (
              groupedSectionBlocks.map((group, groupIndex) => (
                <motion.div
                  key={group.title}
                  initial={reducedMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: groupIndex * 0.025 }}
                  className={compact ? "mb-2 space-y-1" : "mb-4 space-y-1"}
                >
                  {!compact ? (
                    <p
                      className={`px-2.5 pb-1 pt-1 text-[9.5px] font-semibold uppercase tracking-[0.13em] ${
                        isDarkMode ? "text-slate-600" : "text-slate-400"
                      }`}
                    >
                      {group.title}
                    </p>
                  ) : groupIndex > 0 ? (
                    <div className={`mx-auto my-2 h-px w-7 ${isDarkMode ? "bg-white/10" : "bg-slate-200"}`} />
                  ) : null}

                  {group.sections.map((section) => {
                    const definition = safeSections[section]
                    if (!definition) return null

                    const hasSubcategories = Boolean(definition.subcategories)
                    const isActive = activeSection === section
                    const isExpanded = expandedSection === section
                    const controlsId = hasSubcategories
                      ? `submenu-${section.replace(/\s+/g, "_")}`
                      : undefined

                    return (
                      <div key={section} className="select-none">
                        <motion.button
                          layout="position"
                          whileTap={reducedMotion ? undefined : { scale: 0.985 }}
                          onClick={(event) => handleSectionClick(section, event.currentTarget)}
                          onPointerEnter={(event) => {
                            if (!isMobileViewport && compact) {
                              openFlyout(section, event.currentTarget)
                            }
                          }}
                          onPointerLeave={() => {
                            if (!isMobileViewport && compact) scheduleFlyoutClose()
                          }}
                          onFocus={(event) => {
                            if (!isMobileViewport && compact) {
                              openFlyout(section, event.currentTarget, true)
                            }
                          }}
                          onBlur={(event) => {
                            if (
                              !isMobileViewport &&
                              compact &&
                              !flyout.anchorElement?.contains?.(event.relatedTarget)
                            ) {
                              scheduleFlyoutClose()
                            }
                          }}
                          onKeyDown={(event) => handleKeyToggle(event, section, event.currentTarget)}
                          className={`group relative flex h-9 w-full cursor-pointer items-center rounded-lg text-[13px] font-medium ${
                            compact ? "justify-center px-2" : "gap-2.5 px-2.5"
                          } ${
                            isActive
                              ? isDarkMode
                                ? "bg-white/[0.08] text-white"
                                : "bg-slate-100 text-slate-950"
                              : isDarkMode
                                ? "text-slate-400 hover:bg-white/[0.05] hover:text-white"
                                : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-950"
                          } ${reducedMotion ? "" : "transition-colors duration-150"} focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30`}
                          aria-expanded={hasSubcategories && !compact ? isExpanded : undefined}
                          aria-controls={hasSubcategories && !compact ? controlsId : undefined}
                          aria-current={isActive ? "page" : undefined}
                          title={compact ? undefined : section}
                          type="button"
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center ${
                              isActive ? (isDarkMode ? "text-white" : "text-slate-950") : ""
                            }`}
                          >
                            {definition.icon}
                          </span>

                          {!compact ? <span className="min-w-0 flex-1 truncate text-left">{section}</span> : null}

                          {compact && hasSubcategories ? (
                            <span
                              className={`absolute bottom-1.5 right-1.5 h-1.5 w-1.5 rounded-full ${
                                isActive ? "bg-indigo-400" : isDarkMode ? "bg-slate-600" : "bg-slate-300"
                              }`}
                              aria-hidden="true"
                            />
                          ) : null}

                          {hasSubcategories && !compact ? (
                            <HugeiconsIcon
                              icon={ChevronDownIcon}
                              size={14}
                              color="currentColor"
                              strokeWidth={1.9}
                              className={`${
                                reducedMotion ? "" : "transition-transform duration-200"
                              } ${isExpanded ? "rotate-180" : ""}`}
                              aria-hidden="true"
                            />
                          ) : null}
                        </motion.button>

                        {hasSubcategories && !compact ? (
                          <SubMenuInline
                            subcategories={definition.subcategories}
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
                </motion.div>
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`mx-1 rounded-lg border border-dashed p-3 text-center text-xs ${
                  isDarkMode ? "border-white/10 text-slate-500" : "border-slate-200 text-slate-400"
                }`}
              >
                {compact ? "—" : "No matching menu"}
              </motion.div>
            )}
          </AnimatePresence>
        </nav>

        {/* Account and utility controls */}
        <div className={`shrink-0 border-t p-3 ${isDarkMode ? "border-white/10" : "border-slate-200/75"}`}>
          {!compact ? (
            <div className="space-y-2">
              <div
                className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 ${
                  isDarkMode
                    ? "border-white/10 bg-white/[0.04]"
                    : "border-slate-200/80 bg-white"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl text-xs font-bold ${
                    isDarkMode ? "bg-white text-slate-950" : "bg-indigo-600 text-white"
                  }`}
                >
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt="Profile"
                      className="h-full w-full object-cover"
                      onError={(event) => {
                        event.currentTarget.style.display = "none"
                      }}
                    />
                  ) : (
                    initials
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">{user?.username || "User"}</p>
                  <p className={`truncate text-[10px] ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                    {user?.prettyRole || user?.role || "Account"}
                  </p>
                </div>

                <span className="h-2 w-2 rounded-full bg-emerald-500" title="Online" />
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className={`bh-icon-button flex h-9 items-center justify-center rounded-xl border ${
                    isDarkMode
                      ? "border-white/10 text-slate-400 hover:bg-white/[0.06] hover:text-white"
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                  aria-label="Toggle theme"
                  title="Toggle theme"
                >
                  <span className="bh-icon-glyph">
                    <HugeiconsIcon
                      icon={isDarkMode ? Sun03Icon : Moon02Icon}
                      size={16}
                      color="currentColor"
                      strokeWidth={1.9}
                    />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowJetsky(true)}
                  className={`bh-icon-button flex h-9 items-center justify-center rounded-xl border ${
                    isDarkMode
                      ? "border-white/10 hover:bg-white/[0.06]"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                  aria-label="Open Jetsky"
                  title="Jetsky"
                >
                  <span className="bh-icon-glyph">
                    <img
                      src={(jetsky && (jetsky.src || jetsky)) || "/jetsky.svg"}
                      alt="Jetsky"
                      className="h-5 w-5 select-none"
                      draggable={false}
                    />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className={`bh-icon-button flex h-9 items-center justify-center rounded-xl border ${
                    isDarkMode
                      ? "border-white/10 text-slate-400 hover:border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-300"
                      : "border-slate-200 bg-white text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                  }`}
                  aria-label="Logout"
                  title="Logout"
                >
                  <span className="bh-icon-glyph">
                    <HugeiconsIcon icon={Logout03Icon} size={16} color="currentColor" strokeWidth={1.9} />
                  </span>
                </button>
              </div>

              <p className={`pt-0.5 text-center text-[9px] ${isDarkMode ? "text-slate-700" : "text-slate-400"}`}>
                © {new Date().getFullYear()} BH SUITE
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl text-xs font-bold ${
                  isDarkMode ? "bg-white text-slate-950" : "bg-indigo-600 text-white"
                }`}
                title={user?.username || "User"}
              >
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </span>

              <button
                type="button"
                onClick={toggleTheme}
                className={`bh-icon-button flex h-9 w-9 items-center justify-center rounded-xl ${
                  isDarkMode
                    ? "text-slate-400 hover:bg-white/[0.06] hover:text-white"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
                aria-label="Toggle theme"
                title="Toggle theme"
              >
                <span className="bh-icon-glyph">
                  <HugeiconsIcon
                    icon={isDarkMode ? Sun03Icon : Moon02Icon}
                    size={16}
                    color="currentColor"
                    strokeWidth={1.9}
                  />
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowJetsky(true)}
                className={`bh-icon-button flex h-9 w-9 items-center justify-center rounded-xl ${
                  isDarkMode ? "hover:bg-white/[0.06]" : "hover:bg-slate-100"
                }`}
                aria-label="Open Jetsky"
                title="Jetsky"
              >
                <span className="bh-icon-glyph">
                  <img
                    src={(jetsky && (jetsky.src || jetsky)) || "/jetsky.svg"}
                    alt="Jetsky"
                    className="h-5 w-5 select-none"
                    draggable={false}
                  />
                </span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className={`bh-icon-button flex h-9 w-9 items-center justify-center rounded-xl ${
                  isDarkMode
                    ? "text-slate-400 hover:bg-rose-500/10 hover:text-rose-300"
                    : "text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                }`}
                aria-label="Logout"
                title="Logout"
              >
                <span className="bh-icon-glyph">
                  <HugeiconsIcon icon={Logout03Icon} size={16} color="currentColor" strokeWidth={1.9} />
                </span>
              </button>
            </div>
          )}
        </div>
      </aside>

      <JetskyModal
        isOpen={showJetsky}
        onClose={() => setShowJetsky(false)}
        isDarkMode={isDarkMode}
      />
    </>
  )
}
