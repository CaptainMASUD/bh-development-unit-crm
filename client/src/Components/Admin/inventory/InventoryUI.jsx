/* eslint-disable react/prop-types, react-refresh/only-export-components -- shared Inventory design primitives intentionally coexist with their class tokens */
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { motion } from "framer-motion"
import { FiArchive, FiFilter, FiSearch, FiX } from "react-icons/fi"
import "./inventory-theme.css"

export function cx(...classes) {
  return classes.filter(Boolean).join(" ")
}

export const inventoryStyles = {
  shell: "min-h-full bg-gradient-to-b from-gray-50 to-white",
  content: "mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8",
  card: "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]",
  tableCard: "overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[0_18px_45px_-34px_rgba(15,23,42,0.45)]",
  button: "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60",
  input: "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-transparent focus-visible:ring-2 focus-visible:ring-indigo-500/40",
  label: "mb-1.5 block text-sm font-semibold text-gray-800",
  headCell: "whitespace-nowrap border-b border-gray-200 bg-gray-50 px-6 py-4 text-left text-xs font-black uppercase tracking-[0.06em] text-gray-600",
  cell: "bg-white px-6 py-3 text-sm font-medium text-gray-900 transition-colors group-hover:bg-indigo-50/50",
}

export function InventoryThemeBoundary({ children }) {
  return <div className="inventory-theme">{children}</div>
}

export function InventoryPageShell({ children, className = "" }) {
  return <div className={cx(inventoryStyles.shell, className)}><div className={inventoryStyles.content}>{children}</div></div>
}

