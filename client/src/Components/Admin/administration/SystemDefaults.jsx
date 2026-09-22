/* eslint-disable react/prop-types, react-refresh/only-export-components -- view and form contracts are exported for focused tests */
import { useCallback, useEffect, useMemo, useState } from "react"
import { useSelector } from "react-redux"
import { FiDatabase, FiRefreshCw, FiRotateCcw, FiSave, FiShield } from "react-icons/fi"
import { toast } from "react-hot-toast"
import { hasPermission, PERMISSIONS } from "../../Auth/permissions"
import { administrationApi } from "./administrationApi"
import {
  AdministrationButton,
  AdministrationCard,
  AdministrationField,
  AdministrationHeader,
  AdministrationPage,
  AdministrationTableState,
  administrationStyles,
} from "./AdministrationUI"

const DEFAULTS = Object.freeze({
  tablePageSize: 20,
  defaultDateFormat: "DD-MM-YYYY",
  defaultTimeFormat: "24-hour",
  defaultCurrency: "BDT",
  currencyDecimalPlaces: 2,
  numberDecimalPlaces: 2,
  defaultSortOrder: "newest_first",
  defaultFileUploadLimitMb: 10,
  allowedFileTypes: ["PDF", "JPG", "PNG", "XLSX", "DOCX"],
  auditStorageLimit: 100000,
  auditRetentionMode: "warn_only",
  revision: 1,
})

export function toSystemDefaultsForm(settings = {}) {
  settings = settings ?? {}
  return {
    tablePageSize: settings.tablePageSize ?? DEFAULTS.tablePageSize,
    defaultDateFormat: settings.defaultDateFormat ?? DEFAULTS.defaultDateFormat,
    defaultTimeFormat: settings.defaultTimeFormat ?? DEFAULTS.defaultTimeFormat,
    defaultCurrency: settings.defaultCurrency ?? DEFAULTS.defaultCurrency,
    currencyDecimalPlaces: settings.currencyDecimalPlaces ?? DEFAULTS.currencyDecimalPlaces,
    numberDecimalPlaces: settings.numberDecimalPlaces ?? DEFAULTS.numberDecimalPlaces,
    defaultSortOrder: settings.defaultSortOrder ?? DEFAULTS.defaultSortOrder,
    defaultFileUploadLimitMb: settings.defaultFileUploadLimitMb ?? DEFAULTS.defaultFileUploadLimitMb,
    allowedFileTypes: [...(settings.allowedFileTypes ?? DEFAULTS.allowedFileTypes)],
    auditStorageLimit: settings.auditStorageLimit ?? DEFAULTS.auditStorageLimit,
    auditRetentionMode: settings.auditRetentionMode || DEFAULTS.auditRetentionMode,
    revision: settings.revision ?? DEFAULTS.revision,
  }
}

export function validateSystemDefaults(form = {}) {
  const settings = toSystemDefaultsForm(form)
  const pageSize = Number(settings.tablePageSize)
  if (!Number.isInteger(pageSize) || pageSize < 10 || pageSize > 200) {
    return "Maximum rows per table must be between 10 and 200."
  }
  if (!["DD-MM-YYYY", "MM-DD-YYYY", "YYYY-MM-DD", "DD/MM/YYYY"].includes(settings.defaultDateFormat)) return "Select a valid default date format."
  if (!["12-hour", "24-hour"].includes(settings.defaultTimeFormat)) return "Select a valid default time format."
  if (!/^[A-Z]{3}$/.test(String(settings.defaultCurrency || "").trim().toUpperCase())) return "Default currency must be a three-letter ISO code."
  for (const [key, label] of [["currencyDecimalPlaces", "Currency decimal places"], ["numberDecimalPlaces", "Number decimal places"]]) {
    const value = Number(settings[key])
    if (!Number.isInteger(value) || value < 0 || value > 6) return `${label} must be between 0 and 6.`
  }
  if (!["newest_first", "oldest_first"].includes(settings.defaultSortOrder)) return "Select a valid default sort order."
  const uploadLimit = Number(settings.defaultFileUploadLimitMb)
  if (!Number.isInteger(uploadLimit) || uploadLimit < 1 || uploadLimit > 100) return "Default file upload limit must be between 1 and 100 MB."
  if (!settings.allowedFileTypes.length || new Set(settings.allowedFileTypes).size !== settings.allowedFileTypes.length || settings.allowedFileTypes.some((type) => !["PDF", "JPG", "PNG", "XLSX", "DOCX"].includes(type))) return "Select at least one allowed file type from PDF, JPG, PNG, XLSX, or DOCX."
  const auditLimit = Number(settings.auditStorageLimit)
  if (!Number.isInteger(auditLimit) || auditLimit < 1000 || auditLimit > 10000000) {
    return "Audit Trail Storage Limit must be between 1,000 and 10,000,000."
  }
  if (!["warn_only", "archive_then_purge"].includes(settings.auditRetentionMode)) {
    return "Select a valid audit retention mode."
  }
  return ""
}

