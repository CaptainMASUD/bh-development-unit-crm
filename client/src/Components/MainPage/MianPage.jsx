"use client"

import { useEffect, useMemo, useState } from "react"
import { useSelector } from "react-redux"
import { useNavigate } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Cancel01Icon,
  ChartLineData01Icon,
  CreditCardIcon,
  DeliveryTruck01Icon,
  File01Icon,
  Home01Icon,
  Invoice01Icon,
  Layers01Icon,
  Package01Icon,
  Search01Icon,
  Settings01Icon,
  ShoppingBag01Icon,
  ShoppingCart01Icon,
  Tick01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import suitelogo from "../../assets/logo/logosuite.png"
import { canAccessModule, getModuleBasePath, MODULES } from "../Navigation/moduleConfig"
import { getJwtExpirationMs } from "../Auth/authRouting"

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
    icon: CreditCardIcon,
    tone: "indigo",
  },
  {
    id: "crm",
    name: "CRM",
    category: "Sales",
    status: "active",
    subscribed: true,
    route: "/admin/leads",
    icon: UserGroupIcon,
    tone: "sky",
  },
  {
    id: "inventory",
    name: "Inventory",
    category: "Operations",
    status: "upcoming",
    subscribed: false,
    route: "/admin/inventory",
    icon: Package01Icon,
    tone: "emerald",
  },
  {
    id: "accounting",
    name: "Accounting",
    category: "Finance",
    status: "active",
    subscribed: true,
    route: "/admin/accounting",
    icon: Invoice01Icon,
    tone: "amber",
  },
  {
    id: "sales",
    name: "Sales",
    category: "Sales",
    status: "upcoming",
    subscribed: false,
    route: "/admin/sales",
    icon: ChartLineData01Icon,
    tone: "cyan",
  },
  {
    id: "administration",
    name: "Administration",
    category: "Operations",
    status: "active",
    subscribed: true,
    route: "/admin/administration",
    icon: Settings01Icon,
    tone: "slate",
  },
  {
    id: "pos",
    name: "POS",
    category: "Sales",
    status: "active",
    subscribed: false,
    route: "/admin/pos",
    icon: ShoppingCart01Icon,
    tone: "violet",
  },
  {
    id: "purchase",
    name: "Purchase",
    category: "Operations",
    status: "upcoming",
    subscribed: false,
    route: "/admin/purchase",
    icon: ShoppingBag01Icon,
    tone: "orange",
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
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  maintenance: {
    label: "Maintenance",
    badge: "border-rose-200 bg-rose-50 text-rose-700",
    dot: "bg-rose-500",
  },
  upcoming: {
    label: "Upcoming",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
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
          inline-flex items-center gap-1.5 rounded-full border
          px-2.5 py-1 text-[10px] font-extrabold uppercase
          tracking-[0.04em] sm:text-[11px]
        `,
        style.badge
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />

      {style.label}
    </span>
  )
}

function ModuleTile({
  module,
  index,
  subscribed,
  subscribing,
  onOpen,
  onSubscribe,
}) {
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
      layout
      initial={{
        opacity: 0,
        y: 14,
        scale: 0.98,
      }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
      }}
      exit={{
        opacity: 0,
        y: 8,
        scale: 0.97,
      }}
      transition={{
        duration: 0.24,
        delay: Math.min(index * 0.025, 0.16),
        ease: [0.22, 1, 0.36, 1],
      }}
      whileTap={canOpen ? { scale: 0.985 } : undefined}
      role={canOpen ? "button" : undefined}
      tabIndex={canOpen ? 0 : -1}
      aria-label={canOpen ? `Open ${module.name}` : undefined}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      className={cn(
        `
          group relative flex min-h-[190px] flex-col overflow-hidden
          rounded-[26px] border bg-white px-4 pb-4 pt-5 text-center
          shadow-[0_10px_30px_-24px_rgba(15,23,42,0.42)]
          transition duration-300
          hover:-translate-y-1 hover:border-slate-300
          hover:shadow-[0_20px_42px_-26px_rgba(15,23,42,0.34)]
          focus:outline-none focus-visible:border-indigo-400
          focus-visible:ring-4 focus-visible:ring-indigo-100
          sm:min-h-[206px] sm:px-5
        `,
        canOpen ? "cursor-pointer border-slate-200" : "border-slate-200/80",
        !subscribed && "pb-4",
        subscribed && !canOpen && "cursor-default",
        !subscribed && "cursor-default"
      )}
    >
      <div className="absolute right-3 top-3 z-10">
        <StatusBadge status={module.status} />
      </div>

      {subscribed ? (
        <span
          className="
            absolute left-3 top-3 flex h-7 w-7 items-center
            justify-center rounded-full border border-indigo-100
            bg-indigo-50 text-indigo-600
          "
          title="Subscribed module"
          aria-label="Subscribed module"
        >
          <HugeiconsIcon
            icon={Tick01Icon}
            size={14}
            color="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          />
        </span>
      ) : null}

      <div
        className={cn(
          `
            flex flex-1 flex-col items-center justify-center pt-7
          `,
          !subscribed && "pb-2"
        )}
      >
        <span
          className="
            relative mb-4 flex h-[74px] w-[74px] items-center
            justify-center rounded-[24px] border border-slate-200
            bg-slate-50
            shadow-[0_10px_26px_-20px_rgba(15,23,42,0.42)]
            transition duration-300 group-hover:-translate-y-0.5
            group-hover:shadow-[0_14px_30px_-20px_rgba(15,23,42,0.38)]
            sm:h-20 sm:w-20
          "
        >
          <span
            className={cn(
              `
                flex h-14 w-14 items-center justify-center
                rounded-[18px] shadow-lg transition duration-300
                group-hover:scale-[1.04] sm:h-16 sm:w-16
                sm:rounded-[20px]
              `,
              iconStyle
            )}
          >
            <HugeiconsIcon
              icon={moduleIcon}
              size={29}
              color="currentColor"
              strokeWidth={1.7}
              aria-hidden="true"
            />
          </span>
        </span>

        <h2
          className="
            max-w-full truncate text-[15px] font-extrabold
            tracking-[-0.025em] text-slate-800 sm:text-[17px]
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
            mt-3 inline-flex min-h-10 w-full cursor-pointer
            items-center justify-center gap-2 rounded-xl border
            border-indigo-200 bg-indigo-50 px-3 text-sm
            font-extrabold text-indigo-700 transition duration-200
            hover:border-indigo-600 hover:bg-indigo-600
            hover:text-white focus:outline-none
            focus-visible:ring-4 focus-visible:ring-indigo-100
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
}

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
              ? "bg-slate-200 text-slate-600"
              : "bg-indigo-100 text-indigo-700"
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
  const currentUserRedux = useSelector((state) => state.user?.currentUser)
  const currentUser = useMemo(() => {
    if (currentUserRedux) return currentUserRedux

    try {
      return JSON.parse(localStorage.getItem("user") || "null")
    } catch {
      return null
    }
  }, [currentUserRedux])
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
        <header className="flex flex-col items-center text-center">
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
