"use client"

import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import toast, { Toaster } from "react-hot-toast"
import { FiCalendar, FiCheckCircle, FiEdit3, FiPlus, FiRefreshCcw, FiTrash2, FiX } from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const card =
  "rounded-3xl border border-gray-100 bg-white shadow-[0_18px_50px_-35px_rgba(15,23,42,0.45)]"

const btn =
  "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"

const btnPrimary = "bg-indigo-600 text-white hover:bg-indigo-700"
const btnGhost = "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
const btnDanger = "border border-rose-200 bg-white text-rose-600 hover:bg-rose-50"

const input =
  "h-11 w-full rounded-2xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"

const label = "mb-1.5 block text-sm font-semibold text-gray-700"

const createEmptyForm = () => ({
  name: "",
  description: "",
  year: new Date().getFullYear(),
  paidDays: 0,
  unpaidDays: 0,
  unpaidCharge: {
    enabled: true,
    calculationType: "per_day",
    value: 0,
    basedOn: "basicSalary",
  },
  departments: [],
  positions: [],
  isActive: true,
})

function headers() {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
    credentials: "include",
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data?.message || "Request failed")
  }

  return data
}

function formatList(items, key) {
  if (!Array.isArray(items) || !items.length) return "Any"
  return items.map((item) => item?.[key]).filter(Boolean).join(", ") || "Any"
}

function MultiSelect({ label, value, options, onChange, emptyLabel }) {
  const selected = new Set((value || []).map(String))

  const toggle = (id) => {
    const key = String(id)
    if (selected.has(key)) {
      onChange(value.filter((item) => String(item) !== key))
    } else {
      onChange([...(value || []), key])
    }
  }

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-gray-800">{label}</p>

      <div className="max-h-44 overflow-auto rounded-2xl border border-gray-100 bg-gray-50/80 p-2">
        {options.map((option) => {
          const active = selected.has(String(option._id))

          return (
            <button
              type="button"
              key={option._id}
              onClick={() => toggle(option._id)}
              className={`mb-2 mr-2 rounded-xl px-3 py-2 text-xs font-semibold ring-1 transition ${
                active
                  ? "bg-indigo-600 text-white ring-indigo-600"
                  : "bg-white text-gray-700 ring-gray-200 hover:bg-gray-50"
              }`}
            >
              {option.name || option.title}
            </button>
          )
        })}

        {!options.length ? (
          <p className="px-2 py-4 text-sm font-medium text-gray-500">{emptyLabel}</p>
        ) : null}
      </div>
    </div>
  )
}

function StatusPill({ active }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-rose-50 text-rose-700"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  )
}

