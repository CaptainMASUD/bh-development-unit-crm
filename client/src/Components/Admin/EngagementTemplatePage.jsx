"use client"

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import {
  FiPlus,
  FiTrash2,
  FiCheck,
  FiLayers,
  FiFolder,
  FiX,
  FiHash,
  FiChevronDown,
  FiEdit2,
  FiSearch,
  FiRefreshCw,
} from "react-icons/fi"
import { AlertTriangle, X, Loader2 } from "lucide-react"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const PAGE_SIZE = 20

const authHeaders = () => ({
  "Content-Type": "application/json",
  ...(localStorage.getItem("token")
    ? { Authorization: `Bearer ${localStorage.getItem("token")}` }
    : {}),
})

/* ================= SHARED UI CLASSES ================= */
const inputClass =
  "w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white outline-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"

const subtitleInputClass =
  "flex-1 px-4 py-2 rounded-xl border border-gray-300 bg-white outline-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"

const searchInputClass =
  "w-full h-12 pl-10 pr-3 rounded-xl border border-gray-200 bg-white outline-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"

const selectClass =
  "h-9 w-full px-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold outline-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"

const focusableBtnClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"

/* ================= TOAST ================= */
function Toast({ message }) {
  if (!message) return null
  return (
    <div className="fixed top-5 right-5 z-50">
      <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-gray-900 text-white shadow-2xl text-sm font-semibold">
        <FiCheck />
        {message}
      </div>
    </div>
  )
}

