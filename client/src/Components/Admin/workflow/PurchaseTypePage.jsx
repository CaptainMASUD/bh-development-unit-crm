"use client"

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import {
  FiPlus,
  FiTrash2,
  FiCheck,
  FiLayers,
  FiFolder,
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
  "w-full h-11 px-4 rounded-2xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 placeholder:text-gray-400"

const searchInputClass =
  "w-full h-12 pl-10 pr-3 rounded-2xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 placeholder:text-gray-400"

const selectClass =
  "h-12 w-full px-3 rounded-2xl border border-gray-200 bg-white text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"

const focusableBtnClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-2"

const cardClass =
  "bg-white rounded-2xl border border-gray-100 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.35)]"

/* ================= HELPERS ================= */
const makeKeyClient = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

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

/* ================= TOGGLER (MATCH FILTER MODAL TOGGLE SIZE/DESIGN) ================= */
function BlueToggle({
  checked,
  onChange,
  disabled,
  labelLeft = "Active",
  labelOn = "Show",
  labelOff = "Hide",
  labelRight,
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-extrabold text-gray-900">{labelLeft}</p>
        {labelRight ? <p className="text-xs text-gray-500 font-semibold mt-0.5">{labelRight}</p> : null}
      </div>

      <button
        type="button"
        onClick={() => !disabled && onChange?.(!checked)}
        disabled={disabled}
        className={[
          "inline-flex items-center justify-between gap-3",
          "px-3 py-2 rounded-2xl border",
          checked ? "border-indigo-200 bg-indigo-50" : "border-gray-200 bg-white hover:bg-gray-50",
          "transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
          disabled ? "opacity-60 cursor-not-allowed" : "",
          focusableBtnClass,
        ].join(" ")}
        aria-pressed={!!checked}
        aria-label="Toggle"
        role="switch"
        aria-checked={!!checked}
      >
        <div className="flex items-center gap-2">
          <span
            className={[
              "relative inline-flex h-6 w-11 items-center rounded-full transition",
              checked ? "bg-indigo-600" : "bg-gray-300",
            ].join(" ")}
            aria-hidden="true"
          >
            <span
              className={[
                "inline-block h-5 w-5 transform rounded-full bg-white transition",
                checked ? "translate-x-5" : "translate-x-1",
              ].join(" ")}
            />
          </span>

          <span className="text-sm font-extrabold text-gray-900">{checked ? labelOn : labelOff}</span>
        </div>
      </button>
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

      <div className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
        <div className="p-5 flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
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
              "p-2 rounded-2xl border border-gray-200 hover:bg-gray-50 disabled:opacity-60",
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
              "px-4 py-2 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold disabled:opacity-60",
              focusableBtnClass,
            ].join(" ")}
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            disabled={loading}
            className={[
              "px-4 py-2 rounded-2xl bg-red-600 text-white hover:bg-red-700 text-sm font-semibold flex items-center gap-2 disabled:opacity-60",
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

/* ================= PURCHASE TYPE MODAL ================= */
function PurchaseTypeModal({
  open,
  loading,
  mode, // "add" | "edit"
  name,
  keyValue,
  isActive,
  onClose,
  onChangeName,
  onChangeKey,
  onChangeActive,
  onSubmit,
}) {
  const closeBtnRef = useRef(null)
  const nameInputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      closeBtnRef.current?.focus()
      nameInputRef.current?.focus()
      nameInputRef.current?.select?.()
    }, 60)
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

  if (!open) return null

  const isEdit = mode === "edit"
  const title = isEdit ? "Edit Purchase Type" : "New Purchase Type"
  const canSave = name.trim().length > 0 && !loading

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => !loading && onClose?.()} />

      <div className="relative w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
        {/* Top bar */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-lg font-extrabold text-gray-900 tracking-tight">{title}</h3>
            <p className="text-sm text-gray-600 mt-1">Keep it simple. Name is required, key is optional.</p>
          </div>

          <button
            ref={closeBtnRef}
            onClick={onClose}
            disabled={loading}
            className={[
              "h-10 w-10 rounded-2xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center disabled:opacity-60",
              focusableBtnClass,
            ].join(" ")}
            aria-label="Close"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-2">Name</label>
              <input
                ref={nameInputRef}
                value={name}
                onChange={(e) => onChangeName(e.target.value)}
                placeholder='e.g. "Bulk Purchase"'
                className={inputClass}
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-2">Tip: use short, clear names.</p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-2">Key</label>
              <input
                value={keyValue}
                onChange={(e) => onChangeKey(e.target.value)}
                placeholder="Auto from name (optional)"
                className={inputClass}
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-2">Tip: leave empty to auto-generate.</p>
            </div>

            <div className="md:col-span-2">
              <div className="rounded-3xl border border-gray-200 bg-white p-4">
                <BlueToggle
                  checked={!!isActive}
                  onChange={onChangeActive}
                  disabled={loading}
                  labelLeft="Active"
                  labelRight="Turn off to hide this type."
                  labelOn="Show"
                  labelOff="Hide"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-gray-100 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500 hidden sm:block">
            Shortcut: <span className="font-semibold">Ctrl/⌘</span> +{" "}
            <span className="font-semibold">Enter</span>
          </p>

          <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              disabled={loading}
              className={[
                "px-4 py-2.5 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold disabled:opacity-60",
                focusableBtnClass,
              ].join(" ")}
            >
              Cancel
            </button>

            <button
              onClick={onSubmit}
              disabled={!canSave}
              className={[
                "inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold disabled:opacity-60",
                focusableBtnClass,
              ].join(" ")}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <FiCheck />
                  Save
                </>
              )}
            </button>
          </div>
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

