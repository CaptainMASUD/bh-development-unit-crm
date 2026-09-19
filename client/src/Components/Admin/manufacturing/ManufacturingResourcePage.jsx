"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { useSelector } from "react-redux"
import { FiBox, FiCheck, FiEdit3, FiEye, FiPlus, FiRefreshCcw, FiTrash2 } from "react-icons/fi"
import { hasPermission } from "../../Auth/permissions"
import {
  DefaultRowActions,
  ManufacturingActionButton,
  ManufacturingButton,
  ManufacturingField,
  ManufacturingModal,
  ManufacturingPageHeader,
  ManufacturingPageLayout,
  ManufacturingPagination,
  ManufacturingStatusBadge,
  ManufacturingTable,
  ManufacturingToolbar,
  RelationSelect,
  displayName,
  formatDate,
  formatMoney,
  formatNumber,
  getId,
  inputClass,
  manufacturingApi,
  pretty,
  readPath,
  textareaClass,
} from "./ManufacturingPageLayout"

function initialValue(field, source) {
  const value = source ? readPath(source, field.name) : undefined
  if (value !== undefined && value !== null) {
    if (field.type === "date") return String(value).slice(0, 10)
    if (field.type === "datetime-local") {
      const date = new Date(value)
      if (!Number.isNaN(date.getTime())) return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    }
    return value
  }
  if (field.type === "array") return field.defaultValue || []
  if (field.type === "checkbox") return Boolean(field.defaultValue)
  return field.defaultValue ?? ""
}

function buildForm(fields, source = null) {
  return Object.fromEntries(fields.map((field) => [field.name, initialValue(field, source)]))
}

function normalizeField(field, value) {
  if (field.type === "number") return value === "" ? undefined : Number(value)
  if (field.type === "checkbox") return Boolean(value)
  if (field.type === "array") return (Array.isArray(value) ? value : []).map((row) => Object.fromEntries(field.fields.map((child) => [child.name, normalizeField(child, row?.[child.name])]).filter(([, item]) => item !== undefined)))
  if (field.type === "tags") return Array.isArray(value) ? value : String(value || "").split(",").map((item) => item.trim()).filter(Boolean)
  if (value === "") return field.keepEmpty ? "" : undefined
  return value
}

function normalizePayload(fields, form) {
  return Object.fromEntries(fields.map((field) => [field.name, normalizeField(field, form[field.name])]).filter(([, value]) => value !== undefined))
}

function renderValue(value, type) {
  if (type === "status") return <ManufacturingStatusBadge status={value} />
  if (type === "date") return formatDate(value)
  if (type === "datetime") return formatDate(value, true)
  if (type === "money") return formatMoney(value)
  if (type === "number") return formatNumber(value)
  if (type === "relation") return displayName(value)
  if (type === "boolean") return value ? "Yes" : "No"
  if (Array.isArray(value)) return value.length ? `${value.length} item${value.length === 1 ? "" : "s"}` : "—"
  return value ?? "—"
}

function ArrayEditor({ field, value, onChange }) {
  const rows = Array.isArray(value) ? value : []
  const addRow = () => onChange([...rows, Object.fromEntries(field.fields.map((child) => [child.name, initialValue(child)]))])
  const updateRow = (index, key, next) => onChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: next } : row))
  const removeRow = (index) => onChange(rows.filter((_, rowIndex) => rowIndex !== index))

  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div key={row._id || index} className="rounded-2xl border border-gray-200 bg-[#f8fafc] p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wide text-gray-500">{field.itemLabel || "Item"} {index + 1}</p><button type="button" onClick={() => removeRow(index)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><FiTrash2 /></button></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {field.fields.map((child) => <DynamicField key={child.name} field={child} value={row?.[child.name] ?? initialValue(child)} onChange={(next) => updateRow(index, child.name, next)} compact />)}
          </div>
        </div>
      ))}
      <ManufacturingButton variant="soft" onClick={addRow} icon={<FiPlus />}>{field.addLabel || `Add ${field.itemLabel || "Item"}`}</ManufacturingButton>
    </div>
  )
}

