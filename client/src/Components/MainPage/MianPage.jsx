"use client"

import { forwardRef, useEffect, useMemo, useRef, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useNavigate } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Cancel01Icon,
  ChevronDownIcon,
  DeliveryTruck01Icon,
  File01Icon,
  Home01Icon,
  Layers01Icon,
  Search01Icon,
  Logout03Icon,
} from "@hugeicons/core-free-icons"
import suitelogo from "../../assets/logo/textsuitelogo.png"
import accountingIcon from "../../assets/icon-pack/accounting.png"
import administrationIcon from "../../assets/icon-pack/administration.png"
import crmIcon from "../../assets/icon-pack/crm.png"
import inventoryIcon from "../../assets/icon-pack/inventory.png"
import payrollIcon from "../../assets/icon-pack/payroll.png"
import purchaseIcon from "../../assets/icon-pack/purchase.png"
import posIcon from "../../assets/icon-pack/pos.png"
import salesIcon from "../../assets/icon-pack/sales.png"
import supplierIcon from "../../assets/icon-pack/supplier.png"
import { canAccessModule, getModuleBasePath, MODULES } from "../Navigation/moduleConfig"
import { getJwtExpirationMs } from "../Auth/authRouting"
import { signOut } from "../../Redux/UserSlice/UserSlice"

const cn = (...classes) => classes.filter(Boolean).join(" ")

const navigationTabs = [
  {
    id: "my-modules",
    label: "My Modules",
  },
  {
    id: "all",
    label: "All",
  },
  {
    id: "sales",
    label: "Sales",
    category: "Sales",
  },
  {
    id: "operations",
    label: "Operations",
    category: "Operations",
  },
  {
    id: "finance",
    label: "Finance",
    category: "Finance",
  },
  {
    id: "website",
    label: "Website",
    category: "Website",
  },
]

const modules = [
  {
    id: "payroll",
    name: "HR Payroll",
    category: "Finance",
    status: "active",
    subscribed: true,
    route: "/admin/payroll",
    image: payrollIcon,
    tone: "indigo",
  },
  {
    id: "crm",
    name: "CRM",
    category: "Sales",
    status: "active",
    subscribed: true,
    route: "/admin/leads",
    image: crmIcon,
    tone: "sky",
  },
  {
    id: "inventory",
    name: "Inventory",
    category: "Operations",
    status: "active",
    subscribed: true,
    route: "/admin/inventory",
    image: inventoryIcon,
    tone: "emerald",
  },
  {
    id: "accounting",
    name: "Accounting",
    category: "Finance",
    status: "active",
    subscribed: true,
    route: "/admin/accounting",
    image: accountingIcon,
    tone: "amber",
  },
  {
    id: "sales",
    name: "Sales",
    category: "Sales",
    status: "upcoming",
    subscribed: false,
    route: "/admin/sales",
    image: salesIcon,
    tone: "cyan",
  },
  {
    id: "administration",
    name: "Administration",
    category: "Operations",
    status: "active",
    subscribed: true,
    route: "/admin/administration",
    image: administrationIcon,
    tone: "slate",
  },
  {
    id: "pos",
    name: "POS",
    category: "Sales",
    status: "active",
    subscribed: false,
    route: "/admin/pos",
    image: posIcon,
    tone: "violet",
  },
  {
    id: "purchase",
    name: "Purchase",
    category: "Operations",
    status: "active",
    subscribed: true,
    route: "/admin/purchase",
    image: purchaseIcon,
    tone: "orange",
  },
  {
    id: "supplier",
    name: "Supplier",
    category: "Operations",
    status: "active",
    subscribed: false,
    route: "/admin/supplier",
    image: supplierIcon,
    tone: "emerald",
  },
  {
    id: "fleet",
    name: "Fleet",
    category: "Operations",
    status: "maintenance",
    subscribed: false,
    route: "/admin/fleet",
    icon: DeliveryTruck01Icon,
    tone: "slate",
  },
  {
    id: "projects",
    name: "Projects",
    category: "Operations",
    status: "upcoming",
    subscribed: false,
    route: "/admin/projects",
    icon: Layers01Icon,
    tone: "fuchsia",
  },
  {
    id: "website",
    name: "Website",
    category: "Website",
    status: "active",
    subscribed: false,
    route: "/admin/website",
    icon: Home01Icon,
    tone: "blue",
  },
  {
    id: "documents",
    name: "Documents",
    category: "Operations",
    status: "upcoming",
    subscribed: false,
    route: "/admin/documents",
    icon: File01Icon,
    tone: "lime",
  },
]

