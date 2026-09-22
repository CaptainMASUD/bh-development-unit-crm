/* eslint-disable react/prop-types, react-refresh/only-export-components -- view/form helpers are exported for focused tests */
import { useCallback, useEffect, useState } from "react"
import { useSelector } from "react-redux"
import { toast } from "react-hot-toast"
import { FiEdit2, FiLayers, FiPlus, FiRefreshCw, FiTrash2 } from "react-icons/fi"
import { hasPermission, PERMISSIONS } from "../../Auth/permissions"
import { administrationApi, administrationRequest } from "./administrationApi"
import {
  AdministrationButton, AdministrationCard, AdministrationField, AdministrationHeader,
  AdministrationModal, AdministrationPage, AdministrationStatus, AdministrationTableState,
  AdministrationToolbar, administrationStyles,
} from "./AdministrationUI"

const clean = (value) => String(value ?? "").trim()
const emptyForm = Object.freeze({ name: "", code: "", description: "", head: "", status: "active" })

export function validateDepartmentForm(form = {}) {
  if (!clean(form.name)) return "Department name is required."
  if (!clean(form.code)) return "Department code is required."
  if (!/^[A-Z0-9][A-Z0-9_-]{0,29}$/.test(clean(form.code).toUpperCase())) return "Department code must use letters, numbers, hyphens, or underscores (maximum 30 characters)."
  if (!["active", "inactive"].includes(form.status)) return "Select a valid status."
  return ""
}

export function buildDepartmentPayload(form = {}) {
  return { name: clean(form.name), code: clean(form.code).toUpperCase(), description: clean(form.description), head: clean(form.head) || null, status: form.status }
}

export function DepartmentForm({ form, heads = [], onChange, disabled = false }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <AdministrationField label="Department Name" htmlFor="department-name" required>
      <input id="department-name" className={administrationStyles.input} value={form.name} onChange={(event) => onChange("name", event.target.value)} disabled={disabled} maxLength={120} autoFocus />
    </AdministrationField>
    <AdministrationField label="Department Code" htmlFor="department-code" required hint="Unique within this company. Letters, numbers, hyphens, and underscores only.">
      <input id="department-code" className={administrationStyles.input} value={form.code} onChange={(event) => onChange("code", event.target.value.toUpperCase())} disabled={disabled} maxLength={30} placeholder="e.g. FIN" />
    </AdministrationField>
    <div className="sm:col-span-2"><AdministrationField label="Description" htmlFor="department-description" hint="Optional responsibilities or scope.">
      <textarea id="department-description" className={`${administrationStyles.input} min-h-24 resize-y`} value={form.description} onChange={(event) => onChange("description", event.target.value)} disabled={disabled} maxLength={1000} />
    </AdministrationField></div>
    <AdministrationField label="Department Head" htmlFor="department-head" hint="Optional. Assign now or later; this does not change the employee's department.">
      <select id="department-head" className={administrationStyles.input} value={form.head} onChange={(event) => onChange("head", event.target.value)} disabled={disabled}>
        <option value="">Assign later</option>{heads.map((head) => <option key={head._id} value={head._id}>{head.name || head.email}</option>)}
      </select>
    </AdministrationField>
    <AdministrationField label="Status" htmlFor="department-status" required>
      <select id="department-status" className={administrationStyles.input} value={form.status} onChange={(event) => onChange("status", event.target.value)} disabled={disabled}>
        <option value="active">Active</option><option value="inactive">Inactive</option>
      </select>
    </AdministrationField>
  </div>
}

