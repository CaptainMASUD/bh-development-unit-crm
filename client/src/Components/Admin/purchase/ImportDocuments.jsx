"use client"

import { useCallback, useEffect, useMemo, useState, useRef } from "react"
import { createPortal } from "react-dom"
import toast, { Toaster } from "react-hot-toast"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  CloudUploadIcon,
  Delete02Icon,
  Download01Icon,
  Edit02Icon,
  File02Icon,
  Image01Icon,
  Pdf01Icon,
  RefreshIcon,
  Search01Icon,
  Tick02Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons"
import { hasPermission } from "../../Auth/permissions"
import {
  currentUserFromStorage,
  formatDate,
  lcDisplayNo,
  lcJson,
  lcRequest,
  pretty,
  relationLabel,
  toDateInput,
} from "./commercialLCApi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_30px_-20px_rgba(0,0,0,.25)]"
const input = "h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm font-semibold text-gray-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
const button = "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition disabled:opacity-50"
const primary = "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-600/20"
const ghost = "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
const danger = "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"

const blank = () => ({
  importShipment: "",
  documentType: "commercial_invoice",
  documentNo: "",
  title: "",
  issueDate: "",
  expiryDate: "",
  issuer: "",
  fileName: "",
  fileUrl: "",
  mimeType: "",
  fileSize: 0,
  notes: "",
})