/* ================= SKELETONS ================= */
function SkeletonBar({ className = "h-4 w-40" }) {
  return <div className={`rounded bg-gray-200 ${className}`} />
}

function HeaderSkeleton() {
  return (
    <div className={`${cardClass} p-5 sm:p-6 space-y-4`}>
      <div className="animate-pulse">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gray-200" />
            <div className="min-w-0">
              <SkeletonBar className="h-6 w-56" />
              <SkeletonBar className="h-4 w-72 mt-2" />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <SkeletonBar className="h-10 w-28 rounded-2xl" />
            <SkeletonBar className="h-10 w-28 rounded-2xl" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <div className="h-12 rounded-2xl bg-gray-200" />
          <div className="h-12 rounded-2xl bg-gray-200" />
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
            <div className="mt-2 h-3 w-40 rounded bg-gray-200" />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="h-9 w-9 rounded-2xl bg-gray-200" />
            <div className="h-9 w-9 rounded-2xl bg-gray-200" />
            <div className="h-9 w-9 rounded-2xl bg-gray-200" />
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
        <div className="h-4 w-28 rounded bg-gray-200" />
      </div>
      <div className="animate-pulse">
        <div className="h-3 w-36 rounded bg-gray-200" />
      </div>
    </div>
  )
}

/* ================= PAGE ================= */
export default function PurchaseTypePage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [toast, setToast] = useState("")

  const [deleteModal, setDeleteModal] = useState({ open: false, id: null, name: "" })
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [updateSaving, setUpdateSaving] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [nameValue, setNameValue] = useState("")
  const [keyValue, setKeyValue] = useState("")
  const [activeValue, setActiveValue] = useState(true)

  const [openIds, setOpenIds] = useState(() => new Set())

  const [q, setQ] = useState("")
  const [qDebounced, setQDebounced] = useState("")
  const [activeFilter, setActiveFilter] = useState("true") // true | false | all

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
      qs.set("active", String(activeFilter))
      if (qDebounced) qs.set("q", qDebounced)
      if (!reset && cursor) qs.set("cursor", String(cursor))
      return `${API_BASE}/purchase-types?${qs.toString()}`
    },
    [qDebounced, activeFilter]
  )

  const fetchItems = useCallback(
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
        if (!res.ok) throw new Error(data?.message || "Failed to fetch purchase types")

        const rows = Array.isArray(data?.items) ? data.items : []
        const pageInfo = data?.pageInfo || {}

        setItems((prev) => (reset ? rows : [...prev, ...rows]))
        setNextCursor(pageInfo?.nextCursor || null)
        setHasMore(!!pageInfo?.hasNextPage)
      } catch (e) {
        if (e?.name !== "AbortError") {
          showToast(e?.message || "Failed to load purchase types")
          if (reset) {
            setItems([])
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
    setItems([])
    setNextCursor(null)
    setHasMore(false)
    setOpenIds(new Set())
    await fetchItems({ reset: true })
  }, [fetchItems])

  useEffect(() => {
    fetchItems({ reset: true })
    return () => abortRef.current?.abort?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    resetAndFetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter, qDebounced])

  const visibleItems = useMemo(() => {
    const arr = Array.isArray(items) ? items.slice() : []
    arr.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")))
    return arr
  }, [items])

  const resetForm = () => {
    setEditingId(null)
    setNameValue("")
    setKeyValue("")
    setActiveValue(true) // default ON
  }

  const openAddModal = () => {
    resetForm()
    setAddModalOpen(true)
  }

  const openEditModal = (it) => {
    setEditingId(String(it?._id))
    setNameValue(String(it?.name || ""))
    setKeyValue(String(it?.key || ""))
    setActiveValue(Boolean(it?.isActive))
    setEditModalOpen(true)
  }

  const toggleOpen = (id) => {
    const sid = String(id)
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(sid)) next.delete(sid)
      else next.add(sid)
      return next
    })
  }

  const createItem = async () => {
    if (!nameValue.trim()) return
    setCreateSaving(true)
    try {
      const payload = {
        name: nameValue.trim(),
        isActive: !!activeValue, // ✅ FIX: send isActive
        ...(keyValue.trim() ? { key: keyValue.trim() } : {}),
      }

      const res = await fetch(`${API_BASE}/purchase-types`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to create purchase type")

      showToast("Created")
      setAddModalOpen(false)
      resetForm()
      await resetAndFetch()
    } catch (e) {
      showToast(e?.message || "Failed to create")
    } finally {
      setCreateSaving(false)
    }
  }

  const updateItem = async () => {
    if (!editingId) return
    if (!nameValue.trim()) return

    setUpdateSaving(true)
    try {
      const payload = {
        name: nameValue.trim(),
        ...(keyValue.trim() ? { key: keyValue.trim() } : { key: "" }),
        isActive: !!activeValue,
      }

      const res = await fetch(`${API_BASE}/purchase-types/${editingId}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to update purchase type")

      showToast("Updated")
      setEditModalOpen(false)
      resetForm()
      await resetAndFetch()
    } catch (e) {
      showToast(e?.message || "Failed to update")
    } finally {
      setUpdateSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteModal?.id) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`${API_BASE}/purchase-types/${deleteModal.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to delete purchase type")

      showToast("Deleted")
      setDeleteModal({ open: false, id: null, name: "" })

      setOpenIds((prev) => {
        const next = new Set(prev)
        next.delete(String(deleteModal.id))
        return next
      })

      await resetAndFetch()
    } catch (e) {
      showToast(e?.message || "Failed to delete")
    } finally {
      setDeleteLoading(false)
    }
  }

  const isInitialLoading = loading && items.length === 0
  const showRowSkeletons = isInitialLoading ? 8 : 0
  const showLoadMoreSkeletons = !isInitialLoading && loadingMore && visibleItems.length > 0

  return (
    <div className="min-h-screen bg-gray-50/60 p-4 sm:p-6 lg:p-8">
      <Toast message={toast} />

      <ConfirmDeleteModal
        open={deleteModal.open}
        title="Delete purchase type?"
        description={`This will deactivate "${deleteModal.name || "this type"}".`}
        loading={deleteLoading}
        onClose={() => !deleteLoading && setDeleteModal({ open: false, id: null, name: "" })}
        onConfirm={confirmDelete}
      />

      {/* ✅ FIXED: Add modal now uses activeValue + setActiveValue */}
      <PurchaseTypeModal
        open={addModalOpen}
        loading={createSaving}
        mode="add"
        name={nameValue}
        keyValue={keyValue}
        isActive={activeValue}
        onClose={() => !createSaving && setAddModalOpen(false)}
        onChangeName={(v) => {
          setNameValue(v)
          if (!keyValue.trim()) setKeyValue(makeKeyClient(v))
        }}
        onChangeKey={setKeyValue}
        onChangeActive={setActiveValue}
        onSubmit={createItem}
      />

      <PurchaseTypeModal
        open={editModalOpen}
        loading={updateSaving}
        mode="edit"
        name={nameValue}
        keyValue={keyValue}
        isActive={activeValue}
        onClose={() => !updateSaving && setEditModalOpen(false)}
        onChangeName={(v) => {
          setNameValue(v)
          if (!keyValue.trim()) setKeyValue(makeKeyClient(v))
        }}
        onChangeKey={setKeyValue}
        onChangeActive={setActiveValue}
        onSubmit={updateItem}
      />

      <div className="max-w-6xl mx-auto space-y-6">
        {/* HEADER */}
        {isInitialLoading ? (
          <div className={`${cardClass} p-5 sm:p-6 space-y-4`}>
            <div className="animate-pulse">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gray-200" />
                  <div className="min-w-0">
                    <div className="rounded bg-gray-200 h-6 w-56" />
                    <div className="rounded bg-gray-200 h-4 w-72 mt-2" />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <div className="h-10 w-28 rounded-2xl bg-gray-200" />
                  <div className="h-10 w-28 rounded-2xl bg-gray-200" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                <div className="h-12 rounded-2xl bg-gray-200" />
                <div className="h-12 rounded-2xl bg-gray-200" />
              </div>
            </div>
          </div>
        ) : (
          <div className={`${cardClass} p-5 sm:p-6 space-y-4`}>
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <FiLayers className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
                    Purchase Types
                  </h1>
                  <p className="text-sm text-gray-500 mt-1">Search • Filter • Load more</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <button
                  onClick={resetAndFetch}
                  disabled={loading || loadingMore}
                  className={[
                    "inline-flex items-center justify-center gap-2 h-11 px-4 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold disabled:opacity-60",
                    focusableBtnClass,
                  ].join(" ")}
                >
                  <FiRefreshCw />
                  Refresh
                </button>

                <button
                  onClick={openAddModal}
                  className={[
                    "inline-flex items-center justify-center gap-2 h-11 px-4 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold",
                    focusableBtnClass,
                  ].join(" ")}
                >
                  <FiPlus />
                  Add
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
                  placeholder="Search by name or key"
                  className={searchInputClass}
                />
              </div>

              <div className="h-12 rounded-2xl border border-gray-200 bg-white px-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-gray-900 shrink-0">Status</p>
                <select
                  value={activeFilter}
                  onChange={(e) => setActiveFilter(e.target.value)}
                  className={selectClass}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                  <option value="all">All</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* LIST */}
        <div className={`${cardClass} overflow-hidden`}>
          {isInitialLoading ? (
            <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 animate-pulse">
                <div className="h-4 w-4 rounded bg-gray-200" />
                <div className="h-4 w-28 rounded bg-gray-200" />
              </div>
              <div className="animate-pulse">
                <div className="h-3 w-36 rounded bg-gray-200" />
              </div>
            </div>
          ) : (
            <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FiLayers />
                <h3 className="text-sm font-semibold">All Types</h3>
              </div>

              <div className="text-xs text-gray-500">
                {loading ? "Loading…" : `${visibleItems.length} loaded${hasMore ? " • more" : ""}`}
              </div>
            </div>
          )}

          <div className="divide-y divide-gray-100">
            {showRowSkeletons ? (
              <>
                {Array.from({ length: showRowSkeletons }).map((_, i) => (
                  <div key={`sk-${i}`} className="p-5 sm:p-6">
                    <div className="animate-pulse">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-4 w-4 rounded bg-gray-200 shrink-0" />
                            <div className="h-4 w-72 max-w-[90%] rounded bg-gray-200" />
                          </div>
                          <div className="mt-2 h-3 w-40 rounded bg-gray-200" />
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="h-9 w-9 rounded-2xl bg-gray-200" />
                          <div className="h-9 w-9 rounded-2xl bg-gray-200" />
                          <div className="h-9 w-9 rounded-2xl bg-gray-200" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : visibleItems.length ? (
              <>
                {visibleItems.map((t) => {
                  const isOpen = openIds.has(String(t._id))
                  const badge = t?.isActive
                    ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                    : "bg-gray-50 text-gray-700 border-gray-200"

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
                            <span className="truncate font-semibold text-gray-900">{t.name}</span>
                            <span className={`ml-2 text-xs px-2 py-1 rounded-xl border ${badge}`}>
                              {t.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>

                          <p className="mt-1 text-xs text-gray-500 break-all">{t.key || "—"}</p>
                        </button>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleOpen(t._id)}
                            className={[
                              "h-10 w-10 flex items-center justify-center rounded-2xl border border-gray-200 text-gray-700 hover:bg-gray-50",
                              focusableBtnClass,
                            ].join(" ")}
                            aria-label={isOpen ? "Collapse" : "Expand"}
                            title={isOpen ? "Hide" : "Show"}
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
                              "h-10 w-10 flex items-center justify-center rounded-2xl border border-gray-200 text-gray-700 hover:bg-gray-50",
                              focusableBtnClass,
                            ].join(" ")}
                            aria-label="Edit"
                            title="Edit"
                          >
                            <FiEdit2 />
                          </button>

                          <button
                            onClick={() => setDeleteModal({ open: true, id: t._id, name: t?.name || "" })}
                            className={[
                              "h-10 w-10 flex items-center justify-center rounded-2xl border border-red-200 text-red-600 hover:bg-red-50",
                              focusableBtnClass,
                            ].join(" ")}
                            aria-label="Delete"
                            title="Delete"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </div>

                      <SmoothCollapse open={isOpen}>
                        <div className="px-5 sm:px-6 pb-6 -mt-2">
                          <div className="rounded-3xl border border-gray-100 bg-gray-50/60 p-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                                <p className="text-xs font-semibold text-gray-500">Name</p>
                                <p className="text-sm font-semibold text-gray-900 mt-1 break-words">
                                  {t.name || "—"}
                                </p>
                              </div>

                              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                                <p className="text-xs font-semibold text-gray-500">Key</p>
                                <p className="text-sm font-semibold text-gray-900 mt-1 break-all">{t.key || "—"}</p>
                              </div>

                              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                                <p className="text-xs font-semibold text-gray-500">Status</p>
                                <p className="text-sm font-semibold text-gray-900 mt-1">
                                  {t.isActive ? "Active" : "Inactive"}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => openEditModal(t)}
                              className={[
                                "inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold",
                                focusableBtnClass,
                              ].join(" ")}
                            >
                              <FiEdit2 />
                              Edit
                            </button>
                          </div>
                        </div>
                      </SmoothCollapse>
                    </div>
                  )
                })}

                {showLoadMoreSkeletons ? (
                  <>
                    <div className="p-5 sm:p-6">
                      <div className="animate-pulse">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="h-4 w-4 rounded bg-gray-200 shrink-0" />
                              <div className="h-4 w-72 max-w-[90%] rounded bg-gray-200" />
                            </div>
                            <div className="mt-2 h-3 w-40 rounded bg-gray-200" />
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="h-9 w-9 rounded-2xl bg-gray-200" />
                            <div className="h-9 w-9 rounded-2xl bg-gray-200" />
                            <div className="h-9 w-9 rounded-2xl bg-gray-200" />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-5 sm:p-6">
                      <div className="animate-pulse">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="h-4 w-4 rounded bg-gray-200 shrink-0" />
                              <div className="h-4 w-72 max-w-[90%] rounded bg-gray-200" />
                            </div>
                            <div className="mt-2 h-3 w-40 rounded bg-gray-200" />
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="h-9 w-9 rounded-2xl bg-gray-200" />
                            <div className="h-9 w-9 rounded-2xl bg-gray-200" />
                            <div className="h-9 w-9 rounded-2xl bg-gray-200" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </>
            ) : (
              <div className="p-10 text-center text-gray-500 text-sm">No results.</div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-100 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs text-gray-500">
              Loaded {visibleItems.length} • Page size {PAGE_SIZE}
            </p>

            {hasMore ? (
              <button
                onClick={() => fetchItems({ reset: false })}
                disabled={loadingMore || loading}
                className={[
                  "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold disabled:opacity-60",
                  focusableBtnClass,
                ].join(" ")}
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
