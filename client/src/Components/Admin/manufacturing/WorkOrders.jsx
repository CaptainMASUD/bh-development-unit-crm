"use client"
import { FiPause, FiPlay, FiSquare } from "react-icons/fi"
import ManufacturingResourcePage from "./ManufacturingResourcePage"

export default function WorkOrders() {
  return <ManufacturingResourcePage title="Work Orders / Shop Floor" subtitle="Run routing operations on the shop floor and record completion, rejection, labor, machine time, and downtime." endpoint="/manufacturing/work-orders" icon={<FiPlay />} viewPermission="manufacturing-work-order:view" managePermission="manufacturing-work-order:manage" readOnly statusOptions={["pending", "ready", "in_progress", "paused", "quality_hold", "completed", "cancelled"]}
    columns={[{ key: "woNumber", label: "WO No." }, { key: "operationName", label: "Operation" }, { key: "manufacturingOrder", label: "Manufacturing Order", type: "relation" }, { key: "workCenter", label: "Work Center", type: "relation" }, { key: "plannedQuantity", label: "Planned", type: "number" }, { key: "completedQuantity", label: "Completed", type: "number" }, { key: "downtimeMinutes", label: "Downtime", render: (row) => `${row.downtimeMinutes || 0} min` }, { key: "status", label: "Status", type: "status" }]}
    actions={[
      { label: "Start", permission: "manufacturing-work-order:execute", path: "start", when: (row) => ["pending", "ready", "paused"].includes(row.status), success: "Work order started", icon: <FiPlay /> },
      { label: "Pause", permission: "manufacturing-work-order:execute", path: "pause", when: (row) => row.status === "in_progress", success: "Work order paused", icon: <FiPause /> },
      { label: "Complete", permission: "manufacturing-work-order:execute", path: "complete", when: (row) => ["in_progress", "paused", "ready"].includes(row.status), success: "Work order completed", icon: <FiSquare />, defaults: (row) => ({ completedQuantity: row.plannedQuantity || row.completedQuantity || 0, rejectedQuantity: row.rejectedQuantity || 0, laborMinutes: 0, machineMinutes: 0, downtimeMinutes: 0 }), fields: [
        { name: "completedQuantity", label: "Completed Quantity", type: "number", min: 0 }, { name: "rejectedQuantity", label: "Rejected Quantity", type: "number", min: 0 }, { name: "laborMinutes", label: "Labor Minutes", type: "number", min: 0 }, { name: "machineMinutes", label: "Machine Minutes", type: "number", min: 0 }, { name: "downtimeMinutes", label: "Downtime Minutes", type: "number", min: 0 },
      ] },
    ]} />
}
