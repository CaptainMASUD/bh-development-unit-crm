/* eslint-disable react/prop-types, react-refresh/only-export-components -- Role Management Administration page and matrix components */
import { useCallback, useEffect, useMemo, useState } from "react"
import { useSelector } from "react-redux"
import { toast } from "react-hot-toast"
import {
  FiCheck,
  FiCheckSquare,
  FiEdit2,
  FiInfo,
  FiLayers,
  FiLock,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiTrash2,
  FiUsers,
  FiX,
} from "react-icons/fi"
import { hasPermission, PERMISSIONS } from "../../Auth/permissions"
import { administrationApi } from "./administrationApi"
import {
  AdministrationButton,
  AdministrationCard,
  AdministrationField,
  AdministrationHeader,
  AdministrationModal,
  AdministrationPage,
  AdministrationStatus,
  AdministrationTableState,
  AdministrationToolbar,
  administrationCx,
  administrationStyles,
} from "./AdministrationUI"

const clean = (val) => String(val ?? "").trim()

export const EMPTY_ROLE_FORM = Object.freeze({
  name: "",
  department: "",
  description: "",
  status: "active",
  modules: [],
  accessMatrix: [],
})

export function validateRoleForm(form = {}) {
  if (!clean(form.name)) return "Role name is required."
  const norm = clean(form.name).toLowerCase()
  if (["superadmin", "admin", "employee"].includes(norm)) {
    return "Admin, Superadmin, and Employee are protected system role names."
  }
  return ""
}

export function buildRolePayload(form = {}) {
  return {
    name: clean(form.name),
    department: clean(form.department) || null,
    description: clean(form.description),
    isActive: form.status === "active",
    modules: Array.isArray(form.modules) ? form.modules : [],
    accessMatrix: Array.isArray(form.accessMatrix) ? form.accessMatrix : [],
  }
}

