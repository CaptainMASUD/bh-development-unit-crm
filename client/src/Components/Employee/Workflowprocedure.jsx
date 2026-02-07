"use client"

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { FiLayers, FiFolder, FiChevronDown, FiSearch, FiRefreshCw } from "react-icons/fi"
import { Loader2 } from "lucide-react"

// ✅ File-type icons (react-icons/fa6) + clean color per type
import {
  FaFilePdf,
  FaFileImage,
  FaFileWord,
  FaFileExcel,
  FaFilePowerpoint,
  FaFileVideo,
  FaFileAudio,
  FaFileZipper,
  FaFileCode,
  FaFileLines,
  FaFile,
  FaAndroid,
} from "react-icons/fa6"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const PAGE_SIZE = 20

const authHeaders = () => ({
  "Content-Type": "application/json",
  ...(localStorage.getItem("token")
    ? { Authorization: `Bearer ${localStorage.getItem("token")}` }
    : {}),
})

/* ================= SHARED UI CLASSES ================= */
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
        {message}
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

/* ================= ICON HELPERS ================= */
function bytesToKB(size) {
  if (!Number.isFinite(size)) return ""
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function extFromName(name = "") {
  const n = String(name || "")
  const i = n.lastIndexOf(".")
  return i >= 0 ? n.slice(i + 1).toLowerCase() : ""
}

/* ✅ File type → icon + color */
function fileMetaFrom(name, type) {
  const ext = extFromName(name)
  const t = String(type || "").toLowerCase()

  const isPdf = ext === "pdf" || t.includes("pdf")
  const isImg =
    ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "tiff", "ico"].includes(ext) ||
    t.startsWith("image/")
  const isSheet =
    ["xls", "xlsx", "csv", "ods"].includes(ext) ||
    t.includes("spreadsheet") ||
    t.includes("excel") ||
    t.includes("sheet")
  const isPpt = ["ppt", "pptx", "key"].includes(ext) || t.includes("presentation") || t.includes("powerpoint")
  const isDoc =
    ["doc", "docx", "txt", "rtf", "md", "odt"].includes(ext) ||
    t.includes("word") ||
    t.includes("text") ||
    t.includes("document")
  const isVideo = ["mp4", "mov", "mkv", "webm", "avi", "m4v"].includes(ext) || t.startsWith("video/")
  const isAudio = ["mp3", "wav", "aac", "m4a", "ogg", "flac"].includes(ext) || t.startsWith("audio/")
  const isZip = ["zip", "rar", "7z", "tar", "gz"].includes(ext) || t.includes("zip") || t.includes("compressed")
  const isApk = ext === "apk" || t.includes("android.package-archive")
  const isCode = [
    "js",
    "ts",
    "jsx",
    "tsx",
    "json",
    "html",
    "css",
    "py",
    "java",
    "php",
    "go",
    "rs",
    "c",
    "cpp",
    "cs",
    "sh",
    "yml",
    "yaml",
    "xml",
  ].includes(ext)

  if (isPdf) return { Icon: FaFilePdf, color: "text-red-600" }
  if (isSheet) return { Icon: FaFileExcel, color: "text-emerald-600" }
  if (isPpt) return { Icon: FaFilePowerpoint, color: "text-orange-600" }
  if (isDoc) return { Icon: FaFileWord, color: "text-blue-600" }
  if (isImg) return { Icon: FaFileImage, color: "text-fuchsia-600" }
  if (isVideo) return { Icon: FaFileVideo, color: "text-purple-600" }
  if (isAudio) return { Icon: FaFileAudio, color: "text-cyan-600" }
  if (isZip) return { Icon: FaFileZipper, color: "text-amber-700" }
  if (isApk) return { Icon: FaAndroid, color: "text-green-700" }
  if (isCode) return { Icon: FaFileCode, color: "text-slate-700" }
  if (ext) return { Icon: FaFile, color: "text-gray-600" }
  return { Icon: FaFileLines, color: "text-gray-600" }
}

function FileFormatIcon({ name, type }) {
  const { Icon, color } = fileMetaFrom(name, type)
  return <Icon className={`w-4 h-4 ${color}`} />
}

/* ================= SKELETONS ================= */
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
        <div className="h-4 w-28 rounded bg-gray-200" />
      </div>
      <div className="animate-pulse">
        <div className="h-3 w-36 rounded bg-gray-200" />
      </div>
    </div>
  )
}

/* ================= PAGE ================= */
/**
 * ✅ Employee panel (READ ONLY)
 * ✅ File name: WorkflowProcedure.jsx
 * ✅ Header text: Workflow Procedure
 * ✅ "Subtitles" label renamed to "Work"
 * ✅ Removed ALL CRUD: add/edit/delete, upload/replace/rename/remove file
 */
