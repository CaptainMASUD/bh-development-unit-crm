/* eslint-disable react/prop-types -- shared Administration presentation primitives */
import { useEffect, useId } from "react"
import { createPortal } from "react-dom"
import { FiAlertCircle, FiFilter, FiRefreshCw, FiSearch, FiSettings, FiX } from "react-icons/fi"

export function administrationCx(...classes) {
  return classes.filter(Boolean).join(" ")
}

export const administrationStyles = {
  page: "min-h-full bg-gradient-to-b from-gray-50 to-white",
  content: "mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8",
  card: "rounded-3xl border border-gray-100 bg-white shadow-[0_18px_45px_-35px_rgba(15,23,42,0.45)]",
  input: "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500",
  button: "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-60",
}

export function AdministrationPage({ children, className = "" }) {
  return <div className={administrationCx(administrationStyles.page, className)}><div className={administrationStyles.content}>{children}</div></div>
}

export function AdministrationHeader({ title, description, icon: Icon = FiSettings, actions, children }) {
  return <header className={administrationCx(administrationStyles.card, "mb-5 p-4 sm:p-5")}>
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm"><Icon className="h-5 w-5" /></span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-black tracking-tight text-gray-950 sm:text-3xl">{title}</h1>
          {description ? <p className="mt-1 text-sm font-medium text-gray-500">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap gap-2 xl:justify-end">{actions}</div> : null}
    </div>
    {children ? <div className="mt-4 border-t border-gray-100 pt-4">{children}</div> : null}
  </header>
}

const buttonTone = {
  primary: "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700",
  secondary: "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50",
  danger: "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50",
  soft: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
}

export function AdministrationButton({ children, icon: Icon, variant = "secondary", className = "", ...props }) {
  return <button className={administrationCx(administrationStyles.button, buttonTone[variant] || buttonTone.secondary, className)} {...props}>{Icon ? <Icon className="h-4 w-4" /> : null}{children}</button>
}

export function AdministrationCard({ children, className = "" }) {
  return <section className={administrationCx(administrationStyles.card, className)}>{children}</section>
}

export function AdministrationToolbar({ value = "", onChange, placeholder = "Search administration...", onOpenFilters, filterCount = 0, utilities }) {
  return <div className="space-y-3">
    <div data-administration-search="true" className="flex min-h-[50px] w-full items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50/80 px-3 py-1.5 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.10)]">
      <FiSearch className="h-4 w-4 shrink-0 text-gray-400" />
      <input value={value} onChange={(event) => onChange?.(event.target.value, event)} placeholder={placeholder} className="min-w-0 flex-1 border-0 bg-transparent px-1 py-2 text-sm font-medium outline-none placeholder:text-gray-400" />
      {onOpenFilters ? <button type="button" className={administrationCx("inline-flex h-9 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-bold transition", filterCount ? "bg-indigo-600 text-white" : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100")} onClick={onOpenFilters}><FiFilter className="h-4 w-4" />Filters{filterCount ? <span className="rounded-full bg-white/20 px-1.5 text-xs">{filterCount}</span> : null}</button> : null}
    </div>
    {utilities ? <div className="flex flex-wrap justify-end gap-2">{utilities}</div> : null}
  </div>
}

export function AdministrationField({ label, htmlFor, hint, required = false, children }) {
  const generatedId = useId()
  const fieldId = htmlFor || generatedId
  return <div>
    <label htmlFor={fieldId} className="mb-1.5 block text-sm font-bold text-gray-800">{label}{required ? <span className="ml-1 text-rose-600">*</span> : null}</label>
    {children}
    {hint ? <p className="mt-1 text-xs font-medium text-gray-500">{hint}</p> : null}
  </div>
}

const statusTone = (value) => {
  const normalized = String(value || "").toLowerCase()
  if (["active", "complete", "completed", "healthy"].includes(normalized)) return "bg-emerald-50 text-emerald-700 ring-emerald-600/10"
  if (["pending", "warning", "attention", "trial"].includes(normalized)) return "bg-amber-50 text-amber-800 ring-amber-600/10"
  if (["inactive", "locked", "suspended", "failed"].includes(normalized)) return "bg-rose-50 text-rose-700 ring-rose-600/10"
  return "bg-gray-100 text-gray-700 ring-gray-600/10"
}

export function AdministrationStatus({ value, children }) {
  const text = children ?? value ?? "Unknown"
  return <span aria-label={`Status: ${String(value ?? text)}`} className={administrationCx("inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold capitalize ring-1", statusTone(value ?? text))}><span className="h-1.5 w-1.5 rounded-full bg-current opacity-50" />{text}</span>
}

export function AdministrationTableState({ status = "empty", title, description, onRetry }) {
  if (status === "loading") return <div className="flex min-h-48 items-center justify-center text-sm font-semibold text-gray-500"><FiRefreshCw className="mr-2 h-4 w-4 animate-spin" />Loading...</div>
  return <div className="flex min-h-48 flex-col items-center justify-center p-8 text-center"><span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-500"><FiAlertCircle className="h-5 w-5" /></span><p className="text-sm font-extrabold text-gray-900">{title || (status === "error" ? "Unable to load data" : "No records found")}</p>{description ? <p className="mt-1 max-w-md text-sm text-gray-500">{description}</p> : null}{status === "error" && onRetry ? <AdministrationButton className="mt-4" icon={FiRefreshCw} onClick={onRetry}>Retry</AdministrationButton> : null}</div>
}

export function AdministrationModal({ open, title, description, onClose, children, footer, maxWidthClass = "max-w-3xl" }) {
  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined
    const prior = document.body.style.overflow
    const onKeyDown = (event) => event.key === "Escape" && onClose?.()
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = prior
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [open, onClose])
  if (!open || typeof document === "undefined") return null
  return createPortal(<div className="fixed inset-0 z-[100] overflow-y-auto bg-black/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}><div className="flex min-h-full items-center justify-center"><div className={administrationCx("w-full overflow-hidden rounded-2xl bg-white shadow-2xl", maxWidthClass)}><header className="flex items-start justify-between border-b border-gray-100 p-5"><div><h2 className="text-lg font-black text-gray-950">{title}</h2>{description ? <p className="mt-1 text-sm text-gray-500">{description}</p> : null}</div><button type="button" aria-label="Close dialog" className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700" onClick={onClose}><FiX className="h-5 w-5" /></button></header><div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>{footer ? <footer className="border-t border-gray-100 p-5">{footer}</footer> : null}</div></div></div>, document.body)
}