export function RoleMatrixTable({
  catalogModule,
  accessMap = {},
  onChangeRowAction,
  onChangeRowAll,
  onToggleColumn,
  readOnly = false,
}) {
  const submodules = catalogModule?.submodules || []

  // Column header "all checked" states
  const columnStates = useMemo(() => {
    const actions = ["view", "create", "edit", "delete", "approve", "all"]
    const res = {}

    for (const act of actions) {
      let totalApplicable = 0
      let checkedCount = 0

      for (const sub of submodules) {
        if (act === "all") {
          totalApplicable++
          const row = accessMap[sub.key] || {}
          if (row.all) checkedCount++
        } else if (sub.actions?.[act]) {
          totalApplicable++
          const row = accessMap[sub.key] || {}
          if (row[act]) checkedCount++
        }
      }

      res[act] = totalApplicable > 0 && checkedCount === totalApplicable
    }

    return res
  }, [submodules, accessMap])

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
            {catalogModule.moduleName.charAt(0)}
          </span>
          <h4 className="text-sm font-black text-gray-900">{catalogModule.moduleName}</h4>
          <span className="text-xs text-gray-500">({submodules.length} submodules)</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/60 text-[11px] font-black uppercase tracking-wider text-gray-500">
              <th className="py-3 pl-4 pr-3 min-w-[200px]">Submodule</th>
              {["view", "create", "edit", "delete", "approve", "all"].map((act) => (
                <th key={act} className="px-3 py-3 text-center whitespace-nowrap">
                  <div className="flex flex-col items-center gap-1">
                    <span className={act === "all" ? "text-indigo-600 font-extrabold" : ""}>
                      {act.toUpperCase()}
                    </span>
                    {!readOnly && (
                      <input
                        type="checkbox"
                        checked={columnStates[act] || false}
                        onChange={(e) => onToggleColumn(catalogModule.moduleId, act, e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        title={`Select all ${act}`}
                      />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white font-medium">
            {submodules.map((sub) => {
              const row = accessMap[sub.key] || {}
              const isAllChecked = Boolean(row.all)

              return (
                <tr key={sub.key} className="transition hover:bg-indigo-50/20">
                  {/* Submodule label and route */}
                  <td className="py-3 pl-4 pr-3">
                    <div className="font-bold text-gray-900">{sub.name}</div>
                    <div className="font-mono text-[11px] text-gray-400">{sub.route}</div>
                  </td>

                  {/* View */}
                  <td className="px-3 py-3 text-center">
                    {sub.actions?.view ? (
                      <input
                        type="checkbox"
                        checked={Boolean(row.view)}
                        disabled={readOnly}
                        onChange={(e) =>
                          onChangeRowAction(sub.key, "view", e.target.checked, sub.actions)
                        }
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed"
                      />
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>

                  {/* Create */}
                  <td className="px-3 py-3 text-center">
                    {sub.actions?.create ? (
                      <input
                        type="checkbox"
                        checked={Boolean(row.create)}
                        disabled={readOnly}
                        onChange={(e) =>
                          onChangeRowAction(sub.key, "create", e.target.checked, sub.actions)
                        }
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed"
                      />
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>

                  {/* Edit */}
                  <td className="px-3 py-3 text-center">
                    {sub.actions?.edit ? (
                      <input
                        type="checkbox"
                        checked={Boolean(row.edit)}
                        disabled={readOnly}
                        onChange={(e) =>
                          onChangeRowAction(sub.key, "edit", e.target.checked, sub.actions)
                        }
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed"
                      />
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>

                  {/* Delete */}
                  <td className="px-3 py-3 text-center">
                    {sub.actions?.delete ? (
                      <input
                        type="checkbox"
                        checked={Boolean(row.delete)}
                        disabled={readOnly}
                        onChange={(e) =>
                          onChangeRowAction(sub.key, "delete", e.target.checked, sub.actions)
                        }
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed"
                      />
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>

                  {/* Approve */}
                  <td className="px-3 py-3 text-center">
                    {sub.actions?.approve ? (
                      <input
                        type="checkbox"
                        checked={Boolean(row.approve)}
                        disabled={readOnly}
                        onChange={(e) =>
                          onChangeRowAction(sub.key, "approve", e.target.checked, sub.actions)
                        }
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed"
                      />
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>

                  {/* ALL */}
                  <td className="px-3 py-3 text-center bg-indigo-50/30">
                    <input
                      type="checkbox"
                      checked={isAllChecked}
                      disabled={readOnly}
                      onChange={(e) => onChangeRowAll(sub.key, e.target.checked, sub.actions)}
                      className="h-4 w-4 rounded border-indigo-400 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function RoleModal({
  open,
  editing,
  form,
  departments = [],
  catalog = [],
  saving = false,
  readOnly = false,
  onClose,
  onChangeField,
  onToggleModule,
  onChangeRowAction,
  onChangeRowAll,
  onToggleColumn,
  onSave,
}) {
  const activeModules = form.modules || []
  const isReadOnly = Boolean(editing?.isSystem || readOnly)

  // Pre-calculate mapped access rows by submodule key for fast lookups
  const accessMap = useMemo(() => {
    const map = {}
    for (const row of form.accessMatrix || []) {
      if (row?.submodule) map[row.submodule] = row
    }
    return map
  }, [form.accessMatrix])

  const selectedCatalogModules = useMemo(() => {
    const set = new Set(activeModules.map((m) => String(m).toLowerCase()))
    return catalog.filter((m) => set.has(m.moduleId.toLowerCase()))
  }, [catalog, activeModules])

  return (
    <AdministrationModal
      open={open}
      onClose={onClose}
      title={
        editing
          ? isReadOnly
            ? `System Role: ${editing.name} (Protected)`
            : `Edit Role: ${editing.name}`
          : "Create New Role"
      }
      description={
        isReadOnly
          ? "Built-in system roles are protected and cannot be modified."
          : "Configure role metadata, department assignment, accessible ERP modules, and granular submodule permissions."
      }
      maxWidthClass="max-w-6xl"
      footer={
        <div className="flex justify-end gap-2">
          <AdministrationButton onClick={onClose} disabled={saving}>
            {isReadOnly ? "Close" : "Cancel"}
          </AdministrationButton>
          {!isReadOnly && (
            <AdministrationButton variant="primary" onClick={onSave} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Create Role"}
            </AdministrationButton>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Step 1: Role Basic Details */}
        <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
          <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-gray-500">
            Step 1: Role Information & Department
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AdministrationField label="Role Name" htmlFor="role-name" required>
              <input
                id="role-name"
                className={administrationStyles.input}
                value={form.name}
                onChange={(e) => onChangeField("name", e.target.value)}
                placeholder="e.g. IT Manager, Production Supervisor"
                disabled={saving || isReadOnly}
                autoFocus={!isReadOnly}
              />
            </AdministrationField>

            <AdministrationField
              label="Assigned Department"
              htmlFor="role-department"
              hint="Select the department this role belongs to (e.g. IT, Operations)."
            >
              <select
                id="role-department"
                className={administrationStyles.input}
                value={form.department}
                onChange={(e) => onChangeField("department", e.target.value)}
                disabled={saving || isReadOnly}
              >
                <option value="">General / All Departments</option>
                {departments.map((dept) => (
                  <option key={dept._id} value={dept._id}>
                    {dept.name} ({dept.code})
                  </option>
                ))}
              </select>
            </AdministrationField>

            <AdministrationField label="Status" htmlFor="role-status" required>
              <select
                id="role-status"
                className={administrationStyles.input}
                value={form.status}
                onChange={(e) => onChangeField("status", e.target.value)}
                disabled={saving || isReadOnly}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </AdministrationField>

            <div className="sm:col-span-2 lg:col-span-3">
              <AdministrationField
                label="Role Description"
                htmlFor="role-description"
                hint="Optional notes on the responsibilities and scope of this role."
              >
                <textarea
                  id="role-description"
                  className={`${administrationStyles.input} min-h-16 resize-y`}
                  value={form.description}
                  onChange={(e) => onChangeField("description", e.target.value)}
                  placeholder="Responsibilities, required access, or departmental notes..."
                  disabled={saving || isReadOnly}
                />
              </AdministrationField>
            </div>
          </div>
        </div>

        {/* Step 2: ERP Module Selection */}
        <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-500">
              Step 2: Select ERP Modules
            </h3>
            <span className="text-xs font-bold text-indigo-600">
              {activeModules.length} selected
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Select the modules this role will have access to. Submodule permission tables will
            appear below for each selected module.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {catalog.map((mod) => {
              const selected = activeModules.includes(mod.moduleId)
              return (
                <button
                  type="button"
                  key={mod.moduleId}
                  onClick={() => onToggleModule(mod.moduleId)}
                  disabled={saving || isReadOnly}
                  className={administrationCx(
                    "flex items-center justify-between rounded-xl border p-2.5 text-xs font-bold transition",
                    selected
                      ? "border-indigo-600 bg-indigo-50/70 text-indigo-900 shadow-sm"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                    isReadOnly && "cursor-default opacity-85"
                  )}
                >
                  <span className="truncate">{mod.moduleName}</span>
                  {selected ? (
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white">
                      <FiCheck className="h-3 w-3" />
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>

        {/* Step 3: Submodule Accessibility Matrix */}
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-500">
              Step 3: Submodule Accessibility Matrix
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Configure View, Create, Edit, Delete, and Approve capabilities for each submodule.
              Checking ALL selects all capabilities for that row.
            </p>
          </div>

          {selectedCatalogModules.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm font-medium text-gray-500">
              Select one or more modules in Step 2 above to configure submodule accessibility.
            </div>
          ) : (
            selectedCatalogModules.map((catMod) => (
              <RoleMatrixTable
                key={catMod.moduleId}
                catalogModule={catMod}
                accessMap={accessMap}
                onChangeRowAction={onChangeRowAction}
                onChangeRowAll={onChangeRowAll}
                onToggleColumn={onToggleColumn}
                readOnly={saving || isReadOnly}
              />
            ))
          )}
        </div>
      </div>
    </AdministrationModal>
  )
}

export function RoleManagementView({
  roles = [],
  departments = [],
  catalog = [],
  stats = { totalRoles: 0, activeRoles: 0, customRoles: 0, departmentsCovered: 0 },
  loading = false,
  error = "",
  search = "",
  departmentFilter = "",
  statusFilter = "all",
  canManage = true,
  modalOpen = false,
  editing = null,
  form = EMPTY_ROLE_FORM,
  saving = false,
  deleteTarget = null,
  deletePassword = "",
  deleting = false,
  onSearch,
  onDepartmentFilter,
  onStatusFilter,
  onOpenCreate,
  onEdit,
  onClose,
  onChangeField,
  onToggleModule,
  onChangeRowAction,
  onChangeRowAll,
  onToggleColumn,
  onSave,
  onReload,
  onAskDelete,
  onCancelDelete,
  onDeletePassword,
  onConfirmDelete,
}) {
  const visible = roles.filter((role) => {
    if (statusFilter === "active" && role.isActive === false) return false
    if (statusFilter === "inactive" && role.isActive !== false) return false
    if (departmentFilter && (!role.department || String(role.department._id) !== departmentFilter)) {
      return false
    }
    const q = clean(search).toLowerCase()
    if (!q) return true
    return [role.name, role.description, role.department?.name]
      .some((val) => String(val || "").toLowerCase().includes(q))
  })

  return (
    <AdministrationPage>
      <AdministrationHeader
        title="Role Management"
        description="Define and manage company roles, department associations, and fine-grained submodule accessibilities across all ERP modules."
        icon={FiShield}
        actions={
          <div className="flex items-center gap-2">
            <AdministrationButton icon={FiRefreshCw} onClick={onReload} disabled={loading}>
              Refresh
            </AdministrationButton>
            {canManage && (
              <AdministrationButton variant="primary" icon={FiPlus} onClick={onOpenCreate}>
                Create Role
              </AdministrationButton>
            )}
          </div>
        }
      >
        {/* KPI Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3 sm:p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
              <FiShield className="h-4 w-4 text-indigo-600" />
              Total Roles
            </div>
            <p className="mt-2 text-2xl font-black text-gray-950 sm:text-3xl">{stats.totalRoles}</p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3 sm:p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
              <FiCheckSquare className="h-4 w-4 text-emerald-600" />
              Active Roles
            </div>
            <p className="mt-2 text-2xl font-black text-gray-950 sm:text-3xl">{stats.activeRoles}</p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3 sm:p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
              <FiLayers className="h-4 w-4 text-blue-600" />
              Custom Roles
            </div>
            <p className="mt-2 text-2xl font-black text-gray-950 sm:text-3xl">{stats.customRoles}</p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3 sm:p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
              <FiUsers className="h-4 w-4 text-purple-600" />
              Departments
            </div>
            <p className="mt-2 text-2xl font-black text-gray-950 sm:text-3xl">
              {stats.departmentsCovered} / {departments.length}
            </p>
          </div>
        </div>
      </AdministrationHeader>

      <AdministrationCard className="overflow-hidden p-4 sm:p-5">
        <AdministrationToolbar
          value={search}
          onChange={onSearch}
          placeholder="Search roles by name, department, or description..."
          utilities={
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filter role department"
                className={`${administrationStyles.input} w-auto min-w-44`}
                value={departmentFilter}
                onChange={(e) => onDepartmentFilter?.(e.target.value)}
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter role status"
                className={`${administrationStyles.input} w-auto min-w-36`}
                value={statusFilter}
                onChange={(e) => onStatusFilter?.(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          }
        />

        {loading ? (
          <AdministrationTableState status="loading" />
        ) : error ? (
          <AdministrationTableState status="error" description={error} onRetry={onReload} />
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-100">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Role Name</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Accessible Modules</th>
                  <th className="px-4 py-3">Permissions</th>
                  <th className="px-4 py-3">Employees</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map((role) => (
                  <tr key={role._id} className="transition hover:bg-gray-50/50">
                    {/* Role Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{role.name}</span>
                        {role.isSystem ? (
                          <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-black uppercase text-indigo-700 ring-1 ring-indigo-600/20">
                            System
                          </span>
                        ) : null}
                      </div>
                      {role.description ? (
                        <p className="mt-0.5 line-clamp-1 max-w-xs text-xs text-gray-500">
                          {role.description}
                        </p>
                      ) : null}
                    </td>

                    {/* Department */}
                    <td className="px-4 py-3">
                      {role.department ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 text-xs font-bold text-gray-800">
                          {role.department.name}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">All Departments</span>
                      )}
                    </td>

                    {/* Accessible Modules */}
                    <td className="px-4 py-3">
                      {role.modules && role.modules.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {role.modules.slice(0, 3).map((m) => (
                            <span
                              key={m}
                              className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-gray-700"
                            >
                              {m}
                            </span>
                          ))}
                          {role.modules.length > 3 && (
                            <span className="text-[10px] font-bold text-indigo-600 self-center">
                              +{role.modules.length - 3} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>

                    {/* Permissions */}
                    <td className="px-4 py-3 font-semibold text-gray-700">
                      {role.permissionCount || (role.permissions || []).length} active
                    </td>

                    {/* Assigned Employees */}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 font-bold text-gray-800">
                        <FiUsers className="h-3.5 w-3.5 text-gray-400" />
                        {role.employeeCount || 0}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <AdministrationStatus
                        value={role.isActive === false ? "inactive" : "active"}
                      />
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {role.isSystem ? (
                          <AdministrationButton
                            icon={FiEdit2}
                            onClick={() => onEdit?.(role)}
                          >
                            View
                          </AdministrationButton>
                        ) : (
                          <>
                            <AdministrationButton
                              icon={FiEdit2}
                              onClick={() => onEdit?.(role)}
                            >
                              Edit
                            </AdministrationButton>
                            {canManage && (
                              <AdministrationButton
                                icon={FiTrash2}
                                variant="danger"
                                onClick={() => onAskDelete?.(role)}
                              >
                                Delete
                              </AdministrationButton>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!visible.length ? (
              <div className="py-6 text-center">
                <AdministrationTableState
                  title={roles.length ? "No matching roles" : "No roles configured"}
                  description={
                    roles.length
                      ? "Try adjusting your search keywords or department filter."
                      : "Create your first custom role to manage module and submodule accessibility."
                  }
                />
                {!roles.length && canManage && (
                  <div className="mt-3 flex justify-center">
                    <AdministrationButton variant="primary" icon={FiPlus} onClick={onOpenCreate}>
                      Create Role
                    </AdministrationButton>
                  </div>
                )}
              </div>
            ) : null}

            <div className="border-t border-gray-100 px-4 py-3 text-xs font-medium text-gray-500">
              Showing {visible.length} of {roles.length} roles
            </div>
          </div>
        )}
      </AdministrationCard>

      {/* Role Create / Edit Modal */}
      <RoleModal
        open={modalOpen}
        editing={editing}
        form={form}
        departments={departments}
        catalog={catalog}
        saving={saving}
        readOnly={editing?.isSystem || !canManage}
        onClose={onClose}
        onChangeField={onChangeField}
        onToggleModule={onToggleModule}
        onChangeRowAction={onChangeRowAction}
        onChangeRowAll={onChangeRowAll}
        onToggleColumn={onToggleColumn}
        onSave={onSave}
      />

      {/* Delete Confirmation Modal */}
      <AdministrationModal
        open={Boolean(deleteTarget)}
        onClose={onCancelDelete}
        title="Delete Role"
        description={`Are you sure you want to delete role "${deleteTarget?.name}"? Enter your administrator password to confirm.`}
        footer={
          <div className="flex justify-end gap-2">
            <AdministrationButton onClick={onCancelDelete} disabled={deleting}>
              Cancel
            </AdministrationButton>
            <AdministrationButton
              variant="danger"
              onClick={onConfirmDelete}
              disabled={deleting || !deletePassword}
            >
              {deleting ? "Deleting..." : "Delete Role"}
            </AdministrationButton>
          </div>
        }
      >
        <div className="space-y-4">
          {deleteTarget?.employeeCount > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800">
              Warning: This role is currently assigned to {deleteTarget.employeeCount} employee(s).
              You must reassign them to another role before deleting.
            </div>
          )}

          <AdministrationField
            label="Administrator Password"
            htmlFor="delete-role-password"
            required
            hint="For security, verify your current password before deleting roles."
          >
            <input
              id="delete-role-password"
              type="password"
              className={administrationStyles.input}
              value={deletePassword}
              onChange={(e) => onDeletePassword(e.target.value)}
              placeholder="Enter your current password"
              disabled={deleting}
              autoFocus
            />
          </AdministrationField>
        </div>
      </AdministrationModal>
    </AdministrationPage>
  )
}

export default function RoleManagement() {
  const reduxUser = useSelector((state) => state.user?.currentUser || state.auth?.user)
  const currentUser = useMemo(() => {
    if (reduxUser) return reduxUser
    try {
      const stored = localStorage.getItem("user")
      if (stored) {
        const parsed = JSON.parse(stored)
        return parsed?.user || parsed
      }
    } catch {
      // ignore
    }
    return null
  }, [reduxUser])

  const canManage = useMemo(() => {
    if (!currentUser) return true
    const role = String(currentUser?.role || "").toLowerCase()
    if (["admin", "superadmin"].includes(role)) return true
    return hasPermission(currentUser, PERMISSIONS.ACCESS_CONTROL_MANAGE)
  }, [currentUser])

  const [roles, setRoles] = useState([])
  const [departments, setDepartments] = useState([])
  const [catalog, setCatalog] = useState([])
  const [stats, setStats] = useState({
    totalRoles: 0,
    activeRoles: 0,
    customRoles: 0,
    departmentsCovered: 0,
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [search, setSearch] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  // Modal create/edit state
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_ROLE_FORM)
  const [saving, setSaving] = useState(false)

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deletePassword, setDeletePassword] = useState("")
  const [deleting, setDeleting] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [rolesRes, deptsRes, catalogRes] = await Promise.all([
        administrationApi.get("/roles"),
        administrationApi.get("/departments"),
        administrationApi.get("/roles/matrix"),
      ])

      setRoles(rolesRes?.data?.roles || [])
      if (rolesRes?.data?.stats) setStats(rolesRes.data.stats)
      setDepartments(deptsRes?.departments || [])
      setCatalog(catalogRes?.data?.catalog || [])
    } catch (err) {
      setError(err?.message || "Failed to load roles and departments.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleOpenCreate = () => {
    setEditing(null)
    setForm({
      ...EMPTY_ROLE_FORM,
      modules: catalog.length > 0 ? [catalog[0].moduleId] : [],
      accessMatrix: [],
    })
    setModalOpen(true)
  }

  const handleEdit = async (role) => {
    try {
      const res = await administrationApi.get(`/roles/${role._id}`)
      const detail = res?.data?.role || role

      setEditing(detail)
      setForm({
        name: detail.name || "",
        department: detail.department?._id || detail.department || "",
        description: detail.description || "",
        status: detail.isActive === false ? "inactive" : "active",
        modules: detail.modules || [],
        accessMatrix: detail.accessMatrix || [],
      })
      setModalOpen(true)
    } catch (err) {
      toast.error(err?.message || "Failed to load role details.")
    }
  }

  const handleChangeField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleToggleModule = (moduleId) => {
    setForm((prev) => {
      const current = prev.modules || []
      const exists = current.includes(moduleId)
      const nextModules = exists
        ? current.filter((m) => m !== moduleId)
        : [...current, moduleId]

      return {
        ...prev,
        modules: nextModules,
      }
    })
  }

  const handleChangeRowAction = (submoduleKey, actionKey, checked, availableActions = {}) => {
    setForm((prev) => {
      const matrix = [...(prev.accessMatrix || [])]
      const idx = matrix.findIndex((r) => r.submodule === submoduleKey)
      const current = idx >= 0 ? { ...matrix[idx] } : { submodule: submoduleKey }

      current[actionKey] = checked

      // Auto-dependency: If create/edit/delete/approve is checked, view must be checked
      if (checked && actionKey !== "view" && availableActions.view) {
        current.view = true
      }

      // Auto-dependency: If view is unchecked, uncheck create/edit/delete/approve
      if (!checked && actionKey === "view") {
        current.create = false
        current.edit = false
        current.delete = false
        current.approve = false
      }

      // Check if all available actions are now checked
      const validActions = [
        availableActions.view && "view",
        availableActions.create && "create",
        availableActions.edit && "edit",
        availableActions.delete && "delete",
        availableActions.approve && "approve",
      ].filter(Boolean)

      current.all =
        validActions.length > 0 && validActions.every((act) => Boolean(current[act]))

      if (idx >= 0) {
        matrix[idx] = current
      } else {
        matrix.push(current)
      }

      return { ...prev, accessMatrix: matrix }
    })
  }

  const handleChangeRowAll = (submoduleKey, checked, availableActions = {}) => {
    setForm((prev) => {
      const matrix = [...(prev.accessMatrix || [])]
      const idx = matrix.findIndex((r) => r.submodule === submoduleKey)
      const current = {
        submodule: submoduleKey,
        view: availableActions.view ? checked : false,
        create: availableActions.create ? checked : false,
        edit: availableActions.edit ? checked : false,
        delete: availableActions.delete ? checked : false,
        approve: availableActions.approve ? checked : false,
        all: checked,
      }

      if (idx >= 0) {
        matrix[idx] = current
      } else {
        matrix.push(current)
      }

      return { ...prev, accessMatrix: matrix }
    })
  }

  const handleToggleColumn = (moduleId, actionKey, checked) => {
    const mod = catalog.find((m) => m.moduleId === moduleId)
    if (!mod) return

    setForm((prev) => {
      const matrix = [...(prev.accessMatrix || [])]
      const matrixMap = new Map(matrix.map((r, i) => [r.submodule, { row: { ...r }, index: i }]))

      for (const sub of mod.submodules) {
        const item = matrixMap.get(sub.key)
        const row = item ? item.row : { submodule: sub.key }

        if (actionKey === "all") {
          row.view = sub.actions?.view ? checked : false
          row.create = sub.actions?.create ? checked : false
          row.edit = sub.actions?.edit ? checked : false
          row.delete = sub.actions?.delete ? checked : false
          row.approve = sub.actions?.approve ? checked : false
          row.all = checked
        } else if (sub.actions?.[actionKey]) {
          row[actionKey] = checked

          if (checked && actionKey !== "view" && sub.actions.view) {
            row.view = true
          }
          if (!checked && actionKey === "view") {
            row.create = false
            row.edit = false
            row.delete = false
            row.approve = false
          }

          const valid = [
            sub.actions.view && "view",
            sub.actions.create && "create",
            sub.actions.edit && "edit",
            sub.actions.delete && "delete",
            sub.actions.approve && "approve",
          ].filter(Boolean)

          row.all = valid.length > 0 && valid.every((act) => Boolean(row[act]))
        }

        if (item) {
          matrix[item.index] = row
        } else {
          matrix.push(row)
        }
      }

      return { ...prev, accessMatrix: matrix }
    })
  }

  const handleSave = async () => {
    const validationError = validateRoleForm(form)
    if (validationError) {
      toast.error(validationError)
      return
    }

    setSaving(true)
    try {
      const payload = buildRolePayload(form)

      if (editing) {
        await administrationApi.patch(`/roles/${editing._id}`, payload)
        toast.success("Role updated successfully.")
      } else {
        await administrationApi.post(`/roles`, payload)
        toast.success("Role created successfully.")
      }

      setModalOpen(false)
      loadData()
    } catch (err) {
      toast.error(err?.message || "Failed to save role.")
    } finally {
      setSaving(false)
    }
  }

  const handleAskDelete = (role) => {
    setDeleteTarget(role)
    setDeletePassword("")
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !deletePassword) return
    setDeleting(true)
    try {
      const data = await administrationApi.remove(`/roles/${deleteTarget._id}`, {
        password: deletePassword,
      })

      toast.success(data?.message || "Role deleted.")
      setDeleteTarget(null)
      loadData()
    } catch (err) {
      toast.error(err?.message || "Delete failed.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <RoleManagementView
      roles={roles}
      departments={departments}
      catalog={catalog}
      stats={stats}
      loading={loading}
      error={error}
      search={search}
      departmentFilter={departmentFilter}
      statusFilter={statusFilter}
      canManage={canManage}
      modalOpen={modalOpen}
      editing={editing}
      form={form}
      saving={saving}
      deleteTarget={deleteTarget}
      deletePassword={deletePassword}
      deleting={deleting}
      onSearch={setSearch}
      onDepartmentFilter={setDepartmentFilter}
      onStatusFilter={setStatusFilter}
      onOpenCreate={handleOpenCreate}
      onEdit={handleEdit}
      onClose={() => setModalOpen(false)}
      onChangeField={handleChangeField}
      onToggleModule={handleToggleModule}
      onChangeRowAction={handleChangeRowAction}
      onChangeRowAll={handleChangeRowAll}
      onToggleColumn={handleToggleColumn}
      onSave={handleSave}
      onReload={loadData}
      onAskDelete={handleAskDelete}
      onCancelDelete={() => setDeleteTarget(null)}
      onDeletePassword={setDeletePassword}
      onConfirmDelete={handleConfirmDelete}
    />
  )
}
