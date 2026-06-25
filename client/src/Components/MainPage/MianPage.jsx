"use client"

import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  FiArrowRight,
  FiCheck,
  FiCreditCard,
  FiDollarSign,
  FiFileText,
  FiGrid,
  FiHome,
  FiLayers,
  FiPackage,
  FiSearch,
  FiShoppingBag,
  FiShoppingCart,
  FiStar,
  FiTrendingUp,
  FiTruck,
  FiUsers,
  FiX,
} from "react-icons/fi"

const cn = (...classes) => classes.filter(Boolean).join(" ")

const shell = "min-h-screen bg-slate-50"
const panel = "rounded-3xl border border-slate-200/70 bg-white shadow-[0_18px_55px_-45px_rgba(15,23,42,0.55)]"
const btn =
  "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
const btnPrimary = "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-700"
const btnGhost = "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
const iconButton =
  "inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
const smallChip =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1"

const categories = ["All", "Sales", "Operations", "Finance", "Website"]

const modules = [
  {
    id: "payroll",
    name: "HR Payroll",
    category: "Finance",
    description: "Employee salary, loans, deductions, approvals and payslip management.",
    route: "/admin/payroll",
    status: "Active",
    icon: FiCreditCard,
    tone: "indigo",
    favorite: true,
  },
  {
    id: "crm",
    name: "CRM",
    category: "Sales",
    description: "Leads, customers, pipelines, follow-ups and conversion tracking.",
    route: "/admin/leads",
    status: "Active",
    icon: FiUsers,
    tone: "sky",
    favorite: true,
  },
  {
    id: "inventory",
    name: "Inventory",
    category: "Operations",
    description: "Products, stock movement, warehouses, transfers and low-stock alerts.",
    route: "/admin/inventory",
    status: "Active",
    icon: FiPackage,
    tone: "emerald",
    favorite: true,
  },
  {
    id: "pos",
    name: "POS",
    category: "Sales",
    description: "Retail checkout, sales invoices, discounts and daily closing.",
    route: "/admin/pos",
    status: "Ready",
    icon: FiShoppingCart,
    tone: "violet",
  },
  {
    id: "accounting",
    name: "Accounting",
    category: "Finance",
    description: "Income, expenses, ledgers, vendor bills and financial reports.",
    route: "/admin/accounting",
    status: "Active",
    icon: FiDollarSign,
    tone: "amber",
  },

  {
    id: "sales",
    name: "Sales",
    category: "Sales",
    description: "Quotations, orders, clients, payment status and sales performance.",
    route: "/admin/sales",
    status: "Ready",
    icon: FiTrendingUp,
    tone: "cyan",
  },
  {
    id: "purchase",
    name: "Purchase",
    category: "Operations",
    description: "Supplier requests, purchase orders, receiving and vendor tracking.",
    route: "/admin/purchase",
    status: "Ready",
    icon: FiShoppingBag,
    tone: "orange",
  },
  {
    id: "fleet",
    name: "Fleet",
    category: "Operations",
    description: "Vehicles, maintenance, drivers, fuel and route records.",
    route: "/admin/fleet",
    status: "Optional",
    icon: FiTruck,
    tone: "slate",
  },
  {
    id: "projects",
    name: "Projects",
    category: "Operations",
    description: "Tasks, milestones, deadlines, delivery status and client work.",
    route: "/admin/projects",
    status: "Ready",
    icon: FiLayers,
    tone: "fuchsia",
  },
  {
    id: "website",
    name: "Website",
    category: "Website",
    description: "Pages, blogs, service content, contact requests and SEO basics.",
    route: "/admin/website",
    status: "Ready",
    icon: FiHome,
    tone: "blue",
  },

  {
    id: "documents",
    name: "Documents",
    category: "Operations",
    description: "Contracts, attachments, approvals and company file archive.",
    route: "/admin/documents",
    status: "Optional",
    icon: FiFileText,
    tone: "lime",
  },


]