function formatBytes(bytes) {
  const size = Number(bytes || 0)
  if (size <= 0) return "0 B"
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(2)} MB`
}

function Icon({ icon, className = "h-4 w-4" }) {
  return <HugeiconsIcon icon={icon} className={className} strokeWidth={1.8} />
}

function cn(...x) {
  return x.filter(Boolean).join(" ")
}

function Field({ label, hint, required, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-gray-800">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs font-semibold text-gray-500">{hint}</span> : null}
    </label>
  )
}

function StorageBadge({ provider }) {
  const meta = {
    cloudinary: { label: "Cloudinary", tone: "bg-purple-50 text-purple-700 border-purple-200" },
    r2: { label: "Cloudflare R2", tone: "bg-amber-50 text-amber-700 border-amber-200" },
    external: { label: "External Link", tone: "bg-gray-100 text-gray-600 border-gray-200" },
  }[provider] || { label: "Stored", tone: "bg-gray-100 text-gray-600 border-gray-200" }

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider", meta.tone)}>
      {meta.label}
    </span>
  )
}

function Modal({ open, title, onClose, children, footer }) {
  useEffect(() => {
    if (!open) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open || typeof document === "undefined") return null
  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <div className="flex min-h-full items-start justify-center p-4 sm:items-center">
        <button type="button" className="fixed inset-0 bg-gray-950/45 backdrop-blur-sm" onClick={onClose} aria-label="Close modal background" />
        <section className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl">
          <header className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 p-4 sm:p-5">
            <h2 className="text-lg font-black text-gray-950">{title}</h2>
            <button type="button" className="rounded-xl p-2 hover:bg-gray-100" onClick={onClose}>
              <Icon icon={Cancel01Icon} className="h-5 w-5" />
            </button>
          </header>
          <div className="max-h-[calc(100vh-14rem)] overflow-y-auto p-4 sm:p-6">{children}</div>
          {footer ? <footer className="border-t border-gray-100 bg-gray-50/50 p-4 sm:p-5">{footer}</footer> : null}
        </section>
      </div>
    </div>,
    document.body
  )
}

export default function ImportDocuments() {
  const user = useMemo(currentUserFromStorage, [])
  const canManage = hasPermission(user, "commercial-lc:manage")

  const [lcs, setLcs] = useState([])
  const [selectedLC, setSelectedLC] = useState("")
  const [shipments, setShipments] = useState([])
  const [documentTypes, setDocumentTypes] = useState([])
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const limit = 20

  const [typeFilter, setTypeFilter] = useState("all")
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState({ open: false, item: null })
  const [form, setForm] = useState(blank)
  const [selectedFile, setSelectedFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [downloadingId, setDownloadingId] = useState("")
  const fileInputRef = useRef(null)

  const loadBase = useCallback(async () => {
    try {
      const [lcData, meta] = await Promise.all([
        lcRequest("/purchase/commercial-lcs?limit=100"),
        lcRequest("/purchase/commercial-lcs/import-meta"),
      ])
      const active = (lcData.commercialLCs || []).filter((lc) => !["cancelled", "closed"].includes(lc.status))
      setLcs(active)
      setDocumentTypes(meta.documentTypes || [])
      setSelectedLC((current) => current || active[0]?._id || "")
    } catch (error) {
      toast.error(error.message)
    }
  }, [])

  const loadRows = useCallback(async (targetPage = page) => {
    if (!selectedLC) {
      setRows([])
      setShipments([])
      setTotal(0)
      setTotalPages(1)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: String(limit),
      })
      if (typeFilter !== "all") params.set("documentType", typeFilter)
      if (query.trim()) params.set("q", query.trim())

      const [docs, shipmentData] = await Promise.all([
        lcRequest(`/purchase/commercial-lcs/${selectedLC}/documents?${params}`),
        lcRequest(`/purchase/commercial-lcs/${selectedLC}/shipments?limit=100`),
      ])
      setRows(docs.documents || [])
      setTotal(docs.total || docs.documents?.length || 0)
      setTotalPages(docs.totalPages || Math.ceil((docs.total || 0) / limit) || 1)
      setPage(docs.page || targetPage)
      setShipments(shipmentData.shipments || [])
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }, [selectedLC, typeFilter, query, page])

  useEffect(() => {
    loadBase()
  }, [loadBase])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadRows(1)
    }, 200)
    return () => clearTimeout(timer)
  }, [selectedLC, typeFilter, query])

  const selected = lcs.find((lc) => lc._id === selectedLC)

  const openCreate = () => {
    setForm(blank())
    setSelectedFile(null)
    setModal({ open: true, item: null })
  }

  const openEdit = (item) => {
    setSelectedFile(null)
    setForm({
      importShipment: item.importShipment?._id || item.importShipment || "",
      documentType: item.documentType || "other",
      documentNo: item.documentNo || "",
      title: item.title || "",
      issueDate: toDateInput(item.issueDate),
      expiryDate: toDateInput(item.expiryDate),
      issuer: item.issuer || "",
      fileName: item.fileName || "",
      fileUrl: item.fileUrl || "",
      mimeType: item.mimeType || "",
      fileSize: item.fileSize || 0,
      notes: item.notes || "",
    })
    setModal({ open: true, item })
  }

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    setForm((prev) => ({
      ...prev,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      title: prev.title || file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "),
    }))
  }

  const save = async (event) => {
    event.preventDefault()
    if (!selectedLC) return toast.error("Select a Commercial LC.")
    if (!form.documentType) return toast.error("Select a document type.")
    setSaving(true)

    try {
      let data
      if (selectedFile && !modal.item) {
        // Upload file as multipart/form-data
        const token = localStorage.getItem("token")
        const formData = new FormData()
        formData.append("file", selectedFile)
        formData.append("documentType", form.documentType)
        formData.append("documentNo", form.documentNo || "")
        formData.append("title", form.title || selectedFile.name)
        if (form.importShipment) formData.append("importShipment", form.importShipment)
        if (form.issuer) formData.append("issuer", form.issuer)
        if (form.issueDate) formData.append("issueDate", form.issueDate)
        if (form.expiryDate) formData.append("expiryDate", form.expiryDate)
        if (form.notes) formData.append("notes", form.notes)

        const res = await fetch(`${API_BASE}/purchase/commercial-lcs/${selectedLC}/documents`, {
          method: "POST",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: formData,
          credentials: "include",
        })
        data = await res.json()
        if (!res.ok) throw new Error(data.message || "Failed to upload document")
      } else {
        const payload = {
          ...form,
          importShipment: form.importShipment || null,
          issueDate: form.issueDate || null,
          expiryDate: form.expiryDate || null,
          fileSize: Number(form.fileSize || 0),
        }
        data = await lcRequest(
          modal.item
            ? `/purchase/commercial-lcs/documents/${modal.item._id}`
            : `/purchase/commercial-lcs/${selectedLC}/documents`,
          lcJson(modal.item ? "PATCH" : "POST", payload)
        )
      }

      toast.success(data.message || "Document saved successfully.")
      setModal({ open: false, item: null })
      setSelectedFile(null)
      await loadRows(page)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (item) => {
    if (!window.confirm(`Delete ${item.documentNo || item.title || pretty(item.documentType)}? This will also remove the file from secure storage.`)) {
      return
    }
    try {
      const data = await lcRequest(`/purchase/commercial-lcs/documents/${item._id}`, { method: "DELETE" })
      toast.success(data.message || "Document deleted.")
      await loadRows(page)
    } catch (error) {
      toast.error(error.message)
    }
  }

  const handleDownload = async (item) => {
    setDownloadingId(item._id)
    try {
      const data = await lcRequest(`/purchase/commercial-lcs/documents/${item._id}/download-url`)
      if (data?.downloadUrl) {
        window.open(data.downloadUrl, "_blank", "noopener,noreferrer")
      } else if (item.fileUrl) {
        window.open(item.fileUrl, "_blank", "noopener,noreferrer")
      } else {
        toast.error("Download link is unavailable for this document.")
      }
    } catch (err) {
      toast.error(err.message || "Failed to generate download link.")
    } finally {
      setDownloadingId("")
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4 lg:p-6">
      <Toaster position="top-right" />

      {/* Header Section */}
      <section className={cn(card, "mb-5 p-5 sm:p-6")}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20">
              <Icon icon={File02Icon} className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[.14em] text-indigo-600">Trade Documentation</p>
              <h1 className="text-2xl font-black text-gray-950">Import Documents</h1>
              <p className="mt-1 text-sm font-semibold text-gray-500">
                Securely store commercial invoices, packing lists, BL/AWB, and customs clearances via Cloudflare R2 and Cloudinary.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={cn(button, ghost)} onClick={() => loadRows(page)}>
              <Icon icon={RefreshIcon} />
              Refresh
            </button>
            {canManage && selectedLC ? (
              <button type="button" className={cn(button, primary)} onClick={openCreate}>
                <Icon icon={Add01Icon} />
                Upload Document
              </button>
            ) : null}
          </div>
        </div>

        {/* Filters */}
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <Field label="Commercial LC">
            <select className={input} value={selectedLC} onChange={(e) => setSelectedLC(e.target.value)}>
              <option value="">Select LC</option>
              {lcs.map((lc) => (
                <option key={lc._id} value={lc._id}>
                  {lcDisplayNo(lc)} · {lc.purchaseOrder?.orderNo || "PO"} · {relationLabel(lc.supplier)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Document Type">
            <select className={input} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All document types</option>
              {documentTypes.map((type) => (
                <option key={type} value={type}>
                  {pretty(type)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Search">
            <div className="relative">
              <Icon icon={Search01Icon} className="absolute left-3.5 top-3.5 text-gray-400" />
              <input
                className={cn(input, "pl-10")}
                placeholder="Number, title, issuer, filename..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </Field>
        </div>

        {selected ? (
          <div className="mt-3 flex items-center justify-between text-xs font-bold text-gray-500">
            <span>
              Selected LC: <strong className="text-gray-900">{lcDisplayNo(selected)}</strong> ({pretty(selected.status)})
            </span>
            <span>Total Documents: {total}</span>
          </div>
        ) : null}
      </section>

      {/* Documents Table */}
      <section className={cn(card, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <table className="min-w-[1000px] w-full">
            <thead className="border-b border-gray-100 bg-gray-50/70 text-left text-xs font-black uppercase text-gray-400">
              <tr>
                <th className="px-5 py-3.5">Document</th>
                <th className="px-4 py-3.5">Type & Storage</th>
                <th className="px-4 py-3.5">Shipment</th>
                <th className="px-4 py-3.5">Issuer</th>
                <th className="px-4 py-3.5">Issue / Expiry</th>
                <th className="px-4 py-3.5">File & Size</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-16 text-center font-bold text-gray-500">
                    Loading import documents...
                  </td>
                </tr>
              ) : rows.length ? (
                rows.map((item) => (
                  <tr key={item._id} className="hover:bg-indigo-50/20 transition">
                    <td className="px-5 py-4">
                      <p className="font-black text-gray-950">{item.documentNo || item.title || "Untitled Document"}</p>
                      <p className="mt-0.5 text-xs font-semibold text-gray-500">{item.title || "—"}</p>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-black text-indigo-700">
                          {pretty(item.documentType)}
                        </span>
                        <StorageBadge provider={item.storageProvider} />
                      </div>
                    </td>

                    <td className="px-4 py-4 text-sm font-bold text-gray-700">
                      {item.importShipment?.shipmentNo || "LC level"}
                    </td>

                    <td className="px-4 py-4 text-sm font-bold text-gray-700">
                      {item.issuer || "—"}
                    </td>

                    <td className="px-4 py-4 text-sm font-bold text-gray-700">
                      <p>{formatDate(item.issueDate)}</p>
                      {item.expiryDate ? <p className="text-xs text-rose-600 font-semibold">Exp {formatDate(item.expiryDate)}</p> : null}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {item.mimeType?.startsWith("image/") ? (
                          <Icon icon={Image01Icon} className="h-4 w-4 text-purple-600 shrink-0" />
                        ) : item.mimeType?.includes("pdf") ? (
                          <Icon icon={Pdf01Icon} className="h-4 w-4 text-rose-600 shrink-0" />
                        ) : (
                          <Icon icon={File02Icon} className="h-4 w-4 text-gray-500 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate max-w-[180px] text-xs font-bold text-gray-800" title={item.fileName || item.originalName}>
                            {item.fileName || item.originalName || "Document"}
                          </p>
                          <p className="text-[11px] font-semibold text-gray-400">
                            {formatBytes(item.fileSize)}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex justify-end items-center gap-2">
                        <button
                          type="button"
                          className={cn(button, ghost, "h-9 px-3 text-indigo-600 hover:text-indigo-700")}
                          onClick={() => handleDownload(item)}
                          disabled={downloadingId === item._id}
                          title="View or download document"
                        >
                          <Icon icon={downloadingId === item._id ? RefreshIcon : ViewIcon} className={cn(downloadingId === item._id && "animate-spin")} />
                          View
                        </button>
                        {canManage ? (
                          <button
                            type="button"
                            className={cn(button, ghost, "h-9 px-3")}
                            onClick={() => openEdit(item)}
                          >
                            <Icon icon={Edit02Icon} />
                          </button>
                        ) : null}
                        {canManage ? (
                          <button
                            type="button"
                            className={cn(button, danger, "h-9 px-3")}
                            onClick={() => remove(item)}
                          >
                            <Icon icon={Delete02Icon} />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="py-16 text-center">
                    <Icon icon={File02Icon} className="mx-auto h-8 w-8 text-gray-300" />
                    <p className="mt-3 font-black text-gray-900">No import documents found</p>
                    <p className="mt-1 text-sm font-semibold text-gray-500">
                      Upload commercial invoices, transport waybills, or customs certificates for the selected LC.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/50 px-5 py-3 text-sm font-bold text-gray-600">
            <p>
              Page {page} of {totalPages} ({total} documents)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className={cn(button, ghost, "h-8 px-3 text-xs")}
                disabled={page <= 1}
                onClick={() => loadRows(page - 1)}
              >
                <Icon icon={ArrowLeft01Icon} />
                Previous
              </button>
              <button
                type="button"
                className={cn(button, ghost, "h-8 px-3 text-xs")}
                disabled={page >= totalPages}
                onClick={() => loadRows(page + 1)}
              >
                Next
                <Icon icon={ArrowRight01Icon} />
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {/* Upload / Edit Modal */}
      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false, item: null })}
        title={modal.item ? "Update Import Document" : "Upload Import Document"}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={cn(button, ghost)}
              onClick={() => setModal({ open: false, item: null })}
            >
              Cancel
            </button>
            <button
              className={cn(button, primary)}
              type="submit"
              form="import-document-form"
              disabled={saving}
            >
              <Icon icon={saving ? RefreshIcon : Tick02Icon} className={cn(saving && "animate-spin")} />
              {saving ? "Uploading..." : modal.item ? "Update Document" : "Save Document"}
            </button>
          </div>
        }
      >
        <form id="import-document-form" onSubmit={save} className="grid gap-4 md:grid-cols-2">
          {/* File Picker (Only for new document creation) */}
          {!modal.item ? (
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-bold text-gray-800">
                Attachment File <span className="text-rose-500">*</span>
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-6 transition hover:border-indigo-400 hover:bg-indigo-50/20 cursor-pointer"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                  accept="image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain,application/zip"
                />
                <Icon icon={CloudUploadIcon} className="h-10 w-10 text-indigo-600 mb-2" />
                {selectedFile ? (
                  <div className="text-center">
                    <p className="font-bold text-gray-900">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500">{formatBytes(selectedFile.size)} · Click to replace</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="font-bold text-gray-800">Click to browse or drop document here</p>
                    <p className="mt-1 text-xs text-gray-400">PDF, Word, Excel, CSV, ZIP, or image up to 25MB</p>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <Field label="Document Type" required>
            <select
              className={input}
              value={form.documentType}
              onChange={(e) => setForm((x) => ({ ...x, documentType: e.target.value }))}
            >
              {documentTypes.map((type) => (
                <option key={type} value={type}>
                  {pretty(type)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Linked Shipment">
            <select
              className={input}
              value={form.importShipment}
              onChange={(e) => setForm((x) => ({ ...x, importShipment: e.target.value }))}
            >
              <option value="">LC level (All shipments)</option>
              {shipments.map((shipment) => (
                <option key={shipment._id} value={shipment._id}>
                  {shipment.shipmentNo} · {pretty(shipment.status)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Document No / Reference">
            <input
              className={input}
              placeholder="e.g. INV-2026-001 or BL987654"
              value={form.documentNo}
              onChange={(e) => setForm((x) => ({ ...x, documentNo: e.target.value.toUpperCase() }))}
            />
          </Field>

          <Field label="Title / Description">
            <input
              className={input}
              placeholder="e.g. Commercial Invoice original"
              value={form.title}
              onChange={(e) => setForm((x) => ({ ...x, title: e.target.value }))}
            />
          </Field>

          <Field label="Issuer / Entity">
            <input
              className={input}
              placeholder="e.g. Shipping Line, Supplier, Customs Authority"
              value={form.issuer}
              onChange={(e) => setForm((x) => ({ ...x, issuer: e.target.value }))}
            />
          </Field>

          <Field label="Issue Date">
            <input
              className={input}
              type="date"
              value={form.issueDate}
              onChange={(e) => setForm((x) => ({ ...x, issueDate: e.target.value }))}
            />
          </Field>

          <Field label="Expiry Date">
            <input
              className={input}
              type="date"
              value={form.expiryDate}
              onChange={(e) => setForm((x) => ({ ...x, expiryDate: e.target.value }))}
            />
          </Field>

          {modal.item ? (
            <Field label="File URL (Optional override)">
              <input
                className={input}
                type="url"
                value={form.fileUrl}
                onChange={(e) => setForm((x) => ({ ...x, fileUrl: e.target.value }))}
              />
            </Field>
          ) : null}

          <div className="md:col-span-2">
            <Field label="Notes / Remarks">
              <textarea
                className={cn(input, "h-20 py-2.5 resize-none")}
                placeholder="Add trade or customs notes..."
                value={form.notes}
                onChange={(e) => setForm((x) => ({ ...x, notes: e.target.value }))}
              />
            </Field>
          </div>
        </form>
      </Modal>
    </div>
  )
}
