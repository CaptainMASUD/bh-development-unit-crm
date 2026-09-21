"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import toast, { Toaster } from "react-hot-toast";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Delete01Icon,
  Edit02Icon,
  Folder01Icon,
  HierarchySquare01Icon,
  RefreshIcon,
  SearchIcon,
  UnavailableIcon,
  ArrowDown01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";

const API_BASE = `${import.meta.env.VITE_API_URL}/api`;

const shell = "min-h-screen bg-gradient-to-b from-gray-50 to-white";
const card =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_35px_-28px_rgba(15,23,42,0.55)]";
const input =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm font-semibold text-gray-800 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500";
const button =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60";
const buttonPrimary =
  "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-700";
const buttonGhost =
  "border border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50";
const buttonDanger =
  "border border-rose-200 bg-white text-rose-700 hover:border-rose-300 hover:bg-rose-50";

function headers() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data?.message || data?.error || "Request failed");
    error.statusCode = res.status;
    error.code = data?.code;
    throw error;
  }
  return data;
}

const EMPTY_FORM = {
  code: "",
  name: "",
  parentCostCenter: "",
  isGroup: false,
  isActive: true,
  description: "",
};

export default function CostCenters() {
  const [costCenters, setCostCenters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [viewMode, setViewMode] = useState("tree"); // "tree" | "list"
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadCostCenters = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api("/accounting/cost-centers");
      setCostCenters(data.costCenters || []);
      // Expand root groups by default
      const initialExpanded = new Set();
      (data.costCenters || []).forEach((cc) => {
        if (cc.isGroup) initialExpanded.add(String(cc._id));
      });
      setExpandedNodes(initialExpanded);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCostCenters();
  }, [loadCostCenters]);

  // Metrics
  const metrics = useMemo(() => {
    const total = costCenters.length;
    const groups = costCenters.filter((c) => c.isGroup).length;
    const leaves = costCenters.filter((c) => !c.isGroup).length;
    const active = costCenters.filter((c) => c.isActive).length;
    return { total, groups, leaves, active };
  }, [costCenters]);

  // Filtered flat list
  const filteredList = useMemo(() => {
    return costCenters.filter((cc) => {
      if (activeFilter === "active" && !cc.isActive) return false;
      if (activeFilter === "inactive" && cc.isActive) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          cc.code.toLowerCase().includes(q) ||
          cc.name.toLowerCase().includes(q) ||
          (cc.description || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [activeFilter, costCenters, search]);

  // Hierarchical Tree
  const treeNodes = useMemo(() => {
    const map = new Map();
    costCenters.forEach((cc) => {
      map.set(String(cc._id), { ...cc, children: [] });
    });

    const roots = [];
    costCenters.forEach((cc) => {
      const node = map.get(String(cc._id));
      if (cc.parentCostCenter && map.has(String(cc.parentCostCenter?._id || cc.parentCostCenter))) {
        const parentId = String(cc.parentCostCenter?._id || cc.parentCostCenter);
        map.get(parentId).children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }, [costCenters]);

  const toggleExpand = (id) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openCreateModal = (parentId = null) => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      parentCostCenter: parentId ? String(parentId) : "",
    });
    setModalOpen(true);
  };

  const openEditModal = (cc) => {
    setEditingId(cc._id);
    setForm({
      code: cc.code || "",
      name: cc.name || "",
      parentCostCenter: cc.parentCostCenter?._id || cc.parentCostCenter || "",
      isGroup: Boolean(cc.isGroup),
      isActive: cc.isActive !== undefined ? Boolean(cc.isActive) : true,
      description: cc.description || "",
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      return toast.error("Code and Name are required.");
    }

    setSaving(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        parentCostCenter: form.parentCostCenter || null,
        isGroup: Boolean(form.isGroup),
        isActive: Boolean(form.isActive),
        description: form.description.trim(),
      };

      if (editingId) {
        await api(`/accounting/cost-centers/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Cost center updated successfully");
      } else {
        await api("/accounting/cost-centers", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Cost center created successfully");
      }

      setModalOpen(false);
      loadCostCenters();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/accounting/cost-centers/${deleteTarget._id}`, {
        method: "DELETE",
      });
      toast.success("Cost center deleted successfully");
      setDeleteTarget(null);
      loadCostCenters();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDeleting(false);
    }
  };

  // Helper for available parents in modal: exclude self and self descendants
  const eligibleParents = useMemo(() => {
    if (!editingId) return costCenters;

    const descendantIds = new Set([String(editingId)]);
    let added = true;
    while (added) {
      added = false;
      costCenters.forEach((cc) => {
        const parentId = String(cc.parentCostCenter?._id || cc.parentCostCenter || "");
        if (descendantIds.has(parentId) && !descendantIds.has(String(cc._id))) {
          descendantIds.add(String(cc._id));
          added = true;
        }
      });
    }

    return costCenters.filter((cc) => !descendantIds.has(String(cc._id)));
  }, [costCenters, editingId]);

  // Recursive tree row renderer
  const renderTreeRow = (node, depth = 0) => {
    const isExpanded = expandedNodes.has(String(node._id));
    const hasChildren = node.children && node.children.length > 0;

    // Search filter check for tree: show node if it matches or any child matches
    if (search.trim()) {
      const q = search.toLowerCase();
      const nodeMatches =
        node.code.toLowerCase().includes(q) ||
        node.name.toLowerCase().includes(q) ||
        (node.description || "").toLowerCase().includes(q);

      const hasMatchingChild = (n) =>
        (n.children || []).some(
          (c) =>
            c.code.toLowerCase().includes(q) ||
            c.name.toLowerCase().includes(q) ||
            hasMatchingChild(c)
        );

      if (!nodeMatches && !hasMatchingChild(node)) {
        return null;
      }
    }

    return (
      <div key={node._id} className="border-b border-gray-100 last:border-0">
        <div
          className="flex items-center justify-between py-3 px-4 hover:bg-gray-50/70 transition"
          style={{ paddingLeft: `${Math.max(16, depth * 28 + 16)}px` }}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {node.isGroup ? (
              <button
                type="button"
                onClick={() => toggleExpand(String(node._id))}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-500 hover:bg-gray-200 transition"
                aria-label={isExpanded ? "Collapse" : "Expand"}
              >
                <HugeiconsIcon
                  icon={isExpanded ? ArrowDown01Icon : ArrowRight01Icon}
                  size={16}
                />
              </button>
            ) : (
              <span className="w-6" />
            )}

            <div className="flex items-center gap-2 min-w-0">
              <HugeiconsIcon
                icon={node.isGroup ? Folder01Icon : HierarchySquare01Icon}
                size={18}
                className={node.isGroup ? "text-indigo-600" : "text-emerald-600"}
              />
              <span className="font-mono text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                {node.code}
              </span>
              <span className="font-bold text-sm text-gray-900 truncate">
                {node.name}
              </span>
              {node.description && (
                <span className="text-xs text-gray-400 hidden sm:inline truncate max-w-xs">
                  — {node.description}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {node.isGroup ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
                Group ({node.children?.length || 0})
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                Postable
              </span>
            )}

            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                node.isActive
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {node.isActive ? "Active" : "Inactive"}
            </span>

            <div className="flex items-center gap-1 ml-2">
              <button
                type="button"
                onClick={() => openCreateModal(node._id)}
                title="Add Child Cost Center"
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-indigo-600 transition"
              >
                <HugeiconsIcon icon={Add01Icon} size={16} />
              </button>
              <button
                type="button"
                onClick={() => openEditModal(node)}
                title="Edit Cost Center"
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-indigo-600 transition"
              >
                <HugeiconsIcon icon={Edit02Icon} size={16} />
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(node)}
                title="Delete Cost Center"
                className="p-1.5 rounded-lg text-gray-500 hover:bg-rose-50 hover:text-rose-600 transition"
              >
                <HugeiconsIcon icon={Delete01Icon} size={16} />
              </button>
            </div>
          </div>
        </div>

        {node.isGroup &&
          isExpanded &&
          hasChildren &&
          node.children.map((child) => renderTreeRow(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className={`${shell} p-4 sm:p-6 lg:p-8`}>
      <Toaster position="top-right" />

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <HugeiconsIcon icon={HierarchySquare01Icon} size={28} className="text-indigo-600" />
            Cost Centers
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Organize hierarchical cost centers for operational department allocation and financial reporting
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadCostCenters}
            disabled={loading}
            className={`${button} ${buttonGhost}`}
          >
            <HugeiconsIcon icon={RefreshIcon} size={18} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => openCreateModal()}
            className={`${button} ${buttonPrimary}`}
          >
            <HugeiconsIcon icon={Add01Icon} size={18} />
            New Cost Center
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className={`${card} p-4`}>
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total</div>
          <div className="mt-1 text-2xl font-black text-gray-900">{metrics.total}</div>
        </div>
        <div className={`${card} p-4`}>
          <div className="text-xs font-semibold uppercase tracking-wider text-indigo-500">Groups</div>
          <div className="mt-1 text-2xl font-black text-indigo-600">{metrics.groups}</div>
        </div>
        <div className={`${card} p-4`}>
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-500">Leaf (Postable)</div>
          <div className="mt-1 text-2xl font-black text-emerald-600">{metrics.leaves}</div>
        </div>
        <div className={`${card} p-4`}>
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Active</div>
          <div className="mt-1 text-2xl font-black text-gray-800">{metrics.active}</div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className={`${card} p-4 mb-6`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <HugeiconsIcon
              icon={SearchIcon}
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search by code, name, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${input} pl-10`}
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none focus:border-indigo-300"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>

            <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
              <button
                type="button"
                onClick={() => setViewMode("tree")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  viewMode === "tree"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Tree View
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  viewMode === "list"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Flat List
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`${card} overflow-hidden`}>
        {loading && costCenters.length === 0 ? (
          <div className="py-16 text-center text-sm font-semibold text-gray-400">
            Loading cost centers...
          </div>
        ) : costCenters.length === 0 ? (
          <div className="py-16 text-center">
            <HugeiconsIcon icon={HierarchySquare01Icon} size={40} className="mx-auto text-gray-300 mb-3" />
            <h3 className="text-base font-bold text-gray-800">No Cost Centers Configured</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
              Cost centers allow you to track revenues, direct expenses, and overhead by department or project.
            </p>
            <button
              type="button"
              onClick={() => openCreateModal()}
              className={`${button} ${buttonPrimary} mt-4`}
            >
              <HugeiconsIcon icon={Add01Icon} size={18} />
              Create First Cost Center
            </button>
          </div>
        ) : viewMode === "tree" ? (
          <div className="divide-y divide-gray-100">
            {treeNodes.map((node) => renderTreeRow(node))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Code</th>
                  <th className="py-3.5 px-4">Name</th>
                  <th className="py-3.5 px-4">Parent Cost Center</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm font-semibold text-gray-700">
                {filteredList.map((cc) => (
                  <tr key={cc._id} className="hover:bg-gray-50/70 transition">
                    <td className="py-3.5 px-4 font-mono text-xs font-bold text-indigo-600">
                      {cc.code}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-gray-900">{cc.name}</td>
                    <td className="py-3.5 px-4 text-gray-500">
                      {cc.parentCostCenter
                        ? `${cc.parentCostCenter.code} - ${cc.parentCostCenter.name}`
                        : "— (Root)"}
                    </td>
                    <td className="py-3.5 px-4">
                      {cc.isGroup ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
                          Group
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                          Postable
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                          cc.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {cc.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(cc)}
                          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-indigo-600 transition"
                        >
                          <HugeiconsIcon icon={Edit02Icon} size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(cc)}
                          className="p-1.5 rounded-lg text-gray-500 hover:bg-rose-50 hover:text-rose-600 transition"
                        >
                          <HugeiconsIcon icon={Delete01Icon} size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modalOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className={`${card} w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-150`}>
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                  <HugeiconsIcon icon={HierarchySquare01Icon} size={22} className="text-indigo-600" />
                  {editingId ? "Edit Cost Center" : "New Cost Center"}
                </h3>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={20} />
                </button>
              </div>

              <form onSubmit={handleSave} className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Code *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CC-CORP"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                      className={input}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Corporate HQ"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className={input}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Parent Cost Center (Optional)
                  </label>
                  <select
                    value={form.parentCostCenter}
                    onChange={(e) => setForm({ ...form, parentCostCenter: e.target.value })}
                    className={input}
                  >
                    <option value="">— None (Top Level Root) —</option>
                    {eligibleParents.map((parent) => (
                      <option key={parent._id} value={parent._id}>
                        {parent.code} - {parent.name} {parent.isGroup ? "(Group)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Optional notes or responsibility scope..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm font-semibold text-gray-800 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
                  />
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isGroup}
                      onChange={(e) => setForm({ ...form, isGroup: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-sm font-bold text-gray-800">Is Group Cost Center</span>
                      <p className="text-xs text-gray-500">
                        Groups organize sub-cost centers. Only leaf cost centers can receive transaction postings.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-sm font-bold text-gray-800">Is Active</span>
                      <p className="text-xs text-gray-500">
                        Inactive cost centers are hidden from transaction entry selectors.
                      </p>
                    </div>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className={`${button} ${buttonGhost}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className={`${button} ${buttonPrimary}`}
                  >
                    {saving ? "Saving..." : editingId ? "Update Cost Center" : "Create Cost Center"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Delete Confirmation Modal */}
      {deleteTarget &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className={`${card} w-full max-w-md p-6`}>
              <h3 className="text-lg font-black text-rose-600 flex items-center gap-2">
                <HugeiconsIcon icon={Delete01Icon} size={22} />
                Delete Cost Center
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Are you sure you want to delete cost center{" "}
                <span className="font-bold text-gray-900">
                  {deleteTarget.code} - {deleteTarget.name}
                </span>
                ?
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Note: Cost centers with active sub-cost centers or existing financial postings cannot be deleted and should be deactivated instead.
              </p>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className={`${button} ${buttonGhost}`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className={`${button} ${buttonDanger}`}
                >
                  {deleting ? "Deleting..." : "Delete Permanently"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