/* ================= DELETE MODAL ================= */
function ConfirmDeleteModal({ open, title, description, loading, onClose, onConfirm }) {
  const closeBtnRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => closeBtnRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => !loading && onClose?.()} />

      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
        <div className="p-5 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
            <AlertTriangle className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-600 mt-1">{description}</p>
          </div>

          <button
            ref={closeBtnRef}
            onClick={onClose}
            disabled={loading}
            className={[
              "p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-60",
              focusableBtnClass,
            ].join(" ")}
            aria-label="Close"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className={[
              "px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold disabled:opacity-60",
              focusableBtnClass,
            ].join(" ")}
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            disabled={loading}
            className={[
              "px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 text-sm font-semibold flex items-center gap-2 disabled:opacity-60",
              focusableBtnClass,
            ].join(" ")}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FiTrash2 />}
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ================= ADD/EDIT MODAL (scrollable) ================= */
function EngagementTemplateModal({
  open,
  loading,
  mode, // "add" | "edit"
  value,
  subEngagements,
  onClose,
  onChangeValue,
  onChangeSubs,
  onAddSub,
  onRemoveSub,
  onSubmit,
}) {
  const closeBtnRef = useRef(null)
  const titleInputRef = useRef(null)

  const subRefs = useRef([])
  const prevLenRef = useRef((subEngagements || []).length)

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      closeBtnRef.current?.focus()
      titleInputRef.current?.focus()
      titleInputRef.current?.select?.()
    }, 80)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.()
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") onSubmit?.()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose, onSubmit])

  useEffect(() => {
    if (!open) return
    const len = (subEngagements || []).length
    const prev = prevLenRef.current
    if (len > prev) {
      const t = setTimeout(() => {
        const el = subRefs.current[len - 1]
        el?.focus?.()
        el?.select?.()
      }, 0)
      prevLenRef.current = len
      return () => clearTimeout(t)
    }
    prevLenRef.current = len
  }, [open, subEngagements])

  if (!open) return null

  const heading = mode === "edit" ? "Update Engagement Type" : "Add Engagement Type"
  const subHeading =
    mode === "edit"
      ? "Update engagement type and sub-engagements."
      : "Create a reusable engagement type. Sub-engagements are optional."
  const submitLabel = mode === "edit" ? "Update" : "Save"

  const canSave = value.trim().length > 0 && !loading

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => !loading && onClose?.()} />

      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden max-h-[85vh] flex flex-col">
        <div className="p-5 flex items-start justify-between gap-3 border-b border-gray-100 shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-gray-900">{heading}</h3>
            <p className="text-sm text-gray-600 mt-1">{subHeading}</p>
          </div>

          <button
            ref={closeBtnRef}
            onClick={onClose}
            disabled={loading}
            className={[
              "p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-60",
              focusableBtnClass,
            ].join(" ")}
            aria-label="Close"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Engagement Type (Title)
              </label>
              <input
                ref={titleInputRef}
                value={value}
                onChange={(e) => onChangeValue(e.target.value)}
                placeholder="e.g. Business Audit / Legal Work / Tax Return"
                className={inputClass}
                disabled={loading}
              />
            </div>

            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                <FiHash /> Sub-engagements (optional)
              </div>

              <div className="mt-3 space-y-2">
                {(subEngagements || []).map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      ref={(el) => {
                        subRefs.current[i] = el
                      }}
                      value={s}
                      onChange={(e) => {
                        const next = [...subEngagements]
                        next[i] = e.target.value
                        onChangeSubs(next)
                      }}
                      placeholder={`Sub-engagement ${i + 1}`}
                      className={subtitleInputClass}
                      disabled={loading}
                    />

                    <button
                      type="button"
                      onClick={() => onRemoveSub(i)}
                      disabled={loading || subEngagements.length <= 1}
                      className={[
                        "h-10 w-10 flex items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50",
                        focusableBtnClass,
                      ].join(" ")}
                      title={subEngagements.length <= 1 ? "Keep at least one input" : "Remove"}
                      aria-label="Remove sub-engagement"
                    >
                      <FiX />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <button
                  type="button"
                  onClick={onAddSub}
                  disabled={loading}
                  className={[
                    "inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold disabled:opacity-60",
                    focusableBtnClass,
                  ].join(" ")}
                >
                  <FiPlus /> Add Sub-engagement
                </button>

                <p className="text-xs text-gray-500 sm:text-right">
                  Tip: Press <span className="font-semibold">Ctrl/⌘ + Enter</span> to{" "}
                  {mode === "edit" ? "update" : "save"}.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            disabled={loading}
            className={[
              "px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold disabled:opacity-60",
              focusableBtnClass,
            ].join(" ")}
          >
            Cancel
          </button>

          <button
            onClick={onSubmit}
            disabled={!canSave}
            className={[
              "inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold disabled:opacity-60",
              focusableBtnClass,
            ].join(" ")}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {mode === "edit" ? "Updating..." : "Saving..."}
              </>
            ) : (
              <>
                <FiCheck />
                {submitLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ================= SMOOTH COLLAPSE ================= */
function SmoothCollapse({ open, children }) {
  const innerRef = useRef(null)
  const [height, setHeight] = useState(0)
  const [isAuto, setIsAuto] = useState(false)

  useEffect(() => {
    const el = innerRef.current
    if (!el) return

    if (open) {
      setIsAuto(false)
      setHeight(0)
      requestAnimationFrame(() => requestAnimationFrame(() => setHeight(el.scrollHeight)))
    } else {
      setIsAuto(false)
      const current = el.scrollHeight
      setHeight(current)
      requestAnimationFrame(() => requestAnimationFrame(() => setHeight(0)))
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const el = innerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      if (!open) return
      if (isAuto) return
      setHeight(el.scrollHeight)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [open, isAuto])

  const onTransitionEnd = () => {
    if (!open) return
    setIsAuto(true)
  }

  return (
    <div
      className="overflow-hidden transition-[height,opacity] duration-300 ease-out will-change-[height,opacity]"
      style={{ height: isAuto ? "auto" : `${height}px`, opacity: open ? 1 : 0 }}
      onTransitionEnd={onTransitionEnd}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  )
}

/* ================= SKELETONS (like Customers page) ================= */
function HeaderSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-5 sm:p-6 space-y-4">
      <div className="animate-pulse">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-xl bg-gray-200" />
            <div className="min-w-0">
              <div className="h-6 w-64 rounded bg-gray-200" />
              <div className="h-4 w-80 rounded bg-gray-200 mt-2" />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="h-10 w-28 rounded-xl bg-gray-200" />
            <div className="h-10 w-44 rounded-xl bg-gray-200" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <div className="h-12 rounded-xl bg-gray-200" />
          <div className="h-12 rounded-xl bg-gray-200" />
        </div>
      </div>
    </div>
  )
}

function RowSkeleton() {
  return (
    <div className="p-5 sm:p-6">
      <div className="animate-pulse">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-4 w-4 rounded bg-gray-200 shrink-0" />
              <div className="h-4 w-72 max-w-[90%] rounded bg-gray-200" />
            </div>
            <div className="mt-2 h-3 w-44 rounded bg-gray-200" />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="h-9 w-9 rounded-xl bg-gray-200" />
            <div className="h-9 w-9 rounded-xl bg-gray-200" />
            <div className="h-9 w-9 rounded-xl bg-gray-200" />
          </div>
        </div>
      </div>
    </div>
  )
}

function ListHeaderSkeleton() {
  return (
    <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 animate-pulse">
        <div className="h-4 w-4 rounded bg-gray-200" />
        <div className="h-4 w-40 rounded bg-gray-200" />
      </div>
      <div className="animate-pulse">
        <div className="h-3 w-36 rounded bg-gray-200" />
      </div>
    </div>
  )
}

/* ================= PAGE =================
   Engagement Templates Page
========================================= */
export default function EngagementTemplatePage() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [toast, setToast] = useState("")

  const [deleteModal, setDeleteModal] = useState({ open: false, id: null })
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [updateSaving, setUpdateSaving] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [titleValue, setTitleValue] = useState("")
  const [subValues, setSubValues] = useState([""])

  const [openIds, setOpenIds] = useState(() => new Set())

  const [q, setQ] = useState("")
  const [qDebounced, setQDebounced] = useState("")
  const [sortMode, setSortMode] = useState("title")

  const [nextCursor, setNextCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)

  const abortRef = useRef(null)

  const showToast = useCallback((msg) => {
    setToast(msg)
    window.clearTimeout(showToast._t)
    showToast._t = window.setTimeout(() => setToast(""), 2000)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(String(q || "").trim()), 250)
    return () => clearTimeout(t)
  }, [q])

  const buildUrl = useCallback(
    ({ cursor = null, reset = false } = {}) => {
      const qs = new URLSearchParams()
      qs.set("limit", String(PAGE_SIZE))
      qs.set("sort", sortMode)
      qs.set("active", "true")
      if (qDebounced) qs.set("q", qDebounced)
      if (!reset && cursor) qs.set("cursor", String(cursor))
      return `${API_BASE}/engagement-templates?${qs.toString()}`
    },
    [qDebounced, sortMode]
  )

  const fetchTemplates = useCallback(
    async ({ reset = false } = {}) => {
      if (abortRef.current) abortRef.current.abort()
      const ac = new AbortController()
      abortRef.current = ac

      if (reset) setLoading(true)
      else setLoadingMore(true)

      try {
        const cursor = reset ? null : nextCursor
        const res = await fetch(buildUrl({ cursor, reset }), {
          headers: authHeaders(),
          signal: ac.signal,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.message || "Failed to fetch engagement types")

        const rows = Array.isArray(data?.templates) ? data.templates : []
        setTemplates((prev) => (reset ? rows : [...prev, ...rows]))

        setNextCursor(data?.nextCursor || null)
        setHasMore(!!data?.hasMore)
      } catch (e) {
        if (e?.name !== "AbortError") {
          showToast(e?.message || "Failed to load engagement types")
          if (reset) {
            setTemplates([])
            setNextCursor(null)
            setHasMore(false)
          }
        }
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [buildUrl, nextCursor, showToast]
  )

  const resetAndFetch = useCallback(async () => {
    setTemplates([])
    setNextCursor(null)
    setHasMore(false)
    setOpenIds(new Set())
    await fetchTemplates({ reset: true })
  }, [fetchTemplates])

  useEffect(() => {
    fetchTemplates({ reset: true })
    return () => abortRef.current?.abort?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    resetAndFetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortMode, qDebounced])

  const sortedTemplates = useMemo(() => {
    const arr = Array.isArray(templates) ? templates.slice() : []
    if (sortMode === "title") {
      arr.sort((a, b) => String(a?.title || "").localeCompare(String(b?.title || "")))
    }
    return arr
  }, [templates, sortMode])

  /* ---------------- FORM HELPERS ---------------- */
  const resetForm = () => {
    setEditingId(null)
    setTitleValue("")
    setSubValues([""])
  }

  const addSubInput = () => setSubValues((p) => [...(Array.isArray(p) ? p : [""]), ""])
  const removeSubInput = (idx) => {
    setSubValues((p) => {
      const arr = Array.isArray(p) ? p.slice() : [""]
      if (arr.length <= 1) return arr
      arr.splice(idx, 1)
      return arr.length ? arr : [""]
    })
  }

  const normalizeSubs = (arr) => {
    const raw = (Array.isArray(arr) ? arr : [])
      .map((s) => String(s || "").trim())
      .filter(Boolean)
    const seen = new Set()
    const out = []
    for (const t of raw) {
      const k = t.toLowerCase()
      if (seen.has(k)) continue
      seen.add(k)
      out.push(t)
    }
    return out
  }

  const openAddModal = () => {
    resetForm()
    setAddModalOpen(true)
  }

  const openEditModal = (tpl) => {
    const subs = Array.isArray(tpl?.subEngagements) ? tpl.subEngagements : []
    const texts = subs.map((s) => String(s?.text || "").trim()).filter(Boolean)

    setEditingId(String(tpl?._id))
    setTitleValue(String(tpl?.title || ""))
    setSubValues(texts.length ? texts : [""])
    setEditModalOpen(true)
  }

  /* ---------------- CREATE ---------------- */
  const createTemplate = async () => {
    if (!titleValue.trim()) return
    setCreateSaving(true)
    try {
      const payload = {
        title: titleValue.trim(),
        subEngagements: normalizeSubs(subValues),
      }

      const res = await fetch(`${API_BASE}/engagement-templates`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to create engagement type")

      showToast("Engagement type created")
      setAddModalOpen(false)
      resetForm()
      await resetAndFetch()
    } catch (e) {
      showToast(e?.message || "Failed to create engagement type")
    } finally {
      setCreateSaving(false)
    }
  }

  /* ---------------- UPDATE ---------------- */
  const updateTemplate = async () => {
    if (!editingId) return
    if (!titleValue.trim()) return

    setUpdateSaving(true)
    try {
      const payload = {
        title: titleValue.trim(),
        subEngagements: normalizeSubs(subValues),
      }

      const res = await fetch(`${API_BASE}/engagement-templates/${editingId}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to update engagement type")

      showToast("Engagement type updated")
      setEditModalOpen(false)
      resetForm()
      await resetAndFetch()
    } catch (e) {
      showToast(e?.message || "Failed to update engagement type")
    } finally {
      setUpdateSaving(false)
    }
  }

  /* ---------------- DELETE ---------------- */
  const confirmDelete = async () => {
    if (!deleteModal?.id) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`${API_BASE}/engagement-templates/${deleteModal.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to delete engagement type")

      showToast("Engagement type deleted")
      setDeleteModal({ open: false, id: null })

      setOpenIds((prev) => {
        const next = new Set(prev)
        next.delete(String(deleteModal.id))
        return next
      })

      await resetAndFetch()
    } catch (e) {
      showToast(e?.message || "Failed to delete engagement type")
    } finally {
      setDeleteLoading(false)
    }
  }

  /* ---------------- ACCORDION ---------------- */
  const toggleOpen = (id) => {
    const sid = String(id)
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(sid)) next.delete(sid)
      else next.add(sid)
      return next
    })
  }

  // Customers-page style skeleton logic:
  // - skeletons only when initial load and list is empty
  // - when loadingMore, keep list and show spinner / small skeletons below
  const isInitialLoading = loading && templates.length === 0
  const showRowSkeletons = isInitialLoading ? 8 : 0
  const showLoadMoreSkeletons = !isInitialLoading && loadingMore && sortedTemplates.length > 0

  return (
    <div className="min-h-screen bg-gray-50/60 p-4 sm:p-6 lg:p-8">
      <Toast message={toast} />

      <ConfirmDeleteModal
        open={deleteModal.open}
        title="Delete engagement type?"
        description="This will permanently delete the engagement type and all sub-engagements."
        loading={deleteLoading}
        onClose={() => !deleteLoading && setDeleteModal({ open: false, id: null })}
        onConfirm={confirmDelete}
      />

      <EngagementTemplateModal
        open={addModalOpen}
        loading={createSaving}
        mode="add"
        value={titleValue}
        subEngagements={subValues}
        onClose={() => !createSaving && setAddModalOpen(false)}
        onChangeValue={setTitleValue}
        onChangeSubs={setSubValues}
        onAddSub={addSubInput}
        onRemoveSub={removeSubInput}
        onSubmit={createTemplate}
      />

      <EngagementTemplateModal
        open={editModalOpen}
        loading={updateSaving}
        mode="edit"
        value={titleValue}
        subEngagements={subValues}
        onClose={() => !updateSaving && setEditModalOpen(false)}
        onChangeValue={setTitleValue}
        onChangeSubs={setSubValues}
        onAddSub={addSubInput}
        onRemoveSub={removeSubInput}
        onSubmit={updateTemplate}
      />

      <div className="max-w-6xl mx-auto space-y-6">
        {/* HEADER */}
        {isInitialLoading ? (
          <HeaderSkeleton />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-5 sm:p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <FiLayers className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                    Engagement Type Templates
                  </h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Single title or title with sub-engagements • Cursor pagination
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <button
                  onClick={resetAndFetch}
                  disabled={loading || loadingMore}
                  className={[
                    "inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold disabled:opacity-60",
                    focusableBtnClass,
                  ].join(" ")}
                >
                  <FiRefreshCw />
                  Refresh
                </button>

                <button
                  onClick={openAddModal}
                  className={[
                    "inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold",
                    focusableBtnClass,
                  ].join(" ")}
                >
                  <FiPlus />
                  Add Engagement Type
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search engagement types..."
                  className={searchInputClass}
                />
              </div>

              <div className="h-12 rounded-xl border border-gray-200 bg-white px-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-gray-900 shrink-0">Sort</p>
                <select value={sortMode} onChange={(e) => setSortMode(e.target.value)} className={selectClass}>
                  <option value="title">Title (A–Z)</option>
                  <option value="newest">Newest</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* LIST */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-lg overflow-hidden">
          {isInitialLoading ? (
            <ListHeaderSkeleton />
          ) : (
            <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FiLayers />
                <h3 className="text-sm font-semibold">All Engagement Types</h3>
              </div>

              <div className="text-xs text-gray-500">
                {loading ? "Loading…" : `${sortedTemplates.length} loaded${hasMore ? " • more available" : ""}`}
              </div>
            </div>
          )}

          <div className="divide-y divide-gray-100">
            {showRowSkeletons ? (
              <>
                {Array.from({ length: showRowSkeletons }).map((_, i) => (
                  <RowSkeleton key={`sk-${i}`} />
                ))}
              </>
            ) : sortedTemplates.length ? (
              <>
                {sortedTemplates.map((t) => {
                  const isOpen = openIds.has(String(t._id))
                  const subCount = Array.isArray(t?.subEngagements) ? t.subEngagements.length : 0

                  return (
                    <div key={t._id} className="hover:bg-gray-50/60">
                      <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <button
                          type="button"
                          onClick={() => toggleOpen(t._id)}
                          className={["flex-1 min-w-0 text-left", focusableBtnClass].join(" ")}
                          aria-expanded={isOpen}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FiFolder className="text-indigo-500 shrink-0" />
                            <span className="truncate font-semibold text-gray-900">{t.title}</span>
                          </div>

                          <p className="mt-1 text-xs text-gray-500">
                            {subCount ? `${subCount} sub-engagement${subCount === 1 ? "" : "s"}` : "No sub-engagements"}
                          </p>
                        </button>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleOpen(t._id)}
                            className={[
                              "h-9 w-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50",
                              focusableBtnClass,
                            ].join(" ")}
                            aria-label={isOpen ? "Collapse" : "Expand"}
                            title={isOpen ? "Hide sub-engagements" : "Show sub-engagements"}
                          >
                            <FiChevronDown
                              className={[
                                "transition-transform duration-300 ease-out",
                                isOpen ? "rotate-180" : "rotate-0",
                              ].join(" ")}
                            />
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditModal(t)}
                            className={[
                              "h-9 w-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50",
                              focusableBtnClass,
                            ].join(" ")}
                            aria-label="Edit engagement type"
                            title="Edit"
                          >
                            <FiEdit2 />
                          </button>

                          <button
                            onClick={() => setDeleteModal({ open: true, id: t._id })}
                            className={[
                              "h-9 w-9 flex items-center justify-center rounded-xl border border-red-200 text-red-600 hover:bg-red-50",
                              focusableBtnClass,
                            ].join(" ")}
                            aria-label="Delete engagement type"
                            title="Delete"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </div>

                      <SmoothCollapse open={isOpen}>
                        <div className="px-5 sm:px-6 pb-6 -mt-2">
                          <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
                            {subCount ? (
                              <ul className="text-sm text-gray-700 space-y-2">
                                {t.subEngagements.map((s) => (
                                  <li key={s?._id || s?.text} className="flex items-start gap-2">
                                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
                                    <span className="break-words">{s?.text || "—"}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-gray-500">
                                No sub-engagements for this engagement type.
                              </p>
                            )}
                          </div>

                          <div className="mt-3 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => openEditModal(t)}
                              className={[
                                "inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold",
                                focusableBtnClass,
                              ].join(" ")}
                            >
                              <FiEdit2 />
                              Edit this engagement type
                            </button>
                          </div>
                        </div>
                      </SmoothCollapse>
                    </div>
                  )
                })}

                {/* load-more skeletons (keeps the list alive like customers page) */}
                {showLoadMoreSkeletons ? (
                  <>
                    <RowSkeleton />
                    <RowSkeleton />
                  </>
                ) : null}
              </>
            ) : (
              <div className="p-10 text-center text-gray-500 text-sm">
                No engagement types found. Try clearing search.
              </div>
            )}
          </div>

          {/* Footer + Load more */}
          <div className="p-4 border-t border-gray-100 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs text-gray-500">
              Loaded {sortedTemplates.length} • Page size {PAGE_SIZE}
            </p>

            {hasMore ? (
              <button
                onClick={() => fetchTemplates({ reset: false })}
                disabled={loadingMore || loading}
                className={[
                  "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold disabled:opacity-60",
                  focusableBtnClass,
                ].join(" ")}
                title={loading ? "Please wait" : "Load next page"}
              >
                {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            ) : (
              <span className="text-xs text-gray-400">No more</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