const tone = {
  indigo: {
    icon: "bg-indigo-600 text-white shadow-indigo-600/20",
    soft: "bg-indigo-50 text-indigo-700 ring-indigo-600/10",
  },
  sky: {
    icon: "bg-sky-600 text-white shadow-sky-600/20",
    soft: "bg-sky-50 text-sky-700 ring-sky-600/10",
  },
  emerald: {
    icon: "bg-emerald-600 text-white shadow-emerald-600/20",
    soft: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
  },
  violet: {
    icon: "bg-violet-600 text-white shadow-violet-600/20",
    soft: "bg-violet-50 text-violet-700 ring-violet-600/10",
  },
  amber: {
    icon: "bg-amber-500 text-white shadow-amber-500/20",
    soft: "bg-amber-50 text-amber-700 ring-amber-600/10",
  },
  cyan: {
    icon: "bg-cyan-600 text-white shadow-cyan-600/20",
    soft: "bg-cyan-50 text-cyan-700 ring-cyan-600/10",
  },
  orange: {
    icon: "bg-orange-600 text-white shadow-orange-600/20",
    soft: "bg-orange-50 text-orange-700 ring-orange-600/10",
  },
  slate: {
    icon: "bg-slate-700 text-white shadow-slate-700/20",
    soft: "bg-slate-100 text-slate-700 ring-slate-600/10",
  },
  fuchsia: {
    icon: "bg-fuchsia-600 text-white shadow-fuchsia-600/20",
    soft: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-600/10",
  },
  blue: {
    icon: "bg-blue-600 text-white shadow-blue-600/20",
    soft: "bg-blue-50 text-blue-700 ring-blue-600/10",
  },
  lime: {
    icon: "bg-lime-600 text-white shadow-lime-600/20",
    soft: "bg-lime-50 text-lime-700 ring-lime-600/10",
  },
}


function ScrollbarHideStyle() {
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
  if (!module) return

  if (typeof onOpenModule === "function") {
    onOpenModule(module)
    return
  }

  if (typeof window !== "undefined" && module.route) {
    window.location.href = module.route
  }
}

function AppTile({ module, selected, onSelect, onOpen }) {
  const Icon = module.icon
  const styles = tone[module.tone] || tone.indigo

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.16 }}
      className={cn(
        "group relative rounded-2xl border bg-white p-3 transition sm:rounded-3xl sm:p-4",
        selected
          ? "border-indigo-300 shadow-[0_18px_45px_-28px_rgba(79,70,229,0.65)] ring-4 ring-indigo-50"
          : "border-slate-200/70 shadow-[0_14px_40px_-35px_rgba(15,23,42,0.5)] hover:border-indigo-200 hover:shadow-[0_18px_50px_-35px_rgba(15,23,42,0.55)]"
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(module)}
        aria-pressed={selected}
        aria-label={`Select ${module.name} module`}
        className="block w-full rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/35"
      >
        <div className="flex items-start gap-2 sm:gap-3">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-lg sm:h-12 sm:w-12 sm:rounded-2xl", styles.icon)}>
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate text-sm font-black text-slate-950 sm:text-base">{module.name}</h3>
              {module.favorite ? <FiStar className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" /> : null}
            </div>
            <p className="mt-1 hidden text-xs font-bold uppercase tracking-wide text-slate-400 sm:block">{module.category}</p>
          </div>

          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition",
              selected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-transparent"
            )}
          >
            <FiCheck className="h-3.5 w-3.5" />
          </span>
        </div>

        <p className="mt-3 line-clamp-2 min-h-[38px] text-xs font-medium leading-5 text-slate-500 sm:mt-4 sm:min-h-[44px] sm:text-sm sm:leading-6">
          {module.description}
        </p>
      </button>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 sm:mt-4 sm:gap-3">
        <span className={cn(smallChip, "hidden sm:inline-flex", styles.soft)}>{module.status}</span>

        <button
          type="button"
          onClick={() => onOpen(module)}
          aria-label={`Open ${module.name} module`}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-50 px-2 py-2 text-xs font-black text-indigo-700 transition hover:bg-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 sm:w-auto sm:bg-transparent sm:px-2.5 sm:text-sm sm:hover:bg-indigo-50"
        >
          Open
          <FiArrowRight className="h-4 w-4" />
        </button>
      </div>
    </motion.article>
  )
}

function SidebarCategory({ item, count, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30",
        active ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20" : "text-slate-600 hover:bg-slate-100"
      )}
    >
      <span>{item}</span>
      <span className={cn("rounded-full px-2 py-0.5 text-[11px]", active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>
        {count}
      </span>
    </button>
  )
}