export function AdministrationDepartmentsView({
  departments = [], heads = [], form = emptyForm, canManage = false, modalOpen = false,
  editing = null, loading = false, saving = false, deleting = false, error = "",
  search = "", statusFilter = "all", deleteTarget = null, deletePassword = "",
  onSearch, onStatusFilter, onOpenCreate, onEdit, onClose, onChange, onSave,
  onReload, onAskDelete, onCancelDelete, onDeletePassword, onConfirmDelete,
}) {
  const visible = departments.filter((department) => {
    if (statusFilter === "active" && department.isActive === false) return false
    if (statusFilter === "inactive" && department.isActive !== false) return false
    const query = clean(search).toLowerCase()
    return !query || [department.name, department.code, department.description, department.head?.name]
      .some((value) => String(value || "").toLowerCase().includes(query))
  })
  return <AdministrationPage>
    <AdministrationHeader title="Departments" icon={FiLayers}
      description="Manage the shared departments used in employee management, Payroll, and throughout the ERP."
      actions={<><AdministrationButton icon={FiRefreshCw} onClick={onReload}>Refresh</AdministrationButton>{canManage ? <AdministrationButton variant="primary" icon={FiPlus} onClick={onOpenCreate}>Add Department</AdministrationButton> : null}</>} />
    <AdministrationCard className="overflow-hidden p-4 sm:p-5">
      <AdministrationToolbar value={search} onChange={onSearch} placeholder="Search departments by name, code, or head..."
        utilities={<select aria-label="Filter department status" className={`${administrationStyles.input} w-auto min-w-40`} value={statusFilter} onChange={(event) => onStatusFilter?.(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>} />
      {loading ? <AdministrationTableState status="loading" /> : error ? <AdministrationTableState status="error" description={error} onRetry={onReload} /> :
        <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-100">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr>
              <th className="px-4 py-3">Department Code</th><th className="px-4 py-3">Department Name</th><th className="px-4 py-3">Description</th><th className="px-4 py-3">Department Head</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">{visible.map((department) => <tr key={department._id}>
              <td className="px-4 py-3 font-semibold text-gray-900">{department.code || <span className="text-amber-700">Needs code</span>}</td>
              <td className="px-4 py-3 font-semibold text-gray-900">{department.name}</td>
              <td className="max-w-xs truncate px-4 py-3 text-gray-600" title={department.description || ""}>{department.description || "—"}</td>
              <td className="px-4 py-3 text-gray-600">{department.head?.name || "Not assigned"}</td>
              <td className="px-4 py-3"><AdministrationStatus value={department.isActive === false ? "inactive" : "active"} /></td>
              <td className="px-4 py-3"><div className="flex justify-end gap-2">{canManage ? <><AdministrationButton icon={FiEdit2} onClick={() => onEdit?.(department)}>Edit</AdministrationButton><AdministrationButton icon={FiTrash2} variant="danger" onClick={() => onAskDelete?.(department)}>Delete</AdministrationButton></> : <span className="text-xs text-gray-400">View only</span>}</div></td>
            </tr>)}</tbody>
          </table>
          {!visible.length ? <AdministrationTableState title={departments.length ? "No matching departments" : "No departments yet"} description={departments.length ? "Try another search or status filter." : "Create your first department in Administration."} /> : null}
          <div className="border-t border-gray-100 px-4 py-3 text-xs font-medium text-gray-500">Showing {visible.length} of {departments.length} departments</div>
        </div>}
    </AdministrationCard>
    <AdministrationModal open={modalOpen} onClose={onClose} title={editing ? "Edit Department" : "Create Department"}
      description="This shared department record is available throughout the ERP."
      footer={<div className="flex justify-end gap-2"><AdministrationButton onClick={onClose} disabled={saving}>Cancel</AdministrationButton><AdministrationButton variant="primary" onClick={onSave} disabled={saving}>{saving ? "Saving..." : editing ? "Save Changes" : "Create Department"}</AdministrationButton></div>}>
      <DepartmentForm form={form} heads={heads} onChange={onChange} disabled={saving} />
    </AdministrationModal>
    <AdministrationModal open={Boolean(deleteTarget)} onClose={onCancelDelete} title="Delete Department"
      description={`Delete ${deleteTarget?.name || "this department"}? Assigned employees or positions block deletion.`}
      footer={<div className="flex justify-end gap-2"><AdministrationButton onClick={onCancelDelete} disabled={deleting}>Cancel</AdministrationButton><AdministrationButton variant="danger" onClick={onConfirmDelete} disabled={deleting || !deletePassword}>{deleting ? "Deleting..." : "Delete Department"}</AdministrationButton></div>}>
      <AdministrationField label="Confirm with your password" htmlFor="department-delete-password" required><input id="department-delete-password" type="password" className={administrationStyles.input} value={deletePassword} onChange={(event) => onDeletePassword?.(event.target.value)} autoComplete="current-password" /></AdministrationField>
    </AdministrationModal>
  </AdministrationPage>
}

export default function AdministrationDepartments() {
  const currentUser = useSelector((state) => state.user?.currentUser)
  const canManage = hasPermission(currentUser, PERMISSIONS.ACCESS_CONTROL_MANAGE)
  const [departments, setDepartments] = useState([])
  const [heads, setHeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [form, setForm] = useState({ ...emptyForm })
  const [editing, setEditing] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deletePassword, setDeletePassword] = useState("")
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [departmentResponse, headResponse] = await Promise.all([
        administrationApi.get("/departments"), administrationApi.get("/department-heads"),
      ])
      setDepartments(departmentResponse.departments || [])
      setHeads(headResponse.heads || [])
    } catch (requestError) { setError(requestError.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm }); setModalOpen(true) }
  const openEdit = (department) => {
    setEditing(department)
    setForm({ name: department.name || "", code: department.code || "", description: department.description || "", head: department.head?._id || department.head || "", status: department.isActive === false ? "inactive" : "active" })
    setModalOpen(true)
  }
  const update = (field, value) => setForm((previous) => ({ ...previous, [field]: value }))
  const save = async () => {
    const validation = validateDepartmentForm(form)
    if (validation) return toast.error(validation)
    setSaving(true)
    try {
      const payload = buildDepartmentPayload(form)
      if (editing) await administrationApi.patch(`/departments/${editing._id}`, payload)
      else await administrationRequest("/departments", { method: "POST", body: payload })
      toast.success(editing ? "Department updated" : "Department created")
      setModalOpen(false)
      await load()
    } catch (requestError) { toast.error(requestError.message) }
    finally { setSaving(false) }
  }
  const confirmDelete = async () => {
    if (!deleteTarget || !deletePassword) return
    setDeleting(true)
    try {
      await administrationRequest(`/departments/${deleteTarget._id}`, { method: "DELETE", body: { password: deletePassword } })
      toast.success("Department deleted")
      setDeleteTarget(null)
      setDeletePassword("")
      await load()
    } catch (requestError) { toast.error(requestError.message) }
    finally { setDeleting(false) }
  }
  const visibleHeads = editing?.head && !heads.some((head) => head._id === (editing.head?._id || editing.head)) && typeof editing.head === "object" ? [...heads, editing.head] : heads
  return <AdministrationDepartmentsView departments={departments} heads={visibleHeads} form={form} canManage={canManage}
    modalOpen={modalOpen} editing={editing} loading={loading} saving={saving} deleting={deleting} error={error}
    search={search} statusFilter={statusFilter} deleteTarget={deleteTarget} deletePassword={deletePassword}
    onSearch={setSearch} onStatusFilter={setStatusFilter} onOpenCreate={openCreate} onEdit={openEdit}
    onClose={() => setModalOpen(false)} onChange={update} onSave={save} onReload={load}
    onAskDelete={(department) => { setDeleteTarget(department); setDeletePassword("") }}
    onCancelDelete={() => { setDeleteTarget(null); setDeletePassword("") }} onDeletePassword={setDeletePassword} onConfirmDelete={confirmDelete} />
}