function DynamicField({ field, value, onChange, compact = false }) {
  const wrapper = compact ? "" : field.full ? "sm:col-span-2" : ""
  if (field.type === "array") return <div className={field.full === false ? "" : "sm:col-span-2"}><ManufacturingField title={field.label} hint={field.hint}><ArrayEditor field={field} value={value} onChange={onChange} /></ManufacturingField></div>
  if (field.type === "textarea") return <ManufacturingField title={field.label} hint={field.hint} className={wrapper}><textarea value={value ?? ""} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder || ""} className={textareaClass} /></ManufacturingField>
  if (field.type === "select") return <ManufacturingField title={field.label} hint={field.hint} className={wrapper}><select value={value ?? ""} onChange={(event) => onChange(event.target.value)} className={inputClass}><option value="">{field.placeholder || `Select ${field.label}`}</option>{(field.options || []).map((option) => <option key={option.value ?? option} value={option.value ?? option}>{option.label ?? pretty(option)}</option>)}</select></ManufacturingField>
  if (field.type === "relation") return <ManufacturingField title={field.label} hint={field.hint} className={wrapper}><RelationSelect value={value} onChange={onChange} endpoint={field.endpoint} placeholder={field.placeholder || `Select ${field.label}`} labelKey={field.labelKey} /></ManufacturingField>
  if (field.type === "checkbox") return <label className={`flex min-h-11 items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 ${wrapper}`}><input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" /><span className="text-sm font-extrabold text-gray-900">{field.label}</span></label>
  if (field.type === "tags") return <ManufacturingField title={field.label} hint={field.hint} className={wrapper}><input value={Array.isArray(value) ? value.join(", ") : value ?? ""} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder || "Comma-separated values"} className={inputClass} /></ManufacturingField>
  return <ManufacturingField title={field.label} hint={field.hint} className={wrapper}><input type={field.type || "text"} value={value ?? ""} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder || ""} min={field.min} max={field.max} step={field.step} className={inputClass} /></ManufacturingField>
}