export function buildSystemDefaultsPayload(form) {
  const normalized = toSystemDefaultsForm(form)
  return {
    tablePageSize: Number(normalized.tablePageSize),
    defaultDateFormat: normalized.defaultDateFormat,
    defaultTimeFormat: normalized.defaultTimeFormat,
    defaultCurrency: String(normalized.defaultCurrency).trim().toUpperCase(),
    currencyDecimalPlaces: Number(normalized.currencyDecimalPlaces),
    numberDecimalPlaces: Number(normalized.numberDecimalPlaces),
    defaultSortOrder: normalized.defaultSortOrder,
    defaultFileUploadLimitMb: Number(normalized.defaultFileUploadLimitMb),
    allowedFileTypes: [...normalized.allowedFileTypes],
    auditStorageLimit: Number(normalized.auditStorageLimit),
    auditRetentionMode: normalized.auditRetentionMode,
    revision: Number(normalized.revision),
  }
}

export function preserveSettingsDraftOnConflict(draft) {
  return { ...draft }
}

const comparable = (form = {}) => JSON.stringify(buildSystemDefaultsPayload(form))

function NumberInput({ id, value, onChange, disabled, min, max }) {
  return <input id={id} type="number" value={value} onChange={onChange} disabled={disabled} min={min} max={max} step="1" className={administrationStyles.input} />
}

