'use client';

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  FiUsers,
  FiSearch,
  FiPlus,
  FiX,
  FiRefreshCcw,
  FiChevronDown,
  FiCheck,
  FiAlertCircle,
  FiFilter,
} from "react-icons/fi"

/* =========================
   UI TOKENS
========================= */

const btn =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl active:scale-[0.99] transition focus:outline-none"
const btnPrimary = "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
const btnGhost = "border border-gray-200 bg-white hover:bg-gray-50"
const chip = "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ring-1"

function cn(...classes) {
  return classes.filter(Boolean).join(" ")
}

export default function CustomerHead({
  isLoading,
  searchTerm,
  setSearchTerm,
  appliedFilterChips,
  activeFilterCount,
  hasAppliedFilters,
  openFilters,
  clearFilters,
  showingCount,
  debounced,
  onRefresh,
  onCreateNew,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
            <FiUsers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
            <p className="text-sm text-gray-600">Manage and track all customer information</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            Loaded: <span className="font-bold text-gray-900">0</span>
          </span>

          <button onClick={onRefresh} className={cn(btn, btnGhost)} title="Refresh">
            <FiRefreshCcw className={cn("w-4 h-4", isLoading ? "animate-spin" : "")} />
            Refresh
          </button>

          <button onClick={onCreateNew} className={cn(btn, btnPrimary)}>
            <FiPlus className="w-4 h-4" />
            Create
          </button>
        </div>
      </div>

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
                <span
                  key={c.key}
                  className={cn(
                    "shrink-0 inline-flex items-center gap-2",
                    "px-2.5 py-1 rounded-full border",
                    "bg-indigo-50 border-indigo-100 text-indigo-700",
                    "text-xs font-bold"
                  )}
                >
                  <span className="truncate max-w-[220px]">{c.label}</span>
                  <button
                    type="button"
                    className="p-0.5 rounded-full hover:bg-indigo-100/80 focus:outline-none"
                    title="Remove"
                    aria-label="Remove filter"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      c.onRemove?.()
                    }}
                  >
                    <FiX className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}

              <input
                id="customers-search-input"
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={appliedFilterChips.length ? "Search…" : "Search customer, company, phone, contact, assigned…"}
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
                aria-label="Clear applied filters"
                title="Clear applied filters"
              >
                <FiX className="w-4 h-4 text-gray-700" />
              </button>
            ) : null}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <p className="text-xs text-gray-500">
              {debounced ? "Searching within loaded customers." : "Tip: Use filters for server-side status + engagement search."}
            </p>
          </div>
        </div>

        <div className="text-sm text-gray-600">
          Showing <span className="font-bold text-gray-900">{showingCount}</span>{" "}
          {debounced ? "result(s)" : "customer(s)"}
        </div>
      </div>
    </motion.div>
  )
}
