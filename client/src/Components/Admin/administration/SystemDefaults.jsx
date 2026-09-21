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
  auditStorageLimit: 100000,
  auditRetentionMode: "warn_only",
  revision: 1,
})

export function toSystemDefaultsForm(settings = {}) {
  return {
    tablePageSize: settings.tablePageSize ?? DEFAULTS.tablePageSize,
    auditStorageLimit: settings.auditStorageLimit ?? DEFAULTS.auditStorageLimit,
    auditRetentionMode: settings.auditRetentionMode || DEFAULTS.auditRetentionMode,
    revision: settings.revision ?? DEFAULTS.revision,
  }
}

export function validateSystemDefaults(form = {}) {
  const pageSize = Number(form.tablePageSize)
  if (!Number.isInteger(pageSize) || pageSize < 10 || pageSize > 200) {
    return "Maximum rows per table must be between 10 and 200."
  }
  const auditLimit = Number(form.auditStorageLimit)
  if (!Number.isInteger(auditLimit) || auditLimit < 1000 || auditLimit > 10000000) {
    return "Audit Trail Storage Limit must be between 1,000 and 10,000,000."
  }
  if (!["warn_only", "archive_then_purge"].includes(form.auditRetentionMode)) {
    return "Select a valid audit retention mode."
  }
  return ""
}

export function buildSystemDefaultsPayload(form) {
  return {
    tablePageSize: Number(form.tablePageSize),
    auditStorageLimit: Number(form.auditStorageLimit),
    auditRetentionMode: form.auditRetentionMode,
    revision: Number(form.revision),
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
      description="Set tenant-wide table and audit defaults used throughout the system."
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
        <div className="mb-5 flex items-center gap-3 border-b border-gray-100 pb-5"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700"><FiDatabase className="h-5 w-5" /></span><div><h2 className="text-lg font-black text-gray-950">Interface defaults</h2><p className="mt-1 text-sm font-medium text-gray-500">Control the default number of records displayed in supported tables.</p></div></div>
        <div className="max-w-xl">
          <AdministrationField label="Maximum Rows per Table" htmlFor="table-page-size" required hint="Allowed range: 10–200 rows. Individual endpoints may enforce a lower safety cap."><NumberInput id="table-page-size" value={form.tablePageSize} onChange={(event) => onChange("tablePageSize", event.target.value)} disabled={disabled} min={10} max={200} /></AdministrationField>
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
