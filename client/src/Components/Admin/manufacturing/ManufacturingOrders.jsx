"use client"
import { FiClipboard, FiPlay, FiXCircle } from "react-icons/fi"
import ManufacturingResourcePage from "./ManufacturingResourcePage"

export default function ManufacturingOrders() {
  return <ManufacturingResourcePage title="Manufacturing Orders" subtitle="Create, release, monitor, and complete production orders from approved BOMs and routings." endpoint="/manufacturing/orders" icon={<FiClipboard />} viewPermission="manufacturing-order:view" managePermission="manufacturing-order:manage" deletePermission="manufacturing-order:delete" createLabel="New Manufacturing Order" statusOptions={["draft", "planned", "released", "in_progress", "paused", "quality_hold", "completed", "cancelled"]}
    columns={[{ key: "moNumber", label: "MO No." }, { key: "product", label: "Product", type: "relation" }, { key: "quantity", label: "Planned Qty", type: "number" }, { key: "completedQuantity", label: "Completed", type: "number" }, { key: "materialStatus", label: "Material", type: "status" }, { key: "qualityStatus", label: "Quality", type: "status" }, { key: "status", label: "Status", type: "status" }, { key: "plannedEnd", label: "Due", type: "date" }]}
    formFields={[
      { name: "product", label: "Product", type: "relation", endpoint: "/inventory/products?limit=100&status=active" }, { name: "quantity", label: "Quantity", type: "number", min: 0.000001, defaultValue: 1 },
      { name: "bom", label: "BOM (optional)", type: "relation", endpoint: "/manufacturing/bom?limit=100&status=active", labelKey: "bomNumber" }, { name: "routing", label: "Routing (optional)", type: "relation", endpoint: "/manufacturing/routing?limit=100&status=active", labelKey: "routeNumber" },
      { name: "rawMaterialWarehouse", label: "Raw Material Warehouse", type: "relation", endpoint: "/inventory/warehouses?limit=100&status=active" }, { name: "finishedGoodsWarehouse", label: "Finished Goods Warehouse", type: "relation", endpoint: "/inventory/warehouses?limit=100&status=active" },
      { name: "plannedStart", label: "Planned Start", type: "datetime-local" }, { name: "plannedEnd", label: "Planned End", type: "datetime-local" },
      { name: "priority", label: "Priority", type: "select", defaultValue: "normal", options: ["low", "normal", "high", "urgent"] }, { name: "notes", label: "Notes", type: "textarea", full: true },
    ]}
    actions={[
      { label: "Release", permission: "manufacturing-order:release", path: "release", when: (row) => ["draft", "planned"].includes(row.status), success: "Manufacturing order released", icon: <FiPlay /> },
      { label: "Cancel", permission: "manufacturing-order:manage", path: "cancel", when: (row) => !["completed", "cancelled"].includes(row.status), success: "Manufacturing order cancelled", icon: <FiXCircle /> },
    ]} />
}
