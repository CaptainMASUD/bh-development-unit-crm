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
  FiUploadCloud,
} from "react-icons/fi"
import { AlertTriangle, X, Loader2, Pencil, RefreshCcw } from "lucide-react"

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

/* ================= BASE MODAL SHELL ================= */
function ModalShell({ open, onClose, children, disableClose, labelledBy }) {
  const closeBtnRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => closeBtnRef.current?.focus(), 60)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === "Escape" && !disableClose) onClose?.()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose, disableClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => (!disableClose ? onClose?.() : null)}
      />

      <div
        className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        <button
          ref={closeBtnRef}
          onClick={onClose}
          disabled={disableClose}
          className={[
            "absolute right-3 top-3 p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-60",
            focusableBtnClass,
          ].join(" ")}
          aria-label="Close"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {children}
      </div>
    </div>
  )
}

/* ================= CONFIRM MODAL ================= */
function ConfirmModal({
  open,
  title,
  description,
  icon,
  tone = "danger", // danger | neutral
  confirmText = "Confirm",
  cancelText = "Cancel",
  loading,
  onClose,
  onConfirm,
}) {
  const toneStyles =
    tone === "danger"
      ? {
          badge: "bg-red-50 border-red-100 text-red-600",
          confirm: "bg-red-600 hover:bg-red-700",
        }
      : {
          badge: "bg-gray-50 border-gray-200 text-gray-700",
          confirm: "bg-indigo-600 hover:bg-indigo-700",
        }

  return (
    <ModalShell open={open} onClose={onClose} disableClose={loading} labelledBy="confirm-title">
      <div className="p-5 flex items-start gap-3">
        <div
          className={[
            "w-10 h-10 rounded-xl border flex items-center justify-center",
            toneStyles.badge,
          ].join(" ")}
        >
          {icon}
        </div>

        <div className="flex-1 min-w-0 pr-10">
          <h3 id="confirm-title" className="text-base font-bold text-gray-900">
            {title}
          </h3>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        </div>
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
          {cancelText}
        </button>

        <button
          onClick={onConfirm}
          disabled={loading}
          className={[
            "px-4 py-2 rounded-xl text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-60",
            toneStyles.confirm,
            focusableBtnClass,
          ].join(" ")}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FiCheck />}
          {loading ? "Working..." : confirmText}
        </button>
      </div>
    </ModalShell>
  )
}

/* ================= RENAME FILE MODAL ================= */
function RenameFileModal({ open, loading, initialName, onClose, onSubmit }) {
  const [name, setName] = useState("")
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setName(String(initialName || ""))
    const t = setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select?.()
    }, 80)
    return () => clearTimeout(t)
  }, [open, initialName])

  const canSave = String(name || "").trim().length > 0 && !loading

  return (
    <ModalShell open={open} onClose={onClose} disableClose={loading} labelledBy="rename-title">
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Pencil className="w-5 h-5" />
          </div>
          <div className="flex-1 pr-10">
            <h3 id="rename-title" className="text-base font-bold text-gray-900">
              Rename file
            </h3>
            <p className="text-sm text-gray-600 mt-1">Enter a new name for the file.</p>
          </div>
        </div>
      </div>

      <div className="p-5">
        <label className="block text-xs font-semibold text-gray-600 mb-1">File name</label>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          placeholder="e.g. invoice.pdf"
          disabled={loading}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && canSave) {
              onSubmit?.(String(name).trim())
            }
          }}
        />
        <p className="text-xs text-gray-500 mt-2">
          Tip: Press <span className="font-semibold">Ctrl/⌘ + Enter</span> to save.
        </p>
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
          onClick={() => onSubmit?.(String(name).trim())}
          disabled={!canSave}
          className={[
            "px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60",
            focusableBtnClass,
          ].join(" ")}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FiCheck />}
          {loading ? "Saving..." : "Save"}
        </button>
      </div>
    </ModalShell>
  )
}

