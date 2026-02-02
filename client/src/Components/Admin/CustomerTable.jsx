"use client"

import { Fragment, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  FiEye,
  FiEdit2,
  FiTrash2,
  FiUserCheck,
  FiBriefcase,
  FiAlertCircle,
} from "react-icons/fi"
import { Loader2 } from "lucide-react"
import JobsDropdownPanel from "./JobsDropdownPanel"

/* =========================
   UI TOKENS
========================= */

const card = "rounded-2xl border border-gray-100 bg-white shadow-sm"
const subtleHover = "transition-colors hover:bg-gray-50/60"
const btn =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl active:scale-[0.99] transition focus:outline-none"
const btnPrimary = "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
const btnGhost = "border border-gray-200 bg-white hover:bg-gray-50"
const btnDanger = "border border-rose-200 bg-white hover:bg-rose-50"
const iconBtn = "p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition focus:outline-none"
const chip = "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ring-1"

function cn(...classes) {
  return classes.filter(Boolean).join(" ")
}

function normalizeAssignedToArray(assignedTo) {
  if (!assignedTo) return []
  if (Array.isArray(assignedTo)) return assignedTo
  return [assignedTo]
}

function JobStatusBadge({ status }) {
  const s = String(status || "").toLowerCase()
  const cls =
    s === "completed"
      ? "bg-green-50 text-green-700 ring-green-600/10"
      : s === "on_hold"
      ? "bg-amber-50 text-amber-800 ring-amber-600/10"
      : "bg-sky-50 text-sky-700 ring-sky-600/10"
  return (
    <span className={cn(chip, cls)}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />
      {s || "active"}
    </span>
  )
}

export default function CustomerTable({
  isLoading,
  customers,
  filtered,
  error,
  debounced,
  expandedCustomerId,
  jobsByCustomerId,
  onViewCustomer,
  onEditCustomer,
  onAssignCustomer,
  onDeleteCustomer,
  onToggleDropdown,
  onRefreshJobs,
  onCreateRootJob,
  onCreateSubJob,
  onEditJob,
  onDeleteJob,
  onRefreshList,
  onLoadMore,
  isLoadingMore,
  hasMore,
  disableLoadMore,
}) {
  return (
    <>
      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
          <FiAlertCircle className="w-5 h-5 mt-0.5" />
          <span className="text-sm font-semibold">{error}</span>
        </div>
      )}

      <div className={cn(card, "overflow-hidden")}>
        <div className="max-h-[65vh] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">No.</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Customer</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Assigned</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              <AnimatePresence>
                {isLoading && customers.length === 0 ? (
                  [...Array(8)].map((_, idx) => (
                    <tr key={`sk-${idx}`} className="animate-pulse">
                      {[...Array(4)].map((__, i) => (
                        <td key={`sk-${idx}-${i}`} className="px-6 py-4">
                          <div className="h-4 w-full max-w-[12rem] bg-gray-200 rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length > 0 ? (
                  filtered.map((c, index) => {
                    const assignedArr = normalizeAssignedToArray(c?.assignedTo)
                    const assignedNames = assignedArr
                      .map((x) => (typeof x === "object" ? x?.name : String(x || "")))
                      .filter(Boolean)

                    const assignedDisplay = assignedNames.length ? assignedNames.join(", ") : "—"
                    const isExpanded = String(expandedCustomerId || "") === String(c?._id || "")

                    return (
                      <Fragment key={String(c?._id || `cust-${index}`)}>
                        <motion.tr
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className={cn(subtleHover, "cursor-pointer")}
                          onClick={() => onToggleDropdown(c)}
                          title="Click row to open Jobs dropdown"
                        >
                          <td className="px-6 py-4 text-sm text-gray-600">{index + 1}</td>

                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900">{c?.name || "Unnamed"}</p>
                              <span
                                className={cn(
                                  chip,
                                  isExpanded
                                    ? "bg-indigo-50 text-indigo-700 ring-indigo-600/10"
                                    : "bg-gray-50 text-gray-700 ring-gray-200"
                                )}
                              >
                                <FiBriefcase className="w-3.5 h-3.5" />
                                Jobs
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {c?.companyName ? `Company: ${c.companyName}` : "Company: —"} •{" "}
                              {c?.contactPerson?.name ? `Contact: ${c.contactPerson.name}` : "Contact: —"}
                            </p>
                          </td>

                          <td className="px-6 py-4 text-sm text-gray-700">{assignedDisplay}</td>

                          <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => onViewCustomer(c)}
                                className={cn(btn, btnPrimary, "px-3.5 py-2")}
                              >
                                <FiEye className="w-4 h-4" />
                                View
                              </button>

                              <button onClick={() => onEditCustomer(c)} className={iconBtn} title="Edit" aria-label="Edit">
                                <FiEdit2 className="w-4 h-4 text-gray-700" />
                              </button>

                              <button onClick={() => onAssignCustomer(c)} className={iconBtn} title="Assign" aria-label="Assign">
                                <FiUserCheck className="w-4 h-4 text-gray-700" />
                              </button>

                              <button
                                onClick={() => onDeleteCustomer(c)}
                                className={cn(iconBtn, btnDanger)}
                                title="Delete"
                                aria-label="Delete"
                              >
                                <FiTrash2 className="w-4 h-4 text-rose-600" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>

                        <AnimatePresence initial={false}>
                          {isExpanded ? (
                            <motion.tr
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                            >
                              <td colSpan={4} className="p-0">
                                <JobsDropdownPanel
                                  customer={c}
                                  state={jobsByCustomerId[String(c._id)] || { loading: false, error: "", jobsTree: [] }}
                                  onRefresh={() => onRefreshJobs(String(c._id))}
                                  onCreateRoot={() => onCreateRootJob(c)}
                                  onCreateSub={(parentJob) => onCreateSubJob(c, parentJob)}
                                  onEdit={(job) => onEditJob(c, job)}
                                  onDelete={(job) => onDeleteJob(c, job)}
                                />
                              </td>
                            </motion.tr>
                          ) : null}
                        </AnimatePresence>
                      </Fragment>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      {debounced ? "No customers match your search." : "No customers found."}
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-between items-center p-4 text-sm text-gray-600 border-t border-gray-100 bg-white">
          <span>
            Loaded: <span className="font-bold text-gray-900">{customers.length}</span>
            {debounced ? (
              <>
                {" "}
                • Showing: <span className="font-bold text-gray-900">{filtered.length}</span>
              </>
            ) : null}
          </span>

          <div className="flex items-center gap-2">
            <button onClick={onRefreshList} className={cn(btn, btnGhost, "px-4 py-2")}>
              Refresh list
            </button>

            <button
              onClick={onLoadMore}
              disabled={disableLoadMore}
              className={cn(btn, btnPrimary, "px-4 py-2 disabled:opacity-60")}
              title={debounced ? "Clear search to load more" : hasMore ? "Load next page" : "No more customers"}
            >
              {isLoadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {debounced ? "Clear search to load more" : hasMore ? "Load more" : "No more"}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
