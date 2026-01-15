"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import axios from "axios"
import { motion, AnimatePresence } from "framer-motion"
import { Button, Modal, TextInput, Select, Table, Tooltip, Toast, Spinner, Checkbox } from "flowbite-react"
import {
  FiSliders,
  FiRefreshCw,
  FiSearch,
  FiEye,
  FiEyeOff,
  FiChevronDown,
  FiChevronUp,
  FiCheck,
  FiX,
  FiAlertTriangle,
  FiUploadCloud,
  FiSettings,
} from "react-icons/fi"

const API_BASE = "http://localhost:4000"

export default function AdminFeatures() {
  const [data, setData] = useState([])              // flat list from /api/features?flat=true
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState("")
  const [role, setRole] = useState("")
  const [expanded, setExpanded] = useState({})      // { sectionKey: bool }
  const [toasts, setToasts] = useState([])
  const [showSeed, setShowSeed] = useState(false)
  const [bulk, setBulk] = useState({ keys: new Set(), action: "" })

  const mounted = useRef(false)

  const fetchFlat = async ({ withRole } = {}) => {
    setLoading(true)
    try {
      const url = new URL(`${API_BASE}/api/features`)
      url.searchParams.set("flat", "true")
      if (withRole) url.searchParams.set("role", withRole)
      const { data } = await axios.get(url.toString(), { headers: { "Cache-Control": "no-cache" } })
      setData(Array.isArray(data) ? data : [])
    } catch (e) {
      toast("Failed to load features", "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    mounted.current = true
    fetchFlat({ withRole: role || undefined })
    return () => { mounted.current = false }
  }, [role])

  const grouped = useMemo(() => {
    const secs = data.filter((d) => d.type === "section").sort((a,b)=>a.order-b.order)
    const items = data.filter((d) => d.type === "item").sort((a,b)=>a.order-b.order)
    const byParent = items.reduce((m, it) => {
      if (!m[it.parentKey]) m[it.parentKey] = []
      m[it.parentKey].push(it)
      return m
    }, {})
    return secs.map((s) => ({ section: s, items: byParent[s.key] || [] }))
  }, [data])

  const filtered = useMemo(() => {
    if (!query.trim()) return grouped
    const q = query.toLowerCase()
    return grouped
      .map(({ section, items }) => ({ section, items: items.filter((i) => (i.label||i.key).toLowerCase().includes(q)) }))
      .filter(({ section, items }) => (section.label||section.key).toLowerCase().includes(q) || items.length)
  }, [grouped, query])

  const toggleExpand = (k) => setExpanded((m) => ({ ...m, [k]: !m[k] }))

  const optimisticToggle = async (key, visible) => {
    const prev = data
    setData((arr) => arr.map((r) => (r.key === key ? { ...r, visible } : r)))
    try {
      await axios.patch(`${API_BASE}/api/features/${encodeURIComponent(key)}/visibility`, { visible })
      toast(`${visible ? "Shown" : "Hidden"}: ${key}`, "success")
    } catch (e) {
      setData(prev)
      toast("Save failed — reverted", "error")
    }
  }

  const doBulk = async (action) => {
    const keys = Array.from(bulk.keys)
    if (!keys.length) return toast("Select at least one item", "warning")
    const visible = action === "show"
    setSaving(true)
    const prev = data
    setData((arr) => arr.map((r) => (bulk.keys.has(r.key) ? { ...r, visible } : r)))
    try {
      await axios.patch(`${API_BASE}/api/features/visibility/bulk`, keys.map((k) => ({ key: k, visible })))
      toast(`Bulk ${visible ? "show" : "hide"} applied to ${keys.length} items`, "success")
      setBulk({ keys: new Set(), action: "" })
    } catch (e) {
      setData(prev)
      toast("Bulk update failed — reverted", "error")
    } finally {
      setSaving(false)
    }
  }

  const seedDefaults = async () => {
    setSaving(true)
    try {
      await axios.post(`${API_BASE}/api/features/seed-defaults`)
      toast("Seeded defaults", "success")
      fetchFlat({ withRole: role || undefined })
    } catch (e) {
      toast("Seed failed", "error")
    } finally {
      setSaving(false); setShowSeed(false)
    }
  }

  const toggleSelect = (key) => setBulk((b) => {
    const set = new Set(b.keys)
    if (set.has(key)) set.delete(key); else set.add(key)
    return { ...b, keys: set }
  })

  const allSelectableKeys = useMemo(() => data.filter((d)=>d.type==="item").map((d)=>d.key), [data])
  const toggleSelectAll = (checked) => setBulk({ keys: new Set(checked ? allSelectableKeys : []), action: bulk.action })

  const toast = (message, type = "success") => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600)
  }

  return (
    <div className="min-h-screen bg-gray-50/60 p-4 sm:p-6 lg:p-8">
      {/* top progress line */}
      <div className={`fixed left-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-300 ${loading || saving ? "w-full opacity-100" : "w-0 opacity-0"}`} style={{ zIndex: 40 }} />

      {/* header */}
      <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-6 bg-white rounded-2xl border border-gray-100 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500/30 rounded-xl blur-lg" />
              <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-lg">
                <FiSliders className="w-6 h-6" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Feature Visibility (Admin)</h1>
              <p className="text-sm text-gray-500">Show or hide sidebar sections and items. Backed by MongoDB.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip content="Refresh">
              <Button color="light" onClick={() => fetchFlat({ withRole: role || undefined })}>
                <FiRefreshCw className="w-4 h-4" />
              </Button>
            </Tooltip>
            <Button color="light" onClick={() => setShowSeed(true)}><FiUploadCloud className="w-4 h-4" /> Seed defaults</Button>
          </div>
        </div>
      </motion.div>

      {/* toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search sections or items…" className="pl-10" />
        </div>
        <div className="md:col-span-2 flex flex-wrap items-center gap-2 justify-end">
          <Select value={role} onChange={(e) => setRole(e.target.value)} className="w-44">
            <option value="">All roles</option>
            <option value="owner">Owner</option>
            <option value="manager">Manager</option>
            <option value="staff">Staff</option>
          </Select>

          <div className="hidden md:flex items-center gap-2">
            <Checkbox checked={bulk.keys.size === allSelectableKeys.length && allSelectableKeys.length>0} onChange={(e) => toggleSelectAll(e.target.checked)} />
            <span className="text-sm text-gray-600">Select all items</span>
          </div>
          <Button color="light" onClick={() => doBulk("show")} disabled={saving || bulk.keys.size===0}><FiEye /> Show</Button>
          <Button color="light" onClick={() => doBulk("hide")} disabled={saving || bulk.keys.size===0}><FiEyeOff /> Hide</Button>
        </div>
      </div>

      {/* table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-lg overflow-hidden">
        <Table hoverable>
          <Table.Head>
            <Table.HeadCell className="w-10"></Table.HeadCell>
            <Table.HeadCell>Section / Item</Table.HeadCell>
            <Table.HeadCell className="hidden sm:table-cell">Key</Table.HeadCell>
            <Table.HeadCell className="hidden md:table-cell text-center">Order</Table.HeadCell>
            <Table.HeadCell className="text-center">Visible</Table.HeadCell>
            <Table.HeadCell className="text-right">Select</Table.HeadCell>
          </Table.Head>
          <Table.Body className="divide-y">
            {loading ? (
              <tr><td colSpan={6} className="p-6 text-center text-gray-500"><Spinner /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-gray-500">No features</td></tr>
            ) : (
              filtered.map(({ section, items }) => (
                <SectionRow
                  key={section.key}
                  section={section}
                  items={items}
                  expanded={!!expanded[section.key]}
                  onToggleExpand={() => toggleExpand(section.key)}
                  onToggleVisible={(v)=>optimisticToggle(section.key,v)}
                  onToggleSelect={toggleSelect}
                  selectedSet={bulk.keys}
                  onToggleItemVisible={optimisticToggle}
                />
              ))
            )}
          </Table.Body>
        </Table>
      </div>

      {/* seed modal */}
      <Modal show={showSeed} onClose={() => setShowSeed(false)}>
        <Modal.Header>Seed default features?</Modal.Header>
        <Modal.Body>
          <p className="text-sm text-gray-700">This will upsert the known sections/items into the database. Existing records will be kept and updated.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowSeed(false)}>Cancel</Button>
          <Button onClick={seedDefaults}>
            {saving ? <span className="inline-flex items-center gap-2"><Spinner size="sm"/> Seeding…</span> : "Seed now"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* toasts */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <Toast>
                <div className={`p-2 rounded-lg ${t.type === "error" ? "bg-red-100 text-red-700" : t.type === "warning" ? "bg-yellow-100 text-yellow-800" : "bg-emerald-100 text-emerald-700"}`}>
                  {t.type === "error" ? <FiAlertTriangle /> : t.type === "warning" ? <FiAlertTriangle /> : <FiCheck />}
                </div>
                <div className="text-sm font-medium text-gray-900 ml-2 mr-2">{t.message}</div>
                <button className="text-gray-400 hover:text-gray-600" onClick={() => setToasts((arr)=>arr.filter((x)=>x.id!==t.id))}><FiX/></button>
              </Toast>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* -------------------------- subcomponents -------------------------- */
function SectionRow({ section, items, expanded, onToggleExpand, onToggleVisible, onToggleSelect, selectedSet, onToggleItemVisible }) {
  return (
    <>
      <Table.Row className="bg-white">
        <Table.Cell className="align-top">
          <button onClick={onToggleExpand} className="p-1 rounded hover:bg-gray-50">
            {expanded ? <FiChevronUp /> : <FiChevronDown />}
          </button>
        </Table.Cell>
        <Table.Cell>
          <div className="font-semibold text-gray-900">{section.label || section.key}</div>
          <div className="text-xs text-gray-500">Section</div>
        </Table.Cell>
        <Table.Cell className="hidden sm:table-cell align-top"><code className="text-xs text-gray-500">{section.key}</code></Table.Cell>
        <Table.Cell className="hidden md:table-cell text-center align-top">{section.order}</Table.Cell>
        <Table.Cell className="text-center align-top">
          <Switch visible={!!section.visible} onChange={(v) => onToggleVisible(section.key, v)} />
        </Table.Cell>
        <Table.Cell className="text-right align-top">
          {/* Section row not selectable for bulk to avoid mass mistakes */}
        </Table.Cell>
      </Table.Row>

      {expanded && items.map((it) => (
        <Table.Row key={it.key} className="bg-gray-50/60">
          <Table.Cell></Table.Cell>
          <Table.Cell>
            <div className="text-gray-900">{it.label || it.key}</div>
            <div className="text-xs text-gray-500">Item in <span className="font-medium">{section.label || section.key}</span></div>
          </Table.Cell>
          <Table.Cell className="hidden sm:table-cell"><code className="text-xs text-gray-500">{it.key}</code></Table.Cell>
          <Table.Cell className="hidden md:table-cell text-center">{it.order}</Table.Cell>
          <Table.Cell className="text-center"><Switch visible={!!it.visible} onChange={(v) => onToggleItemVisible(it.key, v)} /></Table.Cell>
          <Table.Cell className="text-right">
            <Checkbox checked={selectedSet.has(it.key)} onChange={() => onToggleSelect(it.key)} />
          </Table.Cell>
        </Table.Row>
      ))}
    </>
  )
}

function Switch({ visible, onChange }) {
  return (
    <button
      onClick={() => onChange(!visible)}
      className={`inline-flex items-center h-6 w-11 rounded-full transition ${visible ? "bg-emerald-500" : "bg-gray-300"}`}
      aria-label="toggle visible"
    >
      <span className={`h-5 w-5 bg-white rounded-full shadow transform transition ${visible ? "translate-x-5" : "translate-x-1"}`} />
    </button>
  )
}