function EmptyState({ onReset }) {
  return (
    <div className={cn(panel, "flex min-h-[360px] flex-col items-center justify-center p-8 text-center")}>
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">
        <FiSearch className="h-7 w-7" />
      </div>
      <h3 className="mt-5 text-lg font-black text-slate-950">No module found</h3>
      <p className="mt-2 max-w-md text-sm font-medium leading-6 text-slate-500">
        Try a different keyword or reset the selected category.
      </p>
      <button type="button" className={cn(btn, btnPrimary, "mt-5")} onClick={onReset}>
        Reset filters
      </button>
    </div>
  )
}

export default function OdooStyleModulesPage({ onOpenModule }) {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("All")
  const [selectedId, setSelectedId] = useState("payroll")

  const categoryCounts = useMemo(() => {
    return categories.reduce((acc, item) => {
      acc[item] = item === "All" ? modules.length : modules.filter((module) => module.category === item).length
      return acc
    }, {})
  }, [])

  const filteredModules = useMemo(() => {
    const search = query.trim().toLowerCase()

    return modules.filter((module) => {
      const matchesCategory = category === "All" || module.category === category
      const matchesSearch =
        !search ||
        module.name.toLowerCase().includes(search) ||
        module.category.toLowerCase().includes(search) ||
        module.description.toLowerCase().includes(search) ||
        module.status.toLowerCase().includes(search)

      return matchesCategory && matchesSearch
    })
  }, [category, query])

  const selectedModule = useMemo(() => {
    return modules.find((module) => module.id === selectedId) || null
  }, [selectedId])

  const selectedVisible = selectedModule && filteredModules.some((module) => module.id === selectedModule.id)

  const resetFilters = () => {
    setQuery("")
    setCategory("All")
  }

  const selectModule = (module) => setSelectedId(module.id)
  const handleOpen = (module) => openModule(module, onOpenModule)

  return (
    <main className={shell}>
      <ScrollbarHideStyle />
      <section className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-4 rounded-3xl border border-slate-200/70 bg-white p-5 shadow-[0_18px_55px_-45px_rgba(15,23,42,0.55)] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700 ring-1 ring-indigo-600/10">
              <FiGrid className="h-3.5 w-3.5" />
              App launcher
            </div>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              Business modules
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500">
              Open HR Payroll, CRM, Inventory, Accounting and other tools from one clean dashboard.
            </p>
          </div>

          <div className="flex w-full max-w-xl items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 transition focus-within:border-transparent focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500/35">
            <FiSearch className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search modules..."
              className="min-h-[34px] w-full border-0 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
              aria-label="Search modules"
            />
            {query ? (
              <button
                type="button"
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                <FiX className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[250px_1fr]">
          <aside className={cn(panel, "sticky top-5 hidden h-fit self-start p-3 xl:block")}>
            <div className="mb-3 px-2 py-2">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Categories</p>
            </div>

            <nav className="space-y-1" aria-label="Module categories">
              {categories.map((item) => (
                <SidebarCategory
                  key={item}
                  item={item}
                  count={categoryCounts[item] || 0}
                  active={category === item}
                  onClick={() => setCategory(item)}
                />
              ))}
            </nav>
          </aside>

          <div className="min-w-0">
            <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1 xl:hidden" aria-label="Mobile module categories">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  aria-pressed={category === item}
                  className={cn(
                    "shrink-0 rounded-2xl px-4 py-2 text-sm font-black transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30",
                    category === item ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  )}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black text-slate-950">Available modules</p>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  {filteredModules.length} module{filteredModules.length === 1 ? "" : "s"} found
                </p>
              </div>

              {(query || category !== "All") ? (
                <button type="button" className={cn(btn, btnGhost, "h-10 px-3 py-2")} onClick={resetFilters}>
                  Clear filters
                </button>
              ) : null}
            </div>

            {filteredModules.length ? (
              <motion.div layout className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-4">
                <AnimatePresence mode="popLayout">
                  {filteredModules.map((module) => (
                    <AppTile
                      key={module.id}
                      module={module}
                      selected={selectedVisible && selectedModule?.id === module.id}
                      onSelect={selectModule}
                      onOpen={handleOpen}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            ) : (
              <EmptyState onReset={resetFilters} />
            )}
          </div>

        </div>
      </section>
    </main>
  )
}