export function SystemDefaultsView({
  form,
  saved,
  canManage,
  loading,
  error,
  saving,
  conflict,
  onChange,
  onSave,
  onReset,
  onReload,
  onKeepDraft,
}) {
  if (loading) return <AdministrationPage><AdministrationTableState status="loading" /></AdministrationPage>
  if (error && !saved) return <AdministrationPage><AdministrationCard><AdministrationTableState status="error" title="Unable to load System Defaults" description={error} onRetry={onReload} /></AdministrationCard></AdministrationPage>

  const disabled = !canManage || saving
  const dirty = comparable(form) !== comparable(saved)

  return <AdministrationPage>
    <AdministrationHeader
      icon={FiShield}
      title="System Defaults"
      description="Choose the presentation, numbering, file, and audit defaults for your company."
      actions={<>
        <AdministrationButton icon={FiRefreshCw} type="button" onClick={onReload} disabled={loading || saving}>Refresh</AdministrationButton>
        {canManage ? <AdministrationButton icon={FiSave} variant="primary" type="submit" form="system-defaults-form" disabled={saving || !dirty}>{saving ? "Saving..." : "Save Changes"}</AdministrationButton> : null}
      </>}
    />

    {error ? <div role="alert" className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
    {!canManage ? <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">You have read-only access to System Defaults.</div> : null}
    {conflict ? <div role="alert" className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 sm:flex-row sm:items-center sm:justify-between"><span>Settings changed in another session. Reload the current values or keep your draft while you review it.</span><span className="flex shrink-0 gap-2"><AdministrationButton type="button" onClick={onReload}>Reload</AdministrationButton><AdministrationButton type="button" variant="soft" onClick={onKeepDraft}>Keep Draft</AdministrationButton></span></div> : null}

    <form id="system-defaults-form" onSubmit={onSave} className="space-y-5">
      <AdministrationCard className="p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3 border-b border-gray-100 pb-5"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700"><FiDatabase className="h-5 w-5" /></span><div><h2 className="text-lg font-black text-gray-950">Display and formatting</h2><p className="mt-1 text-sm font-medium text-gray-500">Defaults for supported tables, dates, time, currency, and numbers.</p></div></div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AdministrationField label="Default Rows Per Table" htmlFor="table-page-size" required hint="10–200 rows; individual endpoints may enforce a lower cap."><NumberInput id="table-page-size" value={form.tablePageSize} onChange={(event) => onChange("tablePageSize", event.target.value)} disabled={disabled} min={10} max={200} /></AdministrationField>
          <AdministrationField label="Default Date Format" htmlFor="default-date-format" required><select id="default-date-format" value={form.defaultDateFormat} onChange={(event) => onChange("defaultDateFormat", event.target.value)} disabled={disabled} className={administrationStyles.input}>{["DD-MM-YYYY", "MM-DD-YYYY", "YYYY-MM-DD", "DD/MM/YYYY"].map((value) => <option key={value} value={value}>{value}</option>)}</select></AdministrationField>
          <AdministrationField label="Default Time Format" htmlFor="default-time-format" required><select id="default-time-format" value={form.defaultTimeFormat} onChange={(event) => onChange("defaultTimeFormat", event.target.value)} disabled={disabled} className={administrationStyles.input}><option value="12-hour">12-hour</option><option value="24-hour">24-hour</option></select></AdministrationField>
          <AdministrationField label="Default Currency" htmlFor="default-currency" required hint="Three-letter ISO currency code, such as BDT."><input id="default-currency" value={form.defaultCurrency} onChange={(event) => onChange("defaultCurrency", event.target.value.toUpperCase())} disabled={disabled} maxLength={3} className={administrationStyles.input} /></AdministrationField>
          <AdministrationField label="Currency Decimal Places" htmlFor="currency-decimals" required><NumberInput id="currency-decimals" value={form.currencyDecimalPlaces} onChange={(event) => onChange("currencyDecimalPlaces", event.target.value)} disabled={disabled} min={0} max={6} /></AdministrationField>
          <AdministrationField label="Number Decimal Places" htmlFor="number-decimals"><NumberInput id="number-decimals" value={form.numberDecimalPlaces} onChange={(event) => onChange("numberDecimalPlaces", event.target.value)} disabled={disabled} min={0} max={6} /></AdministrationField>
          <AdministrationField label="Default Sort Order" htmlFor="default-sort-order"><select id="default-sort-order" value={form.defaultSortOrder} onChange={(event) => onChange("defaultSortOrder", event.target.value)} disabled={disabled} className={administrationStyles.input}><option value="newest_first">Newest First</option><option value="oldest_first">Oldest First</option></select></AdministrationField>
        </div>
      </AdministrationCard>

      <AdministrationCard className="p-5 sm:p-6">
        <h2 className="text-lg font-black text-gray-950">File preferences</h2>
        <p className="mb-5 mt-1 text-sm font-medium text-gray-500">Supported upload screens may use these defaults. Endpoint-specific security limits and accepted types still take precedence.</p>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <AdministrationField label="Default File Upload Limit" htmlFor="upload-limit" hint="1–100 MB. Existing endpoint safety caps may be lower."><NumberInput id="upload-limit" value={form.defaultFileUploadLimitMb} onChange={(event) => onChange("defaultFileUploadLimitMb", event.target.value)} disabled={disabled} min={1} max={100} /></AdministrationField>
          <fieldset><legend className="mb-1.5 text-sm font-bold text-gray-800">Allowed File Types</legend><div className="flex flex-wrap gap-2">{["PDF", "JPG", "PNG", "XLSX", "DOCX"].map((type) => <label key={type} className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700"><input type="checkbox" checked={form.allowedFileTypes.includes(type)} onChange={(event) => onChange("allowedFileTypes", event.target.checked ? [...form.allowedFileTypes, type] : form.allowedFileTypes.filter((item) => item !== type))} disabled={disabled} className="accent-indigo-600" />{type}</label>)}</div></fieldset>
        </div>
      </AdministrationCard>

      <AdministrationCard className="p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3 border-b border-gray-100 pb-5"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700"><FiShield className="h-5 w-5" /></span><div><h2 className="text-lg font-black text-gray-950">Audit retention</h2><p className="mt-1 text-sm font-medium text-gray-500">Define the audit-volume threshold and what happens after it is reached.</p></div></div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AdministrationField label="Audit Trail Storage Limit" htmlFor="audit-storage-limit" required hint="Allowed range: 1,000–10,000,000 records."><NumberInput id="audit-storage-limit" value={form.auditStorageLimit} onChange={(event) => onChange("auditStorageLimit", event.target.value)} disabled={disabled} min={1000} max={10000000} /></AdministrationField>
          <AdministrationField label="Audit Retention Mode" htmlFor="audit-retention-mode" required><select id="audit-retention-mode" value={form.auditRetentionMode} onChange={(event) => onChange("auditRetentionMode", event.target.value)} disabled={disabled} className={administrationStyles.input}><option value="warn_only">Warn only</option><option value="archive_then_purge">Archive then purge</option></select></AdministrationField>
        </div>
        <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${form.auditRetentionMode === "warn_only" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-sky-200 bg-sky-50 text-sky-900"}`}>
          {form.auditRetentionMode === "warn_only" ? "Warn only does not delete audit records. Administrators are notified when the configured limit is reached." : "Archive then purge preserves an archive before eligible records are purged according to the configured policy."}
        </div>
      </AdministrationCard>

      {canManage ? <div className="flex flex-wrap justify-end gap-2"><AdministrationButton type="button" icon={FiRotateCcw} onClick={onReset} disabled={saving || !dirty}>Cancel Changes</AdministrationButton><AdministrationButton type="submit" icon={FiSave} variant="primary" disabled={saving || !dirty}>{saving ? "Saving..." : "Save Changes"}</AdministrationButton></div> : null}
    </form>
  </AdministrationPage>
}

export default function SystemDefaults() {
  const currentUser = useSelector((state) => state.user?.currentUser)
  const canManage = hasPermission(currentUser, PERMISSIONS.SYSTEM_SETTINGS_MANAGE)
  const [saved, setSaved] = useState(null)
  const [form, setForm] = useState(toSystemDefaultsForm())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [conflict, setConflict] = useState(false)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const payload = await administrationApi.get("/settings")
      const next = toSystemDefaultsForm(payload.data?.settings || {})
      setSaved(next)
      setForm(next)
      setConflict(false)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadSettings() }, [loadSettings])
  const dirty = useMemo(() => comparable(form) !== comparable(saved), [form, saved])

  const save = async (event) => {
    event.preventDefault()
    if (!canManage || !dirty) return
    const validation = validateSystemDefaults(form)
    if (validation) return toast.error(validation)
    setSaving(true)
    setError("")
    try {
      const payload = await administrationApi.patch("/settings", buildSystemDefaultsPayload(form))
      const next = toSystemDefaultsForm(payload.data?.settings || {})
      setSaved(next)
      setForm(next)
      setConflict(false)
      toast.success(payload.message || "System defaults updated.")
    } catch (requestError) {
      if (requestError.status === 409) {
        setForm((draft) => preserveSettingsDraftOnConflict(draft))
        setConflict(true)
      } else {
        setError(requestError.message)
      }
      toast.error(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  return <SystemDefaultsView
    form={form}
    saved={saved}
    canManage={canManage}
    loading={loading}
    error={error}
    saving={saving}
    conflict={conflict}
    onChange={(key, value) => setForm((previous) => ({ ...previous, [key]: value }))}
    onSave={save}
    onReset={() => setForm(toSystemDefaultsForm(saved || {}))}
    onReload={loadSettings}
    onKeepDraft={() => setConflict(false)}
  />
}