const iconTones = {
  indigo: "bg-indigo-600 text-white shadow-indigo-600/20",
  sky: "bg-sky-500 text-white shadow-sky-500/20",
  emerald: "bg-emerald-500 text-white shadow-emerald-500/20",
  violet: "bg-violet-600 text-white shadow-violet-600/20",
  amber: "bg-amber-500 text-white shadow-amber-500/20",
  cyan: "bg-cyan-500 text-white shadow-cyan-500/20",
  orange: "bg-orange-500 text-white shadow-orange-500/20",
  slate: "bg-slate-600 text-white shadow-slate-600/20",
  fuchsia: "bg-fuchsia-600 text-white shadow-fuchsia-600/20",
  blue: "bg-blue-600 text-white shadow-blue-600/20",
  lime: "bg-lime-600 text-white shadow-lime-600/20",
}

const statusStyles = {
  active: {
    label: "Active",
    badge:
      "border-emerald-200/90 bg-emerald-50/90 text-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]",
    dot:
      "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.11)]",
  },
  maintenance: {
    label: "Maintenance",
    badge:
      "border-rose-200/90 bg-rose-50/90 text-rose-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]",
    dot:
      "bg-rose-500 shadow-[0_0_0_3px_rgba(244,63,94,0.11)]",
  },
  upcoming: {
    label: "Upcoming",
    badge:
      "border-amber-200/90 bg-amber-50/90 text-amber-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]",
    dot:
      "bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.11)]",
  },
}

function PageStyles() {
  return (
    <style>{`
      .no-scrollbar::-webkit-scrollbar {
        display: none;
      }

      .no-scrollbar {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
    `}</style>
  )
}

function openModule(module, onOpenModule) {
  if (!module || module.status !== "active") return

  if (typeof onOpenModule === "function") {
    onOpenModule(module)
    return
  }

  if (typeof window !== "undefined" && module.route) {
    window.location.assign(module.route)
  }
}

function StatusBadge({ status }) {
  const style = statusStyles[status] || statusStyles.active

  return (
    <span
      className={cn(
        `
          inline-flex min-h-7 items-center gap-1.5 rounded-full border
          px-2.5 py-1 text-[9px] font-black uppercase
          tracking-[0.06em] backdrop-blur-sm
          sm:text-[9.5px]
        `,
        style.badge
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          style.dot
        )}
        aria-hidden="true"
      />

      <span>{style.label}</span>
    </span>
  )
}