export default function ManufacturingResourcePage({
  title,
  subtitle,
  endpoint,
  icon = <FiBox />,
  columns = [],
  formFields = [],
  statusOptions = [],
  createLabel = "Create",
  viewPermission,
  managePermission,
  deletePermission,
  readOnly = false,
  allowCreate = true,
  actions = [],
  transformPayload,
  detailsFields,
}) {
  const currentUser = useSelector((state) => state.user?.currentUser)
  const canView = hasPermission(currentUser, viewPermission)
  const canManage = !readOnly && hasPermission(currentUser, managePermission)
  const canDelete = !readOnly && Boolean(deletePermission) && hasPermission(currentUser, deletePermission)
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 20 })
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formModal, setFormModal] = useState({ open: false, item: null, form: buildForm(formFields) })
  const [details, setDetails] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [actionModal, setActionModal] = useState(null)

  const load = useCallback(async () => {
    if (!canView) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" })
      if (search.trim()) params.set("q", search.trim())
      if (status) params.set("status", status)
      const data = await manufacturingApi(`${endpoint}?${params.toString()}`)
      setRows(Array.isArray(data?.data) ? data.data : [])
      setPagination(data?.pagination || { page, pages: 1, total: Array.isArray(data?.data) ? data.data.length : 0, limit: 20 })
    } catch (error) {
      toast.error(error.message || `Failed to load ${title}`)
    } finally {
      setLoading(false)
    }
  }, [canView, endpoint, page, search, status, title])

  useEffect(() => {
    const timer = setTimeout(load, 220)
    return () => clearTimeout(timer)
  }, [load])

  useEffect(() => setPage(1), [search, status])

  const openCreate = () => setFormModal({ open: true, item: null, form: buildForm(formFields) })
  const openEdit = (item) => setFormModal({ open: true, item, form: buildForm(formFields, item) })
  const setFormField = (name, value) => setFormModal((current) => ({ ...current, form: { ...current.form, [name]: value } }))

  const save = async () => {
    setSaving(true)
    try {
      let payload = normalizePayload(formFields, formModal.form)
      if (transformPayload) payload = transformPayload(payload, formModal.item)
      await manufacturingApi(formModal.item?._id ? `${endpoint}/${formModal.item._id}` : endpoint, { method: formModal.item?._id ? "PATCH" : "POST", body: JSON.stringify(payload) })
      toast.success(formModal.item ? "Record updated" : "Record created")
      setFormModal({ open: false, item: null, form: buildForm(formFields) })
      await load()
    } catch (error) {
      toast.error(error.message || "Unable to save record")
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!confirm?._id) return
    setSaving(true)
    try {
      await manufacturingApi(`${endpoint}/${confirm._id}`, { method: "DELETE" })
      toast.success("Record deleted")
      setConfirm(null)
      await load()
    } catch (error) {
      toast.error(error.message || "Unable to delete record")
    } finally {
      setSaving(false)
    }
  }

  const runAction = async (definition, row, body = undefined) => {
    const path = typeof definition.path === "function" ? definition.path(row) : `${endpoint}/${row._id}/${definition.path}`
    try {
      await manufacturingApi(path, { method: definition.method || "POST", ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })
      toast.success(definition.success || `${definition.label} completed`)
      setActionModal(null)
      await load()
    } catch (error) {
      toast.error(error.message || `${definition.label} failed`)
    }
  }

  const visibleActions = (row) => actions.filter((definition) => (!definition.permission || hasPermission(currentUser, definition.permission)) && (!definition.when || definition.when(row)))
  const summary = useMemo(() => ({ total: pagination.total || rows.length, active: rows.filter((row) => ["active", "available", "released", "in_progress", "posted", "approved", "completed"].includes(String(row.status))).length, attention: rows.filter((row) => ["pending", "hold", "quality_hold", "breakdown", "failed", "cancelled"].includes(String(row.status))).length }), [pagination.total, rows])

  if (!canView) return <ManufacturingPageLayout><div className="mx-auto max-w-2xl pt-20 text-center"><h2 className="text-xl font-black text-gray-900">Access restricted</h2><p className="mt-2 text-sm font-semibold text-gray-500">You do not have permission to view this Manufacturing area.</p></div></ManufacturingPageLayout>

  return (
    <ManufacturingPageLayout>
      <Toaster position="top-right" />
      <ManufacturingPageHeader title={title} subtitle={subtitle} icon={icon} actions={<><ManufacturingButton onClick={load} icon={<FiRefreshCcw className={loading ? "animate-spin" : ""} />}>Refresh</ManufacturingButton>{canManage && allowCreate ? <ManufacturingButton variant="primary" onClick={openCreate} icon={<FiPlus />}>{createLabel}</ManufacturingButton> : null}</>} />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_14px_35px_-28px_rgba(15,23,42,0.55)]"><p className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Total records</p><p className="mt-2 text-2xl font-black text-gray-950">{formatNumber(summary.total)}</p></div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_14px_35px_-28px_rgba(15,23,42,0.55)]"><p className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Active / processed</p><p className="mt-2 text-2xl font-black text-emerald-700">{formatNumber(summary.active)}</p></div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_14px_35px_-28px_rgba(15,23,42,0.55)]"><p className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Needs attention</p><p className="mt-2 text-2xl font-black text-amber-700">{formatNumber(summary.attention)}</p></div>
      </div>

      <ManufacturingToolbar search={search} setSearch={setSearch} placeholder={`Search ${title.toLowerCase()}...`} status={status} setStatus={setStatus} statusOptions={statusOptions} />
      <ManufacturingTable columns={columns.map((column) => ({ ...column, render: column.render || ((row) => renderValue(readPath(row, column.key), column.type)) }))} rows={rows} loading={loading} actions={(row) => <DefaultRowActions onView={() => setDetails(row)} onEdit={canManage ? () => openEdit(row) : null} onDelete={canDelete ? () => setConfirm(row) : null} extra={visibleActions(row).map((definition) => <ManufacturingActionButton key={definition.label} label={definition.label} onClick={() => definition.fields?.length ? setActionModal({ definition, row, form: buildForm(definition.fields, definition.defaults ? definition.defaults(row) : null) }) : runAction(definition, row)}>{definition.icon || <FiCheck />}</ManufacturingActionButton>)} />} />
      <ManufacturingPagination page={pagination.page || page} pages={pagination.pages || 1} total={pagination.total || 0} onPage={setPage} />

      <ManufacturingModal open={formModal.open} title={formModal.item ? `Edit ${title}` : createLabel} subtitle={formModal.item ? "Update the selected record." : "Create a new manufacturing record."} icon={<FiEdit3 />} onClose={() => setFormModal({ open: false, item: null, form: buildForm(formFields) })} footer={<div className="flex justify-end gap-2"><ManufacturingButton onClick={() => setFormModal((current) => ({ ...current, open: false }))}>Cancel</ManufacturingButton><ManufacturingButton variant="primary" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</ManufacturingButton></div>}>
        <div className="grid gap-4 sm:grid-cols-2">{formFields.map((field) => <DynamicField key={field.name} field={field} value={formModal.form[field.name]} onChange={(value) => setFormField(field.name, value)} />)}</div>
      </ManufacturingModal>

      <ManufacturingModal open={Boolean(details)} title={`${title} details`} subtitle="Record overview" icon={<FiEye />} onClose={() => setDetails(null)} footer={<div className="flex justify-end"><ManufacturingButton onClick={() => setDetails(null)}>Close</ManufacturingButton></div>}>
        <div className="grid gap-3 sm:grid-cols-2">{(detailsFields || columns).map((field) => { const value = field.render ? field.render(details || {}) : renderValue(readPath(details, field.key || field.name), field.type); return <div key={field.key || field.name || field.label} className="rounded-2xl border border-gray-100 bg-[#f8fafc] p-4"><p className="text-[11px] font-black uppercase tracking-wide text-gray-500">{field.label}</p><div className="mt-2 break-words text-sm font-bold text-gray-900">{value ?? "—"}</div></div> })}</div>
      </ManufacturingModal>

      <ManufacturingModal open={Boolean(confirm)} title="Delete record?" subtitle="This action uses the Manufacturing backend delete rules." icon={<FiTrash2 />} onClose={() => setConfirm(null)} maxWidth="max-w-lg" footer={<div className="flex justify-end gap-2"><ManufacturingButton onClick={() => setConfirm(null)}>Cancel</ManufacturingButton><ManufacturingButton variant="danger" onClick={remove} disabled={saving}>{saving ? "Deleting..." : "Delete"}</ManufacturingButton></div>}><p className="text-sm font-semibold leading-6 text-gray-600">Delete <span className="font-extrabold text-gray-900">{displayName(confirm, getId(confirm))}</span>? Records that are already processed may be protected by the backend.</p></ManufacturingModal>

      <ManufacturingModal open={Boolean(actionModal)} title={actionModal?.definition?.label || "Action"} subtitle="Complete the required details and continue." icon={actionModal?.definition?.icon || <FiCheck />} onClose={() => setActionModal(null)} maxWidth="max-w-2xl" footer={<div className="flex justify-end gap-2"><ManufacturingButton onClick={() => setActionModal(null)}>Cancel</ManufacturingButton><ManufacturingButton variant="primary" onClick={() => runAction(actionModal.definition, actionModal.row, normalizePayload(actionModal.definition.fields || [], actionModal.form || {}))}>Continue</ManufacturingButton></div>}>
        <div className="grid gap-4 sm:grid-cols-2">{(actionModal?.definition?.fields || []).map((field) => <DynamicField key={field.name} field={field} value={actionModal?.form?.[field.name]} onChange={(value) => setActionModal((current) => ({ ...current, form: { ...current.form, [field.name]: value } }))} />)}</div>
      </ManufacturingModal>
    </ManufacturingPageLayout>
  )
}