/* ================= REPLACE FILE MODAL ================= */
function ReplaceFileModal({ open, loading, currentName, onClose, onPickFile }) {
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => inputRef.current?.focus?.(), 80)
    return () => clearTimeout(t)
  }, [open])

  return (
    <ModalShell open={open} onClose={onClose} disableClose={loading} labelledBy="replace-title">
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700">
            <RefreshCcw className="w-5 h-5" />
          </div>
          <div className="flex-1 pr-10">
            <h3 id="replace-title" className="text-base font-bold text-gray-900">
              Replace file
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Choose a new file to replace: <span className="font-semibold">{currentName || "—"}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="p-5">
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onPickFile?.(f)
            e.target.value = ""
          }}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click?.()}
          disabled={loading}
          className={[
            "w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold disabled:opacity-60",
            focusableBtnClass,
          ].join(" ")}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FiUploadCloud />}
          {loading ? "Uploading..." : "Choose replacement file"}
        </button>

        <p className="text-xs text-gray-500 mt-2">
          The old file will be replaced with the new upload (same record, updated URL/size/type).
        </p>
      </div>

      <div className="px-5 pb-5 flex justify-end">
        <button
          onClick={onClose}
          disabled={loading}
          className={[
            "px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold disabled:opacity-60",
            focusableBtnClass,
          ].join(" ")}
        >
          Close
        </button>
      </div>
    </ModalShell>
  )
}

/* ================= ADD/EDIT MODAL (TEMPLATE) ================= */
function TemplateModal({
  open,
  loading,
  mode, // "add" | "edit"
  value,
  subtitles,
  onClose,
  onChangeValue,
  onChangeSubtitles,
  onAddSubtitle,
  onRemoveSubtitle,
  onSubmit,
}) {
  const closeBtnRef = useRef(null)
  const titleInputRef = useRef(null)

  const subtitleRefs = useRef([])
  const prevSubsLenRef = useRef((subtitles || []).length)

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
    const len = (subtitles || []).length
    const prev = prevSubsLenRef.current

    if (len > prev) {
      const t = setTimeout(() => {
        const el = subtitleRefs.current[len - 1]
        el?.focus?.()
        el?.select?.()
      }, 0)
      prevSubsLenRef.current = len
      return () => clearTimeout(t)
    }

    prevSubsLenRef.current = len
  }, [open, subtitles])

  if (!open) return null

  const heading = mode === "edit" ? "Update Title" : "Add New Title"
  const subHeading =
    mode === "edit" ? "Update the title and subtitles." : "Create a reusable task title with structured subtitles."
  const submitLabel = mode === "edit" ? "Update" : "Save Title"
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
              <label className="block text-xs font-semibold text-gray-600 mb-1">Title</label>
              <input
                ref={titleInputRef}
                value={value}
                onChange={(e) => onChangeValue(e.target.value)}
                placeholder="Title (e.g. A. Administrative Documents)"
                className={inputClass}
                disabled={loading}
              />
            </div>

            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                <FiHash /> Subtitles
              </div>

              <div className="mt-3 space-y-2">
                {(subtitles || []).map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      ref={(el) => {
                        subtitleRefs.current[i] = el
                      }}
                      value={s}
                      onChange={(e) => {
                        const next = [...subtitles]
                        next[i] = e.target.value
                        onChangeSubtitles(next)
                      }}
                      placeholder={`Subtitle ${i + 1}`}
                      className={subtitleInputClass}
                      disabled={loading}
                    />

                    <button
                      type="button"
                      onClick={() => onRemoveSubtitle(i)}
                      disabled={loading || subtitles.length <= 1}
                      className={[
                        "h-10 w-10 flex items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50",
                        focusableBtnClass,
                      ].join(" ")}
                      title={subtitles.length <= 1 ? "Keep at least one subtitle input" : "Remove"}
                      aria-label="Remove subtitle"
                    >
                      <FiX />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <button
                  type="button"
                  onClick={onAddSubtitle}
                  disabled={loading}
                  className={[
                    "inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold disabled:opacity-60",
                    focusableBtnClass,
                  ].join(" ")}
                >
                  <FiPlus /> Add Subtitle
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
function SkeletonBar({ className = "h-4 w-40" }) {
  return <div className={`rounded bg-gray-200 ${className}`} />
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
        <div className="h-4 w-28 rounded bg-gray-200" />
      </div>
      <div className="animate-pulse">
        <div className="h-3 w-36 rounded bg-gray-200" />
      </div>
    </div>
  )
}