const ModuleTile = forwardRef(function ModuleTile({
  module,
  index,
  subscribed,
  subscribing,
  onOpen,
  onSubscribe,
}, ref) {
  const moduleIcon = module.icon
  const iconStyle = iconTones[module.tone] || iconTones.indigo

  const canOpen = subscribed && module.status === "active"

  const handleCardClick = () => {
    if (canOpen) {
      onOpen(module)
    }
  }

  const handleCardKeyDown = (event) => {
    if (!canOpen) return

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onOpen(module)
    }
  }

  const handleSubscribe = (event) => {
    event.stopPropagation()
    onSubscribe(module)
  }

  return (
    <motion.article
      ref={ref}
      layout
      initial={{
        opacity: 0,
        y: 14,
        scale: 0.985,
      }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
      }}
      exit={{
        opacity: 0,
        y: 8,
        scale: 0.975,
      }}
      transition={{
        duration: 0.24,
        delay: Math.min(index * 0.025, 0.16),
        ease: [0.22, 1, 0.36, 1],
      }}
      whileTap={canOpen ? { scale: 0.988 } : undefined}
      role={canOpen ? "button" : undefined}
      tabIndex={canOpen ? 0 : -1}
      aria-label={canOpen ? `Open ${module.name}` : undefined}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      className={cn(
        `
          group relative flex min-h-[204px] flex-col overflow-hidden
          rounded-[26px] border bg-white px-4 pb-4 pt-4 text-center
          shadow-[0_12px_32px_-27px_rgba(15,23,42,0.42)]
          transition-[transform,border-color,box-shadow] duration-300
          focus:outline-none focus-visible:border-indigo-300
          focus-visible:ring-4 focus-visible:ring-indigo-100
          sm:min-h-[218px] sm:px-5 sm:pb-5 sm:pt-5
        `,
        canOpen
          ? `
              cursor-pointer border-slate-200/90
              hover:-translate-y-1.5 hover:border-indigo-200
              hover:shadow-[0_24px_48px_-31px_rgba(79,70,229,0.28)]
            `
          : `
              cursor-default border-slate-200/80
              hover:-translate-y-0.5 hover:border-slate-300
              hover:shadow-[0_20px_40px_-31px_rgba(15,23,42,0.27)]
            `
      )}
    >
      <span
        className="
          pointer-events-none absolute inset-x-10 top-0 h-px
          bg-gradient-to-r from-transparent via-indigo-300/65
          to-transparent opacity-0 transition-opacity duration-300
          group-hover:opacity-100
        "
        aria-hidden="true"
      />

      <span
        className="
          pointer-events-none absolute -right-16 -top-16
          h-32 w-32 rounded-full bg-indigo-50/60 blur-3xl
          transition duration-500 group-hover:bg-indigo-100/65
        "
        aria-hidden="true"
      />

      <div className="relative z-10 flex min-h-7 justify-end">
        <StatusBadge status={module.status} />
      </div>

      <div
        className={cn(
          `
            relative z-10 flex flex-1 flex-col
            items-center justify-center
          `,
          subscribed ? "pb-1 pt-1" : "pb-2 pt-1"
        )}
      >
        <span
          className="
            relative mb-4 flex h-[88px] w-[88px]
            transform-gpu items-center justify-center
            rounded-[27px] border border-slate-200/90
            bg-gradient-to-b from-white to-slate-50/90
            shadow-[0_16px_32px_-24px_rgba(15,23,42,0.48)]
            ring-1 ring-white
            transition-[transform,border-color,box-shadow]
            duration-200 ease-out
            will-change-transform
            [backface-visibility:hidden]
            group-hover:-translate-y-1
            group-hover:border-indigo-200/80
            group-hover:shadow-[0_20px_36px_-24px_rgba(79,70,229,0.3)]
            sm:h-[94px] sm:w-[94px] sm:rounded-[29px]
          "
        >
          <span
            className="
              pointer-events-none absolute inset-[6px] rounded-[21px]
              border border-white/90
            "
            aria-hidden="true"
          />

          {module.image ? (
            <span
              className="
                relative z-10 flex h-[66px] w-[66px]
                transform-gpu items-center justify-center
                transition-transform duration-200 ease-out
                will-change-transform
                [backface-visibility:hidden]
                group-hover:scale-[1.035]
                sm:h-[72px] sm:w-[72px]
              "
            >
              <img
                src={module.image}
                alt={`${module.name} logo`}
                className="
                  block h-full w-full select-none object-contain
                  drop-shadow-[0_10px_14px_rgba(15,23,42,0.12)]
                  [image-rendering:auto]
                "
                draggable={false}
              />
            </span>
          ) : (
            <span
              className={cn(
                `
                  relative z-10 flex h-[62px] w-[62px]
                  transform-gpu items-center justify-center
                  rounded-[20px] shadow-lg
                  transition-transform duration-200 ease-out
                  will-change-transform
                  [backface-visibility:hidden]
                  group-hover:scale-[1.035]
                  sm:h-[68px] sm:w-[68px] sm:rounded-[22px]
                `,
                iconStyle
              )}
            >
              <HugeiconsIcon
                icon={moduleIcon}
                size={30}
                color="currentColor"
                strokeWidth={1.7}
                aria-hidden="true"
              />
            </span>
          )}
        </span>

        <h2
          className="
            max-w-full truncate text-[16px] font-black
            tracking-[-0.03em] text-slate-900
            sm:text-[18px]
          "
        >
          {module.name}
        </h2>

        {subscribed && module.status !== "active" ? (
          <p className="mt-2 text-xs font-semibold text-slate-400">
            {module.status === "maintenance"
              ? "Temporarily unavailable"
              : "Available soon"}
          </p>
        ) : null}
      </div>

      {!subscribed ? (
        <button
          type="button"
          onClick={handleSubscribe}
          disabled={subscribing}
          className="
            relative z-10 mt-3 inline-flex min-h-11 w-full
            cursor-pointer items-center justify-center gap-2
            rounded-[14px] border border-indigo-200
            bg-indigo-50 px-3 text-sm font-extrabold
            text-indigo-700 transition duration-200
            hover:border-indigo-600 hover:bg-indigo-600
            hover:text-white hover:shadow-[0_10px_22px_-14px_rgba(79,70,229,0.75)]
            focus:outline-none focus-visible:ring-4
            focus-visible:ring-indigo-100
            disabled:cursor-not-allowed disabled:opacity-60
          "
        >
          {subscribing ? (
            "Subscribing..."
          ) : (
            <>
              <HugeiconsIcon
                icon={Add01Icon}
                size={16}
                color="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              />
              <span>Subscribe</span>
            </>
          )}
        </button>
      ) : null}
    </motion.article>
  )
})