export default function WorkflowProcedurePage() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false) // reset fetch (search/sort/first load)
  const [loadingMore, setLoadingMore] = useState(false) // pagination
  const [toast, setToast] = useState("")

  const [openIds, setOpenIds] = useState(() => new Set())

  const [q, setQ] = useState("")
  const [qDebounced, setQDebounced] = useState("")
  const [sortMode, setSortMode] = useState("title")

  const [nextCursor, setNextCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)

  // abort controller + toast timer
  const abortRef = useRef(null)
  const toastTimerRef = useRef(null)

  const showToast = useCallback((msg) => {
    setToast(msg)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(""), 2000)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    }
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
      if (qDebounced) qs.set("q", qDebounced)
      if (!reset && cursor) qs.set("cursor", String(cursor))
      return `${API_BASE}/task-templates?${qs.toString()}`
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
        if (!res.ok) throw new Error(data?.message || "Failed to fetch workflow procedures")

        const rows = Array.isArray(data?.templates) ? data.templates : []

        // ✅ Keep old list until new results arrive; replace only when data arrives
        setTemplates((prev) => (reset ? rows : [...prev, ...rows]))
        setNextCursor(data?.nextCursor || null)
        setHasMore(!!data?.hasMore)
      } catch (e) {
        if (e?.name !== "AbortError") {
          showToast(e?.message || "Failed to load workflow procedures")
          if (reset && templates.length === 0) {
            setNextCursor(null)
            setHasMore(false)
          }
        }
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [buildUrl, nextCursor, showToast, templates.length]
  )

  const resetAndFetch = useCallback(async () => {
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
    // if sortMode === "newest", server should return newest first; keep as-is.
    return arr
  }, [templates, sortMode])

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

  /* ---------------- LOADING UI ---------------- */
  const showRowSkeletons = templates.length === 0 && loading ? 8 : 0
  const showLoadMoreSkeletons = !loading && loadingMore && sortedTemplates.length > 0

  return (
    <div className="min-h-screen bg-gray-50/60 p-4 sm:p-6 lg:p-8">
      <Toast message={toast} />

      <div className="max-w-6xl mx-auto space-y-6">
        {/* ✅ HEADER (ALWAYS MOUNTED) */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-5 sm:p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <FiLayers className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Workflow Procedure</h1>
                <p className="text-sm text-gray-500 mt-1">Procedures • Work • Files</p>
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
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FiRefreshCw />}
                Refresh
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search workflow procedures..."
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

        {/* LIST */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-lg overflow-hidden">
          {templates.length === 0 && loading ? (
            <ListHeaderSkeleton />
          ) : (
            <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FiLayers />
                <h3 className="text-sm font-semibold">All Workflow Procedures</h3>
              </div>

              <div className="text-xs text-gray-500 flex items-center gap-2">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Searching…
                  </>
                ) : (
                  `${sortedTemplates.length} loaded${hasMore ? " • more available" : ""}`
                )}
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
                  const workCount = Array.isArray(t?.subtitles) ? t.subtitles.length : 0

                  return (
                    <div key={t._id} className="hover:bg-gray-50/60">
                      <div className="p-5 sm:p-6 flex items-start justify-between gap-4">
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
                            {workCount ? `${workCount} work item${workCount === 1 ? "" : "s"}` : "No work items"}
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleOpen(t._id)}
                          className={[
                            "h-9 w-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 shrink-0",
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
                      </div>

                      <SmoothCollapse open={isOpen}>
                        <div className="px-5 sm:px-6 pb-6 -mt-2">
                          <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
                            {workCount ? (
                              <ul className="text-sm text-gray-700 space-y-3">
                                {t.subtitles.map((s) => {
                                  const files = Array.isArray(s?.files) ? s.files : []

                                  return (
                                    <li key={s?._id || s?.text} className="flex flex-col gap-2">
                                      {/* Work item line */}
                                      <div className="flex items-start gap-2 min-w-0">
                                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
                                        <span className="break-words font-medium text-gray-900">{s?.text || "—"}</span>
                                      </div>

                                      {/* Files (view only) */}
                                      {files.length ? (
                                        <div className="ml-4 rounded-xl border border-gray-100 bg-white p-3">
                                          <div className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-2">
                                            <FaFileLines className="w-4 h-4 text-gray-600" /> Files ({files.length})
                                          </div>

                                          <ul className="space-y-2">
                                            {files.map((f) => (
                                              <li
                                                key={f._id}
                                                className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2"
                                              >
                                                <div className="min-w-0 flex items-start gap-2">
                                                  <div className="mt-0.5">
                                                    <FileFormatIcon name={f.name} type={f.type} />
                                                  </div>

                                                  <div className="min-w-0">
                                                    <a
                                                      href={f.url}
                                                      target="_blank"
                                                      rel="noreferrer"
                                                      className="text-xs font-semibold text-indigo-700 hover:underline truncate block"
                                                      title={f.name}
                                                    >
                                                      {f.name}
                                                    </a>
                                                    <div className="text-[11px] text-gray-500 truncate">
                                                      {bytesToKB(f.size)}
                                                    </div>
                                                  </div>
                                                </div>
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      ) : (
                                        <p className="ml-4 text-xs text-gray-500">No files available.</p>
                                      )}
                                    </li>
                                  )
                                })}
                              </ul>
                            ) : (
                              <p className="text-sm text-gray-500">No work items for this procedure.</p>
                            )}
                          </div>
                        </div>
                      </SmoothCollapse>
                    </div>
                  )
                })}

                {showLoadMoreSkeletons ? (
                  <>
                    <RowSkeleton />
                    <RowSkeleton />
                  </>
                ) : null}
              </>
            ) : (
              <div className="p-10 text-center text-gray-500 text-sm">No workflow procedures found.</div>
            )}
          </div>

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
