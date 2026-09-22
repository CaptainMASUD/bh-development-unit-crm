import { useCallback, useEffect, useMemo, useState } from "react"
import { useSelector } from "react-redux"
import { toast } from "react-hot-toast"
import { FiHash, FiRefreshCw, FiSave } from "react-icons/fi"
import { hasPermission, PERMISSIONS } from "../../Auth/permissions"
import { administrationApi, administrationRequest } from "./administrationApi"
import {
  AdministrationButton, AdministrationCard, AdministrationHeader, AdministrationPage,
  AdministrationTableState, AdministrationToolbar, administrationStyles,
} from "./AdministrationUI"

const editable = ["mode", "prefix", "pattern", "resetPolicy", "serialWidth"]
const inputClass = `${administrationStyles.input} min-w-24`

export default function DocumentNumbering() {
  const currentUser = useSelector((state) => state.user?.currentUser)
  const canManage = hasPermission(currentUser, PERMISSIONS.SYSTEM_SETTINGS_MANAGE)
  const [rules, setRules] = useState([])
  const [drafts, setDrafts] = useState({})
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState("")
  const [previews, setPreviews] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await administrationApi.get("/document-numbering")
      const next = response.data?.rules || []
      setRules(next)
      setDrafts(Object.fromEntries(next.map((rule) => [rule.typeKey, { ...rule }])))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  const visible = useMemo(() => rules.filter((rule) =>
    `${rule.label} ${rule.module} ${rule.typeKey}`.toLowerCase().includes(search.toLowerCase().trim()),
  ), [rules, search])

  const setField = (key, field, value) => setDrafts((previous) => ({
    ...previous, [key]: { ...previous[key], [field]: value },
  }))

  const save = async (typeKey) => {
    if (!canManage) return
    const draft = drafts[typeKey]
    const original = rules.find((rule) => rule.typeKey === typeKey)
    const changed = editable.filter((field) => String(draft[field]) !== String(original?.[field]))
    if (!changed.length) return
    setBusy(typeKey)
    try {
      const payload = Object.fromEntries(changed.map((field) => [field, field === "serialWidth" ? Number(draft[field]) : draft[field]]))
      const response = await administrationApi.patch(`/document-numbering/${encodeURIComponent(typeKey)}`, {
        ...payload, revision: draft.revision,
      })
      const next = { ...draft, ...response.data.rule }
      setRules((previous) => previous.map((rule) => rule.typeKey === typeKey ? next : rule))
      setDrafts((previous) => ({ ...previous, [typeKey]: next }))
      toast.success("Numbering rule saved")
    } catch (requestError) {
      toast.error(requestError.status === 409 ? "Rule changed elsewhere. Reload before saving." : requestError.message)
    } finally { setBusy("") }
  }

  const preview = async (typeKey) => {
    const draft = drafts[typeKey]
    setBusy(typeKey)
    try {
      const response = await administrationRequest(`/document-numbering/${encodeURIComponent(typeKey)}/preview`, {
        method: "POST", body: {
          ...Object.fromEntries(editable.map((field) => [field, field === "serialWidth" ? Number(draft[field]) : draft[field]])),
          context: { itemCode: "ITEM", categoryCode: "CAT" },
        },
      })
      setPreviews((previous) => ({ ...previous, [typeKey]: response.data.preview.value }))
    } catch (requestError) { toast.error(requestError.message) }
    finally { setBusy("") }
  }

  return <AdministrationPage>
    <AdministrationHeader title="Document Numbering" icon={FiHash}
      description="Set automatic or manual identifiers for each ERP record. Patterns support {PREFIX}, {DATE}, {ITEM}, {CATEGORY}, and {SERIAL}."
      actions={<AdministrationButton icon={FiRefreshCw} onClick={load}>Refresh</AdministrationButton>}
    />
    <AdministrationCard className="overflow-hidden p-4 sm:p-5">
      <AdministrationToolbar value={search} onChange={setSearch} placeholder="Search document types or modules..." />
      {loading ? <AdministrationTableState status="loading" /> : error ? <AdministrationTableState status="error" description={error} onRetry={load} /> :
        <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-100">
          <table className="w-full min-w-[1150px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr>
              <th className="px-3 py-3">Number type</th><th className="px-3 py-3">Mode</th>
              <th className="px-3 py-3">Prefix</th><th className="px-3 py-3">Automatic Pattern</th>
              <th className="px-3 py-3">Reset</th><th className="px-3 py-3">Digits</th><th className="px-3 py-3">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">{visible.map((rule) => {
              const draft = drafts[rule.typeKey] || rule
              return <tr key={rule.typeKey} className="align-top">
                <th scope="row" className="px-3 py-3 font-semibold text-gray-900"><span className="block">{rule.label}</span><span className="text-xs font-normal capitalize text-gray-500">{rule.module}</span></th>
                <td className="px-3 py-3"><select aria-label={`${rule.label} mode`} className={inputClass} value={draft.mode} disabled={!canManage} onChange={(event) => setField(rule.typeKey, "mode", event.target.value)}><option value="auto">Auto</option><option value="manual">Manual</option></select></td>
                <td className="px-3 py-3"><input aria-label={`${rule.label} prefix`} className={inputClass} value={draft.prefix} disabled={!canManage} onChange={(event) => setField(rule.typeKey, "prefix", event.target.value)} /></td>
                <td className="px-3 py-3"><input aria-label={`${rule.label} automatic pattern`} className={`${inputClass} min-w-64 font-mono`} value={draft.pattern} disabled={!canManage} onChange={(event) => setField(rule.typeKey, "pattern", event.target.value)} />{previews[rule.typeKey] ? <span className="mt-1 block text-xs text-indigo-700">Preview: {previews[rule.typeKey]}</span> : null}</td>
                <td className="px-3 py-3"><select aria-label={`${rule.label} reset policy`} className={inputClass} value={draft.resetPolicy} disabled={!canManage} onChange={(event) => setField(rule.typeKey, "resetPolicy", event.target.value)}><option value="none">Never</option><option value="daily">Daily</option><option value="monthly">Monthly</option><option value="calendar_year">Yearly</option><option value="fiscal_year">Fiscal year</option></select></td>
                <td className="px-3 py-3"><input aria-label={`${rule.label} serial digits`} type="number" min="1" max="12" className={`${inputClass} w-20`} value={draft.serialWidth} disabled={!canManage} onChange={(event) => setField(rule.typeKey, "serialWidth", event.target.value)} /></td>
                <td className="px-3 py-3"><div className="flex gap-2"><AdministrationButton disabled={busy === rule.typeKey} onClick={() => preview(rule.typeKey)}>Preview</AdministrationButton>{canManage ? <AdministrationButton variant="primary" icon={FiSave} disabled={busy === rule.typeKey} onClick={() => save(rule.typeKey)}>Save</AdministrationButton> : null}</div></td>
              </tr>
            })}</tbody>
          </table>
          {!visible.length ? <AdministrationTableState title="No matching number types" /> : null}
        </div>}
    </AdministrationCard>
  </AdministrationPage>
}