function SectionHeader({ title, count, type = "default" }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <h2
          className="
            text-base font-black tracking-[-0.025em]
            text-slate-900 sm:text-lg
          "
        >
          {title}
        </h2>

        <span
          className={cn(
            `
              inline-flex min-w-6 items-center justify-center
              rounded-full px-2 py-0.5 text-xs font-extrabold
            `,
            type === "available"
              ? "border border-slate-200 bg-white text-slate-600 shadow-sm"
              : "border border-indigo-100 bg-indigo-50 text-indigo-700 shadow-sm"
          )}
        >
          {count}
        </span>
      </div>
    </div>
  )
}

function ModuleGrid({
  items,
  subscribedIds,
  subscribingId,
  onOpen,
  onSubscribe,
}) {
  return (
    <motion.div
      layout
      className="
        grid grid-cols-1 gap-4
        min-[420px]:grid-cols-2
        sm:grid-cols-3 sm:gap-5
        lg:grid-cols-4
        xl:grid-cols-5
        2xl:grid-cols-6
      "
    >
      <AnimatePresence mode="popLayout">
        {items.map((module, index) => (
          <ModuleTile
            key={module.id}
            module={module}
            index={index}
            subscribed={subscribedIds.has(module.id)}
            subscribing={subscribingId === module.id}
            onOpen={onOpen}
            onSubscribe={onSubscribe}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  )
}

function EmptyState({ isMyModules, onReset }) {
  return (
    <div
      className="
        flex min-h-[300px] flex-col items-center justify-center
        rounded-[28px] border border-dashed border-slate-300
        bg-white px-6 text-center
        shadow-[0_12px_34px_-28px_rgba(15,23,42,0.4)]
      "
    >
      <div
        className="
          flex h-14 w-14 items-center justify-center rounded-2xl
          border border-slate-200 bg-slate-50 text-slate-500
        "
      >
        <HugeiconsIcon
          icon={Search01Icon}
          size={21}
          color="currentColor"
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </div>

      <h2 className="mt-4 text-base font-extrabold text-slate-900">
        {isMyModules
          ? "No subscribed modules found"
          : "No modules found"}
      </h2>

      <button
        type="button"
        onClick={onReset}
        className="
          mt-4 cursor-pointer rounded-xl bg-indigo-600
          px-4 py-2.5 text-sm font-bold text-white
          transition hover:bg-indigo-700 focus:outline-none
          focus-visible:ring-4 focus-visible:ring-indigo-100
        "
      >
        Reset filters
      </button>
    </div>
  )
}

export default function OdooStyleModulesPage({
  onOpenModule,
  onSubscribeModule,
}) {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const currentUserRedux = useSelector((state) => state.user?.currentUser)
  const currentUser = useMemo(() => {
    let storedUser = null
    try {
      storedUser = JSON.parse(localStorage.getItem("user") || "null")
    } catch {
      storedUser = null
    }

    const resolved = currentUserRedux || storedUser
    return resolved?.user || resolved
  }, [currentUserRedux])
  const [avatarBroken, setAvatarBroken] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileMenuRef = useRef(null)
  const [query, setQuery] = useState("")
  const [activeTab, setActiveTab] = useState("my-modules")
  const [subscribingId, setSubscribingId] = useState(null)

  const accessibleIds = useMemo(
    () =>
      new Set(
        Object.keys(MODULES).filter((id) =>
          canAccessModule(currentUser, id)
        )
      ),
    [currentUser]
  )
  const [subscribedIds, setSubscribedIds] = useState(() => new Set())

  useEffect(() => {
    const token = localStorage.getItem("token")
    const expiresAt = getJwtExpirationMs(token)
    const invalidSession =
      !token ||
      (expiresAt !== null && expiresAt <= Date.now()) ||
      !currentUser?.isActive ||
      !["admin", "superadmin", "employee"].includes(currentUser.role)

    if (invalidSession) {
      navigate("/login", { replace: true })
      return
    }
    setSubscribedIds(new Set(accessibleIds))
  }, [accessibleIds, currentUser, navigate])

  useEffect(() => {
    if (!profileOpen) return undefined

    const closeOnOutsideClick = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) setProfileOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setProfileOpen(false)
    }

    document.addEventListener("mousedown", closeOnOutsideClick)
    document.addEventListener("keydown", closeOnEscape)
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick)
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [profileOpen])

  const filteredModules = useMemo(() => {
    const search = query.trim().toLowerCase()

    const selectedTab = navigationTabs.find(
      (tab) => tab.id === activeTab
    )

    return modules.filter((module) => {
      const isSubscribed = subscribedIds.has(module.id)

      const matchesSubscription =
        activeTab !== "my-modules" || isSubscribed

      const matchesCategory =
        !selectedTab?.category ||
        module.category === selectedTab.category

      const matchesSearch =
        !search ||
        module.name.toLowerCase().includes(search) ||
        module.category.toLowerCase().includes(search) ||
        module.status.toLowerCase().includes(search)

      return (
        matchesSubscription &&
        matchesCategory &&
        matchesSearch
      )
    })
  }, [activeTab, query, subscribedIds])

  const subscribedModules = useMemo(
    () =>
      filteredModules.filter((module) =>
        subscribedIds.has(module.id)
      ),
    [filteredModules, subscribedIds]
  )

  const availableModules = useMemo(
    () =>
      filteredModules.filter(
        (module) => !subscribedIds.has(module.id)
      ),
    [filteredModules, subscribedIds]
  )

  const resetFilters = () => {
    setQuery("")
    setActiveTab("my-modules")
  }

  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
    setQuery("")
  }

  const handleOpen = (module) => {
    if (!accessibleIds.has(module.id)) return
    if (typeof onOpenModule === "function") {
      openModule(module, onOpenModule)
      return
    }
    navigate(getModuleBasePath(currentUser?.role, module.id))
  }

  const handleSubscribe = async (module) => {
    if (MODULES[module.id] && !accessibleIds.has(module.id)) return
    if (subscribedIds.has(module.id) || subscribingId) {
      return
    }

    setSubscribingId(module.id)

    try {
      if (typeof onSubscribeModule === "function") {
        const result = await onSubscribeModule(module)

        if (result === false) {
          return
        }
      }

      setSubscribedIds((currentIds) => {
        const nextIds = new Set(currentIds)
        nextIds.add(module.id)
        return nextIds
      })
    } catch (error) {
      console.error("Unable to subscribe to module:", error)
    } finally {
      setSubscribingId(null)
    }
  }

  const hasModules = filteredModules.length > 0
  const isMyModules = activeTab === "my-modules"
  const displayName =
    currentUser?.name ||
    currentUser?.username ||
    currentUser?.email ||
    "User"

  const roleLabel =
    currentUser?.role === "superadmin"
      ? "Super Admin"
      : currentUser?.role === "admin"
        ? "Administrator"
        : currentUser?.role === "employee"
          ? "Employee"
          : currentUser?.role || "Member"

  const profileImageUrl =
    currentUser?.avatarUrl ||
    currentUser?.profileImage ||
    currentUser?.image ||
    currentUser?.avatar ||
    ""

  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"

  const handleLogout = () => {
    localStorage.removeItem("user")
    localStorage.removeItem("token")
    dispatch(signOut())
    navigate("/login", { replace: true })
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <PageStyles />

      <section
        className="
          mx-auto w-full max-w-[1480px]
          px-4 pb-12 pt-7
          sm:px-6 sm:pb-16 sm:pt-10
          lg:px-8
        "
      >
        <header className="relative flex flex-col items-center pt-16 text-center sm:pt-0">
          <div
            ref={profileMenuRef}
            className="absolute right-0 top-0 z-30 text-left"
          >
            <button
              type="button"
              onClick={() => setProfileOpen((open) => !open)}
              className="
                group flex max-w-[230px] items-center gap-2.5
                rounded-xl px-1 py-1 text-left
                transition duration-200
                focus:outline-none focus-visible:ring-4
                focus-visible:ring-indigo-100
                sm:max-w-[280px] sm:gap-3
              "
              aria-label={`Open profile menu for ${displayName}`}
              aria-expanded={profileOpen}
              aria-haspopup="menu"
            >
              <span
                className="
                  relative flex h-10 w-10 shrink-0 items-center
                  justify-center rounded-full
                  bg-gradient-to-br from-indigo-100 to-violet-100
                  text-sm font-black text-indigo-700
                  shadow-[0_8px_20px_-12px_rgba(79,70,229,0.7)]
                  ring-2 ring-white outline outline-1 outline-slate-200
                  transition duration-200
                  group-hover:outline-indigo-200
                  sm:h-11 sm:w-11
                "
              >
                <span className="h-full w-full overflow-hidden rounded-full">
                  {profileImageUrl && !avatarBroken ? (
                    <img
                      src={profileImageUrl}
                      alt={`${displayName} profile`}
                      className="h-full w-full object-cover"
                      onError={() => setAvatarBroken(true)}
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center">
                      {initials}
                    </span>
                  )}
                </span>

                <span
                  className="
                    absolute bottom-0 right-0 h-3 w-3
                    rounded-full border-2 border-white bg-emerald-500
                    shadow-[0_0_0_2px_rgba(16,185,129,0.1)]
                  "
                  aria-label="Online"
                  title="Online"
                />
              </span>

              <span className="min-w-0">
                <span
                  className="
                    block max-w-[118px] truncate
                    text-[12px] font-extrabold leading-tight
                    text-slate-900 transition-colors
                    group-hover:text-indigo-700
                    sm:max-w-[165px] sm:text-[13px]
                  "
                >
                  {displayName}
                </span>

                <span
                  className="
                    mt-1 block max-w-[118px] truncate
                    text-[10px] font-semibold leading-none
                    text-slate-400
                    sm:max-w-[165px] sm:text-[11px]
                  "
                >
                  {roleLabel}
                </span>
              </span>

              <span
                className={cn(
                  `
                    flex h-7 w-7 shrink-0 items-center justify-center
                    text-slate-400 transition duration-200
                    group-hover:text-indigo-600
                  `,
                  profileOpen && "rotate-180 text-indigo-600"
                )}
              >
                <HugeiconsIcon
                  icon={ChevronDownIcon}
                  size={16}
                  color="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </span>
            </button>

            <AnimatePresence>
              {profileOpen ? (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -5, scale: 0.98 }}
                  transition={{
                    duration: 0.17,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  role="menu"
                  className="
                    absolute right-0 mt-3 w-[290px]
                    origin-top-right overflow-hidden rounded-[22px]
                    border border-slate-200 bg-white
                    shadow-[0_24px_60px_-28px_rgba(15,23,42,0.48)]
                  "
                >
                  <div
                    className="
                      flex items-center gap-3 border-b border-slate-100
                      bg-gradient-to-b from-slate-50/80 to-white
                      px-4 py-4
                    "
                  >
                    <span
                      className="
                        relative flex h-12 w-12 shrink-0 items-center
                        justify-center overflow-visible rounded-2xl
                        bg-gradient-to-br from-indigo-100 to-violet-100
                        text-sm font-black text-indigo-700
                        ring-1 ring-indigo-100
                      "
                    >
                      <span className="h-full w-full overflow-hidden rounded-[inherit]">
                        {profileImageUrl && !avatarBroken ? (
                          <img
                            src={profileImageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            onError={() => setAvatarBroken(true)}
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center">
                            {initials}
                          </span>
                        )}
                      </span>

                      <span
                        className="
                          absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5
                          rounded-full border-2 border-white bg-emerald-500
                        "
                        aria-hidden="true"
                      />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span
                        className="
                          block truncate text-sm font-extrabold
                          text-slate-900
                        "
                      >
                        {displayName}
                      </span>

                      <span
                        className="
                          mt-1 block truncate text-[11px]
                          font-bold text-indigo-600
                        "
                      >
                        {roleLabel}
                      </span>

                      <span
                        className="
                          mt-1 block truncate text-xs
                          font-medium text-slate-400
                        "
                      >
                        {currentUser?.email || "No email available"}
                      </span>
                    </span>
                  </div>

                  <div className="p-2">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="
                        group/logout flex w-full items-center gap-3
                        rounded-[14px] px-3 py-3 text-sm
                        font-extrabold text-rose-600
                        transition duration-200
                        hover:bg-rose-50
                        focus:outline-none
                        focus-visible:ring-2 focus-visible:ring-rose-200
                      "
                    >
                      <span
                        className="
                          flex h-9 w-9 shrink-0 items-center
                          justify-center rounded-xl bg-rose-50
                          text-rose-600 transition duration-200
                          group-hover/logout:bg-rose-100
                        "
                      >
                        <HugeiconsIcon
                          icon={Logout03Icon}
                          size={18}
                          color="currentColor"
                          strokeWidth={1.9}
                          aria-hidden="true"
                        />
                      </span>

                      <span className="flex-1 text-left">Logout</span>
                    </button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <div
            className="
              flex w-full items-center justify-center
              px-2
            "
          >
            <img
              src={suitelogo}
              alt="Business Hub Suite"
              className="
                h-auto w-auto max-w-[190px]
                select-none object-contain
                sm:max-w-[230px]
                lg:max-w-[250px]
              "
              draggable={false}
            />
          </div>

          <div
            className="
              mt-5 flex w-full max-w-[430px] items-center gap-2.5
              rounded-[18px] border border-slate-200 bg-white
              px-3.5 py-3
              shadow-[0_10px_30px_-25px_rgba(15,23,42,0.45)]
              transition duration-200
              focus-within:border-indigo-300
              focus-within:ring-4 focus-within:ring-indigo-100
            "
          >
            <HugeiconsIcon
              icon={Search01Icon}
              size={19}
              color="currentColor"
              strokeWidth={1.8}
              className="shrink-0 text-slate-400"
              aria-hidden="true"
            />

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search modules"
              aria-label="Search modules"
              className="
                w-full border-0 bg-transparent text-left
                text-sm font-semibold text-slate-800
                outline-none placeholder:font-medium
                placeholder:text-slate-400
              "
            />

            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="
                  flex h-8 w-8 shrink-0 cursor-pointer
                  items-center justify-center rounded-xl
                  text-slate-400 transition hover:bg-slate-100
                  hover:text-slate-700 focus:outline-none
                  focus-visible:ring-2 focus-visible:ring-indigo-300
                "
              >
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  size={17}
                  color="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </button>
            ) : null}
          </div>
        </header>

        <nav
          className="
            no-scrollbar mx-auto mt-5 flex max-w-max gap-2
            overflow-x-auto pb-1 sm:mt-6
          "
          aria-label="Module navigation"
        >
          {navigationTabs.map((tab) => {
            const active = activeTab === tab.id

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                aria-pressed={active}
                className={cn(
                  `
                    shrink-0 cursor-pointer rounded-full border
                    px-4 py-2.5 text-[13px] font-extrabold
                    transition duration-200 focus:outline-none
                    focus-visible:ring-4 focus-visible:ring-indigo-100
                    sm:px-5 sm:text-sm
                  `,
                  active
                    ? `
                        border-indigo-600 bg-indigo-600 text-white
                        shadow-sm shadow-indigo-600/20
                      `
                    : `
                        border-slate-200 bg-white text-slate-700
                        hover:border-slate-300 hover:text-slate-950
                      `
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>

        <div className="mt-8 sm:mt-10">
          {!hasModules ? (
            <EmptyState
              isMyModules={isMyModules}
              onReset={resetFilters}
            />
          ) : isMyModules ? (
            <ModuleGrid
              items={subscribedModules}
              subscribedIds={subscribedIds}
              subscribingId={subscribingId}
              onOpen={handleOpen}
              onSubscribe={handleSubscribe}
            />
          ) : (
            <div className="space-y-10">
              {subscribedModules.length > 0 ? (
                <section>
                  <SectionHeader
                    title="My Modules"
                    count={subscribedModules.length}
                  />

                  <ModuleGrid
                    items={subscribedModules}
                    subscribedIds={subscribedIds}
                    subscribingId={subscribingId}
                    onOpen={handleOpen}
                    onSubscribe={handleSubscribe}
                  />
                </section>
              ) : null}

              {availableModules.length > 0 ? (
                <section>
                  <SectionHeader
                    title="Available Modules"
                    count={availableModules.length}
                    type="available"
                  />

                  <ModuleGrid
                    items={availableModules}
                    subscribedIds={subscribedIds}
                    subscribingId={subscribingId}
                    onOpen={handleOpen}
                    onSubscribe={handleSubscribe}
                  />
                </section>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