/* ================= PAGE ================= */
export default function TaskTemplatePage() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false) // reset fetch (search/sort/first load)
  const [loadingMore, setLoadingMore] = useState(false) // pagination
  const [toast, setToast] = useState("")

  // title delete modal
  const [deleteModal, setDeleteModal] = useState({ open: false, id: null })
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [updateSaving, setUpdateSaving] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [titleValue, setTitleValue] = useState("")
  const [subtitleValues, setSubtitleValues] = useState([""])

  const [openIds, setOpenIds] = useState(() => new Set())

  const [q, setQ] = useState("")
  const [qDebounced, setQDebounced] = useState("")
  const [sortMode, setSortMode] = useState("title")

  const [nextCursor, setNextCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)

  // upload state
  const [uploadingKey, setUploadingKey] = useState(null) // `${tplId}:${subtitleId}`
  const [fileBusyKey, setFileBusyKey] = useState(null) // `${tplId}:${subtitleId}:${fileId}`

  // file action modals (rename/replace/delete)
  const [renameModal, setRenameModal] = useState({
    open: false,
    tplId: null,
    subtitleId: null,
    fileId: null,
    currentName: "",
  })
  const [renameLoading, setRenameLoading] = useState(false)

  const [replaceModal, setReplaceModal] = useState({
    open: false,
    tplId: null,
    subtitleId: null,
    fileId: null,
    currentName: "",
  })
  const [replaceLoading, setReplaceLoading] = useState(false)

  const [fileDeleteModal, setFileDeleteModal] = useState({
    open: false,
    tplId: null,
    subtitleId: null,
    fileId: null,
    currentName: "",
  })
  const [fileDeleteLoading, setFileDeleteLoading] = useState(false)

  // abort controller + toast timer
  const abortRef = useRef(null)
  const toastTimerRef = useRef(null)

  // hidden file input refs: upload
  const uploadInputRefs = useRef({})

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
        if (!res.ok) throw new Error(data?.message || "Failed to fetch templates")

        const rows = Array.isArray(data?.templates) ? data.templates : []

        // ✅ IMPORTANT: do not clear list before fetch; replace only when data arrives
        setTemplates((prev) => (reset ? rows : [...prev, ...rows]))
        setNextCursor(data?.nextCursor || null)
        setHasMore(!!data?.hasMore)
      } catch (e) {
        if (e?.name !== "AbortError") {
          showToast(e?.message || "Failed to load templates")
          // keep current list; don't wipe UI while user types
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
    // ✅ keep header + input mounted; keep old list until new results come
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

  /* ---------------- FORM HELPERS ---------------- */
  const resetForm = () => {
    setEditingId(null)
    setTitleValue("")
    setSubtitleValues([""])
  }

  const removeSubtitleInput = (idx) => {
    setSubtitleValues((p) => {
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

  const openEditModal = (tpl) => {
    const subs = Array.isArray(tpl?.subtitles) ? tpl.subtitles : []
    const texts = subs.map((s) => String(s?.text || "").trim()).filter(Boolean)

    setEditingId(String(tpl?._id))
    setTitleValue(String(tpl?.title || ""))
    setSubtitleValues(texts.length ? texts : [""])
    setEditModalOpen(true)
  }

  /* ---------------- CREATE ---------------- */
  const createTemplate = async () => {
    if (!titleValue.trim()) return
    setCreateSaving(true)
    try {
      const payload = { title: titleValue.trim(), subtitles: normalizeSubs(subtitleValues) }

      const res = await fetch(`${API_BASE}/task-templates`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to create title")

      showToast("Title created")
      setAddModalOpen(false)
      resetForm()
      await resetAndFetch()
    } catch (e) {
      showToast(e?.message || "Failed to create title")
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
      const payload = { title: titleValue.trim(), subtitles: normalizeSubs(subtitleValues) }

      const res = await fetch(`${API_BASE}/task-templates/${editingId}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to update title")

      showToast("Title updated")
      setEditModalOpen(false)
      resetForm()
      await resetAndFetch()
    } catch (e) {
      showToast(e?.message || "Failed to update title")
    } finally {
      setUpdateSaving(false)
    }
  }

  /* ---------------- DELETE TITLE ---------------- */
  const confirmDelete = async () => {
    if (!deleteModal?.id) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`${API_BASE}/task-templates/${deleteModal.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to delete title")

      showToast("Title deleted")
      setDeleteModal({ open: false, id: null })

      setOpenIds((prev) => {
        const next = new Set(prev)
        next.delete(String(deleteModal.id))
        return next
      })

      await resetAndFetch()
    } catch (e) {
      showToast(e?.message || "Failed to delete title")
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

  /* ---------------- SUBTITLE FILES ---------------- */
  const pickUploadForSubtitle = (tplId, subtitleId) => {
    const k = `${tplId}:${subtitleId}`
    uploadInputRefs.current[k]?.click?.()
  }

  const uploadSubtitleFile = async (tplId, subtitleId, file) => {
    if (!file) return
    const uKey = `${tplId}:${subtitleId}`
    setUploadingKey(uKey)

    try {
      const presignRes = await fetch(`${API_BASE}/upload/presign`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          scope: "templateSubtitle",
          templateId: tplId,
          subtitleId,
        }),
      })
      const presignData = await presignRes.json().catch(() => ({}))
      if (!presignRes.ok) throw new Error(presignData?.message || "Could not start upload")

      const putRes = await fetch(presignData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      })
      if (!putRes.ok) throw new Error("Upload failed")

      const attachRes = await fetch(`${API_BASE}/task-templates/${tplId}/subtitles/${subtitleId}/files`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          key: presignData.key,
          url: presignData.url,
          name: file.name,
          type: file.type || "",
          size: file.size,
        }),
      })
      const attachData = await attachRes.json().catch(() => ({}))
      if (!attachRes.ok) throw new Error(attachData?.message || "Could not save file info")

      const updatedTpl = attachData?.template
      if (updatedTpl?._id) {
        setTemplates((prev) => prev.map((t) => (String(t._id) === String(updatedTpl._id) ? updatedTpl : t)))
      } else {
        await resetAndFetch()
      }

      showToast("File uploaded")
    } catch (e) {
      showToast(e?.message || "File upload failed")
    } finally {
      setUploadingKey(null)
      const k = `${tplId}:${subtitleId}`
      const input = uploadInputRefs.current[k]
      if (input) input.value = ""
    }
  }

  const deleteSubtitleFile = async (tplId, subtitleId, fileId) => {
    const busy = `${tplId}:${subtitleId}:${fileId}`
    setFileBusyKey(busy)
    try {
      const res = await fetch(`${API_BASE}/task-templates/${tplId}/subtitles/${subtitleId}/files/${fileId}`, {
        method: "DELETE",
        headers: authHeaders(),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Could not remove file")

      const updatedTpl = data?.template
      if (updatedTpl?._id) {
        setTemplates((prev) => prev.map((t) => (String(t._id) === String(updatedTpl._id) ? updatedTpl : t)))
      } else {
        await resetAndFetch()
      }

      showToast("File removed")
    } catch (e) {
      showToast(e?.message || "Failed to remove file")
    } finally {
      setFileBusyKey(null)
    }
  }

  const renameSubtitleFile = async (tplId, subtitleId, fileId, nextName) => {
    const busy = `${tplId}:${subtitleId}:${fileId}`
    setFileBusyKey(busy)
    try {
      const res = await fetch(`${API_BASE}/task-templates/${tplId}/subtitles/${subtitleId}/files/${fileId}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ name: String(nextName).trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Could not rename file")

      const updatedTpl = data?.template
      if (updatedTpl?._id) {
        setTemplates((prev) => prev.map((t) => (String(t._id) === String(updatedTpl._id) ? updatedTpl : t)))
      } else {
        await resetAndFetch()
      }

      showToast("File renamed")
    } finally {
      setFileBusyKey(null)
    }
  }

  const replaceSubtitleFile = async (tplId, subtitleId, fileId, file) => {
    if (!file) return
    const busy = `${tplId}:${subtitleId}:${fileId}`
    setFileBusyKey(busy)

    try {
      const presignRes = await fetch(`${API_BASE}/upload/presign`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          scope: "templateSubtitle",
          templateId: tplId,
          subtitleId,
        }),
      })
      const presignData = await presignRes.json().catch(() => ({}))
      if (!presignRes.ok) throw new Error(presignData?.message || "Could not start replace")

      const putRes = await fetch(presignData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      })
      if (!putRes.ok) throw new Error("Replace upload failed")

      const repRes = await fetch(
        `${API_BASE}/task-templates/${tplId}/subtitles/${subtitleId}/files/${fileId}/replace`,
        {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({
            key: presignData.key,
            url: presignData.url,
            name: file.name,
            type: file.type || "",
            size: file.size,
          }),
        }
      )
      const repData = await repRes.json().catch(() => ({}))
      if (!repRes.ok) throw new Error(repData?.message || "Could not finish replace")

      const updatedTpl = repData?.template
      if (updatedTpl?._id) {
        setTemplates((prev) => prev.map((t) => (String(t._id) === String(updatedTpl._id) ? updatedTpl : t)))
      } else {
        await resetAndFetch()
      }

      showToast("File replaced")
    } finally {
      setFileBusyKey(null)
    }
  }

  /* ---------------- FILE ACTION MODALS (OPEN) ---------------- */
  const openRenameFileModal = (tplId, subtitleId, fileId, currentName) => {
    setRenameModal({ open: true, tplId, subtitleId, fileId, currentName: currentName || "" })
  }

  const openReplaceFileModal = (tplId, subtitleId, fileId, currentName) => {
    setReplaceModal({ open: true, tplId, subtitleId, fileId, currentName: currentName || "" })
  }

  const openDeleteFileModal = (tplId, subtitleId, fileId, currentName) => {
    setFileDeleteModal({ open: true, tplId, subtitleId, fileId, currentName: currentName || "" })
  }

  /* ---------------- FILE ACTION MODALS (ACTIONS) ---------------- */
  const submitRename = async (newName) => {
    const nm = String(newName || "").trim()
    if (!nm) return
    setRenameLoading(true)
    try {
      await renameSubtitleFile(
        String(renameModal.tplId),
        String(renameModal.subtitleId),
        String(renameModal.fileId),
        nm
      )
      setRenameModal({ open: false, tplId: null, subtitleId: null, fileId: null, currentName: "" })
    } catch (e) {
      showToast(e?.message || "Failed to rename file")
    } finally {
      setRenameLoading(false)
    }
  }

  const submitReplace = async (file) => {
    if (!file) return
    setReplaceLoading(true)
    try {
      await replaceSubtitleFile(
        String(replaceModal.tplId),
        String(replaceModal.subtitleId),
        String(replaceModal.fileId),
        file
      )
      setReplaceModal({ open: false, tplId: null, subtitleId: null, fileId: null, currentName: "" })
    } catch (e) {
      showToast(e?.message || "Failed to replace file")
    } finally {
      setReplaceLoading(false)
    }
  }

  const submitFileDelete = async () => {
    setFileDeleteLoading(true)
    try {
      await deleteSubtitleFile(
        String(fileDeleteModal.tplId),
        String(fileDeleteModal.subtitleId),
        String(fileDeleteModal.fileId)
      )
      setFileDeleteModal({ open: false, tplId: null, subtitleId: null, fileId: null, currentName: "" })
    } catch (e) {
      showToast(e?.message || "Failed to remove file")
    } finally {
      setFileDeleteLoading(false)
    }
  }

  /* ---------------- LOADING UI ---------------- */
  const showRowSkeletons = templates.length === 0 && loading ? 8 : 0
  const showLoadMoreSkeletons = !loading && loadingMore && sortedTemplates.length > 0

  return (
    <div className="min-h-screen bg-gray-50/60 p-4 sm:p-6 lg:p-8">
      <Toast message={toast} />

      {/* TITLE DELETE MODAL */}
      <ConfirmModal
        open={deleteModal.open}
        title="Delete title?"
        description="This will permanently delete the title and all subtitles."
        icon={<AlertTriangle className="w-5 h-5" />}
        tone="danger"
        confirmText="Delete"
        loading={deleteLoading}
        onClose={() => !deleteLoading && setDeleteModal({ open: false, id: null })}
        onConfirm={confirmDelete}
      />

      {/* FILE DELETE MODAL */}
      <ConfirmModal
        open={fileDeleteModal.open}
        title="Remove file?"
        description={`This will permanently remove: ${fileDeleteModal.currentName || "this file"}`}
        icon={<AlertTriangle className="w-5 h-5" />}
        tone="danger"
        confirmText="Remove"
        loading={fileDeleteLoading}
        onClose={() =>
          !fileDeleteLoading &&
          setFileDeleteModal({ open: false, tplId: null, subtitleId: null, fileId: null, currentName: "" })
        }
        onConfirm={submitFileDelete}
      />

      {/* RENAME FILE MODAL */}
      <RenameFileModal
        open={renameModal.open}
        loading={renameLoading}
        initialName={renameModal.currentName}
        onClose={() =>
          !renameLoading && setRenameModal({ open: false, tplId: null, subtitleId: null, fileId: null, currentName: "" })
        }
        onSubmit={submitRename}
      />

      {/* REPLACE FILE MODAL */}
      <ReplaceFileModal
        open={replaceModal.open}
        loading={replaceLoading}
        currentName={replaceModal.currentName}
        onClose={() =>
          !replaceLoading &&
          setReplaceModal({ open: false, tplId: null, subtitleId: null, fileId: null, currentName: "" })
        }
        onPickFile={submitReplace}
      />

      {/* ADD / EDIT TEMPLATE MODALS */}
      <TemplateModal
        open={addModalOpen}
        loading={createSaving}
        mode="add"
        value={titleValue}
        subtitles={subtitleValues}
        onClose={() => !createSaving && setAddModalOpen(false)}
        onChangeValue={setTitleValue}
        onChangeSubtitles={setSubtitleValues}
        onAddSubtitle={() => setSubtitleValues((p) => [...(Array.isArray(p) ? p : [""]), ""])}
        onRemoveSubtitle={removeSubtitleInput}
        onSubmit={createTemplate}
      />

      <TemplateModal
        open={editModalOpen}
        loading={updateSaving}
        mode="edit"
        value={titleValue}
        subtitles={subtitleValues}
        onClose={() => !updateSaving && setEditModalOpen(false)}
        onChangeValue={setTitleValue}
        onChangeSubtitles={setSubtitleValues}
        onAddSubtitle={() => setSubtitleValues((p) => [...(Array.isArray(p) ? p : [""]), ""])}
        onRemoveSubtitle={removeSubtitleInput}
        onSubmit={updateTemplate}
      />

      <div className="max-w-6xl mx-auto space-y-6">
        {/* ✅ ALWAYS RENDER HEADER (so input never unmounts) */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-5 sm:p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <FiLayers className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Task Title Templates</h1>
                <p className="text-sm text-gray-500 mt-1">Titles • Subtitles • Files</p>
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

              <button
                onClick={() => {
                  resetForm()
                  setAddModalOpen(true)
                }}
                className={[
                  "inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold",
                  focusableBtnClass,
                ].join(" ")}
              >
                <FiPlus />
                Add Title
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search titles..."
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

        <div className="bg-white rounded-2xl border border-gray-100 shadow-lg overflow-hidden">
          {templates.length === 0 && loading ? (
            <ListHeaderSkeleton />
          ) : (
            <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FiLayers />
                <h3 className="text-sm font-semibold">All Titles</h3>
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
                  const subtitleCount = Array.isArray(t?.subtitles) ? t.subtitles.length : 0

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
                            {subtitleCount ? `${subtitleCount} subtitle${subtitleCount === 1 ? "" : "s"}` : "No subtitles"}
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
                              "h-9 w-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50",
                              focusableBtnClass,
                            ].join(" ")}
                            aria-label="Edit title"
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
                            aria-label="Delete title"
                            title="Delete"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </div>

                      <SmoothCollapse open={isOpen}>
                        <div className="px-5 sm:px-6 pb-6 -mt-2">
                          <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
                            {subtitleCount ? (
                              <ul className="text-sm text-gray-700 space-y-3">
                                {t.subtitles.map((s) => {
                                  const files = Array.isArray(s?.files) ? s.files : []
                                  const uKey = `${t._id}:${s._id}`
                                  const isUploading = uploadingKey === uKey

                                  return (
                                    <li key={s?._id || s?.text} className="flex flex-col gap-2">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-2 min-w-0">
                                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
                                          <span className="break-words font-medium text-gray-900">{s?.text || "—"}</span>
                                        </div>

                                        <div className="shrink-0 flex items-center gap-2">
                                          <input
                                            type="file"
                                            className="hidden"
                                            ref={(el) => {
                                              if (el) uploadInputRefs.current[uKey] = el
                                            }}
                                            onChange={(e) => {
                                              const f = e.target.files?.[0]
                                              uploadSubtitleFile(String(t._id), String(s._id), f)
                                            }}
                                          />

                                          <button
                                            type="button"
                                            onClick={() => pickUploadForSubtitle(String(t._id), String(s._id))}
                                            disabled={isUploading}
                                            className={[
                                              "inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold disabled:opacity-60",
                                              focusableBtnClass,
                                            ].join(" ")}
                                          >
                                            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FiUploadCloud />}
                                            {isUploading ? "Uploading..." : "Upload"}
                                          </button>
                                        </div>
                                      </div>

                                      {files.length ? (
                                        <div className="ml-4 rounded-xl border border-gray-100 bg-white p-3">
                                          <div className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-2">
                                            <FaFileLines className="w-4 h-4 text-gray-600" /> Files ({files.length})
                                          </div>

                                          <ul className="space-y-2">
                                            {files.map((f) => {
                                              const busy = fileBusyKey === `${t._id}:${s._id}:${f._id}`

                                              return (
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
                                                      <div className="text-[11px] text-gray-500 truncate">{bytesToKB(f.size)}</div>
                                                    </div>
                                                  </div>

                                                  <div className="shrink-0 flex items-center gap-2">
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        openReplaceFileModal(String(t._id), String(s._id), String(f._id), f.name)
                                                      }
                                                      disabled={busy}
                                                      className={[
                                                        "h-8 px-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold disabled:opacity-60 inline-flex items-center gap-2",
                                                        focusableBtnClass,
                                                      ].join(" ")}
                                                      title="Replace file"
                                                    >
                                                      {busy ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                      ) : (
                                                        <RefreshCcw className="w-4 h-4" />
                                                      )}
                                                      Replace
                                                    </button>

                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        openRenameFileModal(String(t._id), String(s._id), String(f._id), f.name)
                                                      }
                                                      disabled={busy}
                                                      className={[
                                                        "h-8 px-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold disabled:opacity-60 inline-flex items-center gap-2",
                                                        focusableBtnClass,
                                                      ].join(" ")}
                                                      title="Rename file"
                                                    >
                                                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                                                      Rename
                                                    </button>

                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        openDeleteFileModal(String(t._id), String(s._id), String(f._id), f.name)
                                                      }
                                                      disabled={busy}
                                                      className={[
                                                        "h-8 w-8 flex items-center justify-center rounded-xl border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60",
                                                        focusableBtnClass,
                                                      ].join(" ")}
                                                      title="Remove file"
                                                      aria-label="Remove file"
                                                    >
                                                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FiTrash2 />}
                                                    </button>
                                                  </div>
                                                </li>
                                              )
                                            })}
                                          </ul>
                                        </div>
                                      ) : (
                                        <p className="ml-4 text-xs text-gray-500">No files yet.</p>
                                      )}
                                    </li>
                                  )
                                })}
                              </ul>
                            ) : (
                              <p className="text-sm text-gray-500">No subtitles for this title.</p>
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
                              Edit this title
                            </button>
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
              <div className="p-10 text-center text-gray-500 text-sm">No titles found.</div>
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