export default function LeaveSetup() {
  const [templates, setTemplates] = useState([])
  const [departments, setDepartments] = useState([])
  const [positions, setPositions] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(createEmptyForm)
  const [saving, setSaving] = useState(false)
  const [applyingId, setApplyingId] = useState("")

  const filteredPositions = useMemo(() => {
    if (!form.departments.length) return positions

    const selected = new Set(form.departments.map(String))

    return positions.filter((position) =>
      selected.has(String(position.department?._id || position.department))
    )
  }, [form.departments, positions])

  const load = async () => {
    setLoading(true)

    try {
      const [templateRes, departmentRes, positionRes] = await Promise.all([
        api("/leave-templates"),
        api("/access-control/departments"),
        api("/access-control/positions"),
      ])

      setTemplates(templateRes.templates || [])
      setDepartments(departmentRes.departments || [])
      setPositions(positionRes.positions || [])
    } catch (error) {
      toast.error(error?.message || "Failed to load leave setup")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm(createEmptyForm())
    setModalOpen(true)
  }

  const openEdit = (template) => {
    setEditing(template)

    setForm({
      ...createEmptyForm(),
      name: template.name || "",
      description: template.description || "",
      year: template.year || new Date().getFullYear(),
      paidDays: template.paidDays || 0,
      unpaidDays: template.unpaidDays || 0,
      unpaidCharge: {
        ...createEmptyForm().unpaidCharge,
        ...(template.unpaidCharge || {}),
      },
      departments: (template.departments || []).map((item) => item._id || item),
      positions: (template.positions || []).map((item) => item._id || item),
      isActive: template.isActive !== false,
    })

    setModalOpen(true)
  }

  const closeModal = () => {
    if (saving) return
    setModalOpen(false)
  }

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Template name is required")
      return
    }

    setSaving(true)

    const payload = {
      ...form,
      year: Number(form.year) || new Date().getFullYear(),
      paidDays: Number(form.paidDays) || 0,
      unpaidDays: Number(form.unpaidDays) || 0,
      unpaidCharge: {
        ...form.unpaidCharge,
        value: Number(form.unpaidCharge.value) || 0,
      },
    }

    try {
      const data = await api(editing?._id ? `/leave-templates/${editing._id}` : "/leave-templates", {
        method: editing?._id ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      })

      toast.success(data?.message || (editing ? "Leave template updated." : "Leave template created."))
      setModalOpen(false)
      await load()
    } catch (error) {
      toast.error(error?.message || "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (template) => {
    if (!window.confirm(`Delete ${template.name}?`)) return

    try {
      await api(`/leave-templates/${template._id}`, { method: "DELETE" })
      toast.success("Leave template deleted.")
      await load()
    } catch (error) {
      toast.error(error?.message || "Delete failed")
    }
  }

  const applyNow = async (template) => {
    if (!template?._id || applyingId) return
    setApplyingId(template._id)

    try {
      const data = await api(`/leave-templates/${template._id}/apply`, { method: "POST" })
      toast.success(data?.message || "Leave template applied.")
      await load()
    } catch (error) {
      toast.error(error?.message || "Apply failed")
    } finally {
      setApplyingId("")
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <Toaster position="top-right" />

      <div className="mx-auto max-w-7xl">
        <div className={`${card} mb-6 p-5 sm:p-6`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
                <FiCalendar className="h-5 w-5" />
              </div>

              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-gray-950 sm:text-2xl">
                  Leave Setup
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button className={`${btn} ${btnGhost}`} disabled={loading} onClick={load}>
                <FiRefreshCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>

              <button className={`${btn} ${btnPrimary}`} onClick={openCreate}>
                <FiPlus className="h-3.5 w-3.5" />
                Add Template
              </button>
            </div>
          </div>
        </div>

        <div className={`${card} overflow-hidden`}>
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-bold text-gray-950 sm:text-[15px]">
              Leave Templates
            </h2>
          </div>

          <div className="max-h-[68vh] overflow-auto">
            <table className="min-w-full text-left">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr className="border-b border-gray-100 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">
                  <th className="px-5 py-3.5">Template</th>
                  <th className="px-5 py-3.5">Entitlement</th>
                  <th className="px-5 py-3.5">Unpaid Charge</th>
                  <th className="px-5 py-3.5">Assigned To</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {templates.map((template) => (
                  <tr key={template._id} className="bg-white transition hover:bg-gray-50/60">
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-950">{template.name}</p>
                          <StatusPill active={template.isActive !== false} />
                        </div>

                        {template.description ? (
                          <p className="max-w-sm text-sm font-normal text-gray-500">
                            {template.description}
                          </p>
                        ) : null}

                        <p className="text-xs font-medium text-gray-400">{template.year}</p>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="space-y-1 text-sm font-medium text-gray-700">
                        <p>Paid: {template.paidDays || 0} days</p>
                        <p>Unpaid: {template.unpaidDays || 0} days</p>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-sm font-medium text-gray-700">
                      {template.unpaidCharge?.enabled === false
                        ? "Disabled"
                        : `${template.unpaidCharge?.calculationType || "per_day"} • ${
                            template.unpaidCharge?.value || 0
                          }`}
                    </td>

                    <td className="px-5 py-4 text-sm font-normal text-gray-600">
                      <div className="max-w-sm space-y-1">
                        <p>
                          <span className="font-semibold text-gray-800">Departments:</span>{" "}
                          {formatList(template.departments, "name")}
                        </p>
                        <p>
                          <span className="font-semibold text-gray-800">Positions:</span>{" "}
                          {formatList(template.positions, "title")}
                        </p>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          className={`${btn} ${btnPrimary}`}
                          disabled={applyingId === template._id || template.isActive === false}
                          onClick={() => applyNow(template)}
                          title={template.isActive === false ? "Activate the template before applying it." : "Apply this template to its assigned employees now."}
                        >
                          <FiCheckCircle className="h-3.5 w-3.5" />
                          {applyingId === template._id ? "Applying..." : "Apply"}
                        </button>

                        <button className={`${btn} ${btnGhost}`} onClick={() => openEdit(template)}>
                          <FiEdit3 className="h-3.5 w-3.5" />
                          Edit
                        </button>

                        <button className={`${btn} ${btnDanger}`} onClick={() => remove(template)}>
                          <FiTrash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!templates.length ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-14 text-center text-sm font-medium text-gray-500"
                    >
                      No leave templates found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {modalOpen ? (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-950/50 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={closeModal}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              onMouseDown={(event) => event.stopPropagation()}
              className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl ring-1 ring-white/20"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-5 py-4 sm:px-6">
                <h2 className="text-base font-bold text-gray-950 sm:text-lg">
                  {editing ? "Update Leave Template" : "Create Leave Template"}
                </h2>

                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-2xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
                  onClick={closeModal}
                  disabled={saving}
                  aria-label="Close modal"
                >
                  <FiX className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-auto px-5 py-5 sm:px-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className={label}>Template Name</label>
                    <input
                      className={input}
                      value={form.name}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, name: event.target.value }))
                      }
                      placeholder="Example: Annual Leave"
                    />
                  </div>

                  <div>
                    <label className={label}>Year</label>
                    <input
                      className={input}
                      type="number"
                      min="2000"
                      value={form.year}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, year: event.target.value }))
                      }
                    />
                  </div>

                  <div>
                    <label className={label}>Paid Leave Days</label>
                    <input
                      className={input}
                      type="number"
                      min="0"
                      value={form.paidDays}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, paidDays: event.target.value }))
                      }
                    />
                  </div>

                  <div>
                    <label className={label}>Unpaid Leave Days</label>
                    <input
                      className={input}
                      type="number"
                      min="0"
                      value={form.unpaidDays}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, unpaidDays: event.target.value }))
                      }
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className={label}>Description</label>
                    <input
                      className={input}
                      value={form.description}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, description: event.target.value }))
                      }
                      placeholder="Optional"
                    />
                  </div>

                  <div className="rounded-3xl border border-gray-100 bg-gray-50/80 p-4 md:col-span-2">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-gray-950">Unpaid Leave Charge</p>

                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <input
                          type="checkbox"
                          checked={form.unpaidCharge.enabled}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              unpaidCharge: {
                                ...prev.unpaidCharge,
                                enabled: event.target.checked,
                              },
                            }))
                          }
                        />
                        Enabled
                      </label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <select
                        className={input}
                        value={form.unpaidCharge.calculationType}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            unpaidCharge: {
                              ...prev.unpaidCharge,
                              calculationType: event.target.value,
                            },
                          }))
                        }
                      >
                        <option value="per_day">Per Day</option>
                        <option value="fixed">Fixed Amount</option>
                        <option value="percentage">Percentage</option>
                      </select>

                      <input
                        className={input}
                        type="number"
                        min="0"
                        value={form.unpaidCharge.value}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            unpaidCharge: {
                              ...prev.unpaidCharge,
                              value: event.target.value,
                            },
                          }))
                        }
                        placeholder="Value"
                      />

                      <select
                        className={input}
                        value={form.unpaidCharge.basedOn}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            unpaidCharge: {
                              ...prev.unpaidCharge,
                              basedOn: event.target.value,
                            },
                          }))
                        }
                      >
                        <option value="basicSalary">Basic Salary</option>
                        <option value="grossSalary">Gross Salary</option>
                        <option value="manual">Manual</option>
                      </select>
                    </div>
                  </div>

                  <MultiSelect
                    label="Assign Departments"
                    value={form.departments}
                    options={departments}
                    onChange={(departments) =>
                      setForm((prev) => ({ ...prev, departments, positions: [] }))
                    }
                    emptyLabel="No departments found"
                  />

                  <MultiSelect
                    label="Assign Positions"
                    value={form.positions}
                    options={filteredPositions}
                    onChange={(positions) => setForm((prev) => ({ ...prev, positions }))}
                    emptyLabel="No positions found"
                  />

                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, isActive: event.target.checked }))
                      }
                    />
                    Active template
                  </label>
                </div>
              </div>

              <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                <button className={`${btn} ${btnGhost}`} onClick={closeModal} disabled={saving}>
                  Cancel
                </button>

                <button className={`${btn} ${btnPrimary}`} onClick={save} disabled={saving}>
                  {saving ? "Saving..." : "Save Template"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