export function InventoryPageHeader({ icon: Icon = FiArchive, title, description, actions, children }) {
  return (
    <section data-inventory-page-header className="mb-5 rounded-3xl border border-gray-100 bg-white/90 p-4 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.45)] backdrop-blur sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm"><Icon className="h-5 w-5" /></div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black tracking-tight text-gray-950 sm:text-3xl">{title}</h1>
            {description ? <p className="mt-1 text-sm font-medium text-gray-500">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2 xl:justify-end">{actions}</div> : null}
      </div>
      {children ? <div className="mt-4 border-t border-gray-100 pt-4">{children}</div> : null}
    </section>
  )
}

const buttonVariants = {
  primary: "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700",
  secondary: "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50",
  soft: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
  danger: "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50",
}

export function InventoryButton({ variant = "secondary", icon: Icon, children, className = "", ...props }) {
  return <button className={cx(inventoryStyles.button, buttonVariants[variant] || buttonVariants.secondary, className)} {...props}>{Icon ? <Icon className="h-4 w-4" /> : null}{children}</button>
}

export function InventoryIconButton({ label, icon: Icon, className = "", children, ...props }) {
  return <button aria-label={label} title={label} className={cx("inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30", className)} {...props}>{Icon ? <Icon className="h-4 w-4" /> : children}</button>
}

export function InventoryStatGrid({ children, className = "" }) {
  return <div className={cx("mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}>{children}</div>
}

export function InventoryStatCard({ label, value, detail, icon: Icon, tone = "indigo" }) {
  const tones = { indigo: "bg-indigo-50 text-indigo-600", emerald: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-700", sky: "bg-sky-50 text-sky-600", rose: "bg-rose-50 text-rose-600" }
  return <div className={cx(inventoryStyles.card, "p-4 sm:p-5")}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p><p className="mt-2 text-2xl font-black text-gray-950">{value}</p>{detail ? <div className="mt-2 text-xs font-semibold text-gray-500">{detail}</div> : null}</div>{Icon ? <div className={cx("flex h-10 w-10 items-center justify-center rounded-2xl", tones[tone] || tones.indigo)}><Icon className="h-5 w-5" /></div> : null}</div></div>
}

export function InventoryToolbar({ children, className = "" }) {
  return <div className={cx("flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between", className)}>{children}</div>
}

export function InventorySearchToolbar({
  value = "",
  onChange,
  placeholder = "Search inventory...",
  ariaLabel = "Search inventory",
  filters = [],
  onRemoveFilter,
  onOpenFilters,
  filterControls,
  filterCount = filters.length,
  filtersOpen: controlledFiltersOpen,
  onFiltersOpenChange,
  onClear,
  utilities,
  className = "",
}) {
  const [internalFiltersOpen, setInternalFiltersOpen] = useState(false)
  const filtersOpen = controlledFiltersOpen ?? internalFiltersOpen
  const hasSearchOrFilters = Boolean(value || filters.length)
  const showFiltersButton = Boolean(onOpenFilters || filterControls)
  const changeFiltersOpen = (next) => {
    if (controlledFiltersOpen === undefined) setInternalFiltersOpen(next)
    onFiltersOpenChange?.(next)
  }
  const handleFiltersClick = () => {
    if (filterControls) changeFiltersOpen(!filtersOpen)
    else onOpenFilters?.()
  }
  return (
    <div data-inventory-search-toolbar className={cx("space-y-3", className)}>
      <div className="relative w-full">
        <div data-inventory-search-surface className="flex min-h-[50px] w-full flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50/80 px-3 py-1.5 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.10)]">
          <FiSearch className="h-4 w-4 shrink-0 text-gray-400" />
          {filters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              title="Remove filter"
              className="inline-flex max-w-[210px] items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-600/10 transition hover:bg-indigo-100"
              onClick={() => onRemoveFilter?.(filter.key)}
            >
              <span className="truncate"><span className="text-indigo-500">{filter.label}:</span> {String(filter.value)}</span>
              <FiX className="h-3.5 w-3.5 shrink-0" />
            </button>
          ))}
          <input
            value={value}
            onChange={(event) => onChange?.(event.target.value, event)}
            placeholder={placeholder}
            aria-label={ariaLabel}
            className="min-w-[180px] flex-1 !rounded-none !border-0 !bg-transparent px-1 py-2 text-sm font-medium outline-none placeholder:text-gray-400 focus-visible:!ring-0 focus-visible:!shadow-none"
          />
          {showFiltersButton ? (
            <button
              type="button"
              aria-expanded={filterControls ? filtersOpen : undefined}
              aria-haspopup={filterControls ? "dialog" : undefined}
              className={cx("inline-flex h-9 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-bold transition", filterCount ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100")}
              onClick={handleFiltersClick}
            >
              <FiFilter className="h-4 w-4" />Filters
              {filterCount ? <span className="rounded-full bg-white/20 px-1.5 text-xs">{filterCount}</span> : null}
            </button>
          ) : null}
          {hasSearchOrFilters && onClear ? <button type="button" title="Clear search and filters" aria-label="Clear search and filters" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" onClick={onClear}><FiX className="h-4 w-4" /></button> : null}
        </div>
        {filterControls && filtersOpen ? <div data-inventory-filter-panel role="dialog" aria-label="Inventory filters" className="absolute right-0 top-full z-40 mt-2 w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-4 shadow-xl"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-bold text-gray-900">Filters</p><button type="button" aria-label="Close filters" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" onClick={() => changeFiltersOpen(false)}><FiX className="h-4 w-4" /></button></div><div className="grid gap-3 [&_select]:!w-full">{filterControls}</div></div> : null}
      </div>
      {utilities ? <div data-inventory-search-utilities className="flex w-full flex-wrap items-center justify-end gap-2">{utilities}</div> : null}
    </div>
  )
}

export function InventoryTabs({ items = [], value, onChange, ariaLabel = "Inventory views" }) {
  return <div className="mb-5 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-1.5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]"><div className="flex min-w-max gap-1" role="tablist" aria-label={ariaLabel}>{items.map((item) => { const key = item.value ?? item.key; const active = value === key; return <button key={key} type="button" role="tab" aria-selected={active} className={cx("rounded-xl px-4 py-2.5 text-sm font-bold transition", active ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100 hover:text-gray-950")} onClick={() => onChange?.(key)}>{item.label}{item.count !== undefined ? <span className={cx("ml-2 rounded-full px-2 py-0.5 text-xs", active ? "bg-white/20" : "bg-gray-100")}>{item.count}</span> : null}</button>})}</div></div>
}

export function InventoryTableCard({ children, footer, className = "" }) {
  return <section className={cx(inventoryStyles.tableCard, className)}>{children}{footer ? <footer className="flex flex-col gap-3 border-t border-gray-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">{footer}</footer> : null}</section>
}

function badgeClass(value) {
  const v = String(value || "").toLowerCase()
  if (["active", "available", "approved", "completed", "issued", "success", "in stock"].includes(v)) return "bg-emerald-50 text-emerald-700 ring-emerald-600/10"
  if (["processing", "transferred", "informational", "scheduled", "open"].includes(v)) return "bg-sky-50 text-sky-700 ring-sky-600/10"
  if (["pending", "waiting", "paused", "low stock", "attention", "draft"].includes(v)) return "bg-amber-50 text-amber-800 ring-amber-600/10"
  if (["inactive", "rejected", "cancelled", "expired", "failed", "out of stock", "damaged"].includes(v)) return "bg-rose-50 text-rose-700 ring-rose-600/10"
  return "bg-gray-100 text-gray-700 ring-gray-600/10"
}

export function InventoryStatusBadge({ value, children }) {
  const text = children ?? value ?? "—"
  return <span className={cx("inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold ring-1", badgeClass(value ?? children))}><span className="h-1.5 w-1.5 rounded-full bg-current opacity-40" />{text}</span>
}

export function InventoryField({ label, hint, children }) {
  return <div><label className={inventoryStyles.label}>{label}</label>{children}{hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}</div>
}

export function InventoryEmptyState({ icon: Icon = FiArchive, title, description }) {
  return <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center"><div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-gray-500 shadow-sm"><Icon className="h-5 w-5" /></div><p className="text-sm font-bold text-gray-900">{title}</p>{description ? <p className="mt-1 max-w-md text-sm text-gray-500">{description}</p> : null}</div>
}

export function InventoryModal({ open, onClose, title, subtitle, icon: Icon = FiArchive, children, footer, maxWidthClass = "max-w-3xl", closeOnBackdrop = true }) {
  useEffect(() => {
    if (!open) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKeyDown = (event) => event.key === "Escape" && onClose?.()
    window.addEventListener("keydown", onKeyDown)
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKeyDown) }
  }, [open, onClose])
  if (!open || typeof document === "undefined") return null
  return createPortal(<div className="inventory-theme fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label={title}><div className="absolute inset-0 overflow-y-auto"><div className="flex min-h-full items-start justify-center p-4 sm:items-center sm:p-6"><motion.button type="button" aria-label="Close dialog" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 cursor-default bg-black/40 backdrop-blur-md" onClick={closeOnBackdrop ? onClose : undefined} /><motion.div initial={{ opacity: 0, y: 14, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={cx("relative w-full overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_30px_70px_-30px_rgba(0,0,0,0.65)]", maxWidthClass)}><header className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-100 bg-white p-4 sm:p-5"><div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm"><Icon className="h-5 w-5" /></div><div className="min-w-0"><h2 className="truncate text-base font-bold text-gray-900 sm:text-lg">{title}</h2>{subtitle ? <p className="truncate text-sm text-gray-600">{subtitle}</p> : null}</div></div><InventoryIconButton label="Close dialog" icon={FiX} onClick={onClose} /></header><div className="max-h-[calc(100vh-14rem)] overflow-y-auto bg-white p-4 sm:p-5">{children}</div>{footer ? <footer className="sticky bottom-0 z-20 border-t border-gray-100 bg-white p-4 sm:p-5">{footer}</footer> : null}</motion.div></div></div></div>, document.body)
}
