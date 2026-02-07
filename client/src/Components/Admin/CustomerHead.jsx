// CustomerHead.jsx
"use client"

import React, { useMemo } from "react"
import { motion } from "framer-motion"
import {
  FiUsers,
  FiSearch,
  FiPlus,
  FiX,
  FiRefreshCcw,
  FiFilter,
  FiColumns,
} from "react-icons/fi"

/* =========================
   UI TOKENS (BLUE THEME)
========================= */

const card = "rounded-2xl border border-gray-100 bg-white shadow-sm"
const btn =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl active:scale-[0.99] transition focus:outline-none"
const btnPrimary = "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
const btnGhost = "border border-gray-200 bg-white hover:bg-gray-50"
const chip =
  "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ring-1"

function cn(...classes) {
  return classes.filter(Boolean).join(" ")
}

function CompactChip({ item }) {
  return (
    <span
      className={cn(
        "shrink-0 inline-flex items-center gap-2",
        "px-2.5 py-1 rounded-full border",
        "bg-indigo-50 border-indigo-100 text-indigo-700",
        "text-xs font-bold"
      )}
      title={item.label}
    >
      <span className="truncate max-w-[220px]">{item.label}</span>
      <button
        type="button"
        className="p-0.5 rounded-full hover:bg-indigo-100/80 focus:outline-none"
        title="Remove"
        aria-label="Remove filter"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          item.onRemove?.()
        }}
      >
        <FiX className="w-3.5 h-3.5" />
      </button>
    </span>
  )
}

export default function CustomerHead({
  customersLength,
  isLoading,
  onRefresh,
  onCreate,

  // filters
  appliedFilterChips = [],
  openFilters,
  activeFilterCount = 0,
  hasAppliedFilters,
  clearFilters,

  // search
  searchTerm,
  setSearchTerm,
  debounced,
  showingCount,

  // ✅ columns / view prefs
  onOpenColumns, // () => void  (opens the "Choose columns" modal in CustomerPage)
  columnsSelectedCount = 0, // number of selected columns
  columnsDefaultCount = 0, // default columns count (optional)
  columnsLoading = false, // while fetching preference
  columnsDirty = false, // optional: true if user changed columns vs saved/default

  // optional: allow parent to show "search is local" hint
  localSearchHint = true,
}) {
  const placeholder = useMemo(() => {
    return appliedFilterChips.length ? "Search…" : "Search customer, company, phone, contact, assigned…"
  }, [appliedFilterChips.length])

  const columnsBadgeText = useMemo(() => {
    if (columnsLoading) return "…"
    if (!columnsSelectedCount) return "—"
    // if default provided, show like "7/14"
    if (columnsDefaultCount) return `${columnsSelectedCount}/${columnsDefaultCount}`
    return String(columnsSelectedCount)
  }, [columnsLoading, columnsSelectedCount, columnsDefaultCount])

  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
      <div className={cn(card, "p-6")}>
        <div className="flex flex-col gap-4">
          {/* TOP BAR */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="relative bg-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm">
                  <FiUsers className="w-6 h-6" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Customers</h1>
                <p className="text-sm text-gray-500">Fast list • Jobs dropdown</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")}>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600/60" />
                Loaded: {customersLength}
              </span>

              <span className={cn(chip, "bg-gray-50 text-gray-800 ring-gray-200")}>
                Showing: <span className="font-extrabold">{showingCount}</span>
              </span>

              {/* ✅ Column options button (opens modal from CustomerPage) */}
              <button
                type="button"
                onClick={onOpenColumns}
                className={cn(btn, btnGhost, "relative")}
                title="Column options"
                aria-label="Column options"
              >
                <FiColumns className={cn("w-4 h-4", columnsLoading ? "animate-pulse" : "")} />
                Columns
                <span
                  className={cn(
                    "ml-1 inline-flex items-center justify-center",
                    "min-w-7 h-7 px-2 rounded-full text-xs font-extrabold",
                    columnsDirty ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-800"
                  )}
                >
                  {columnsBadgeText}
                </span>
              </button>

              <button onClick={onRefresh} className={cn(btn, btnGhost)} title="Refresh">
                <FiRefreshCcw className={cn("w-4 h-4", isLoading ? "animate-spin" : "")} />
                Refresh
              </button>

              <button onClick={onCreate} className={cn(btn, btnPrimary)}>
                <FiPlus className="w-4 h-4" />
                Create
              </button>
            </div>
          </div>

          {/* SEARCH + FILTERS BAR */}
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="w-full lg:w-1/2">
              <div
                className={cn(
                  "w-full h-12 rounded-2xl border border-gray-200 bg-white",
                  "px-3 flex items-center gap-2",
                  "focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent"
                )}
              >
                <FiSearch className="w-4 h-4 text-gray-400 shrink-0" />

                <div
                  className={cn(
                    "flex-1 min-w-0 flex items-center gap-2",
                    "overflow-x-auto",
                    "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  )}
                  onClick={() => document.getElementById("customers-search-input")?.focus?.()}
                >
                  {appliedFilterChips.map((c) => (
                    <CompactChip key={c.key} item={c} />
                  ))}

                  <input
                    id="customers-search-input"
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={placeholder}
                    className={cn(
                      "flex-1 min-w-[10rem] bg-transparent",
                      "text-sm text-gray-900 placeholder:text-gray-400",
                      "border-0 outline-none ring-0 shadow-none",
                      "focus:outline-none focus:ring-0 focus:shadow-none focus:border-0",
                      "appearance-none"
                    )}
                  />
                </div>

                <button
                  type="button"
                  onClick={openFilters}
                  className={cn(
                    "relative shrink-0",
                    "h-9 w-9 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition",
                    "flex items-center justify-center focus:outline-none"
                  )}
                  aria-label="Open filters"
                  title="Filters"
                >
                  <FiFilter className="w-4 h-4 text-gray-700" />
                  {activeFilterCount ? (
                    <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  ) : null}
                </button>

                {hasAppliedFilters ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className={cn(
                      "shrink-0 h-9 w-9 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition",
                      "flex items-center justify-center focus:outline-none"
                    )}
                    aria-label="Clear filters"
                    title="Clear filters"
                  >
                    <FiX className="w-4 h-4 text-gray-700" />
                  </button>
                ) : null}
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-xs text-gray-500">
                  {localSearchHint
                    ? debounced
                      ? "Searching in the loaded list."
                      : "Tip: Filters help you narrow results faster."
                    : " "}
                </p>

                <p className="text-xs text-gray-500">
                  {debounced ? (
                    <>
                      Query: <span className="font-semibold text-gray-700">{debounced}</span>
                    </>
                  ) : null}
                </p>
              </div>
            </div>

            <div className="text-sm text-gray-600">
              Showing <span className="font-bold text-gray-900">{showingCount}</span>{" "}
              {debounced ? "result(s)" : "customer(s)"}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
