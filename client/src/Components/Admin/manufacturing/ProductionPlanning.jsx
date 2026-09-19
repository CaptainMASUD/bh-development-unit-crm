"use client"
import { FiCalendar } from "react-icons/fi"
import ManufacturingResourcePage from "./ManufacturingResourcePage"

export default function ProductionPlanning() {
  return <ManufacturingResourcePage title="Production Planning" subtitle="Plan demand, production quantities, priorities, required dates, and finished-goods destinations." endpoint="/manufacturing/plans" icon={<FiCalendar />} viewPermission="manufacturing-plan:view" managePermission="manufacturing-plan:manage" deletePermission="manufacturing-plan:delete" createLabel="New Production Plan" statusOptions={["draft", "approved", "mrp_run", "released", "completed", "cancelled"]}
    columns={[{ key: "planNumber", label: "Plan No." }, { key: "name", label: "Plan" }, { key: "planningDate", label: "Planning Date", type: "date" }, { key: "lines", label: "Products", render: (row) => `${row.lines?.length || 0} lines` }, { key: "status", label: "Status", type: "status" }, { key: "periodEnd", label: "Period End", type: "date" }]}
    formFields={[
      { name: "name", label: "Plan Name", type: "text" }, { name: "planningDate", label: "Planning Date", type: "date" }, { name: "periodStart", label: "Period Start", type: "date" }, { name: "periodEnd", label: "Period End", type: "date" },
      { name: "notes", label: "Notes", type: "textarea", full: true },
      { name: "lines", label: "Plan Lines", type: "array", full: true, itemLabel: "Product", fields: [
        { name: "product", label: "Product", type: "relation", endpoint: "/inventory/products?limit=100&status=active" },
        { name: "sourceType", label: "Demand Source", type: "select", defaultValue: "manual", options: ["manual", "sales_order", "forecast", "reorder"] },
        { name: "demandQuantity", label: "Demand Qty", type: "number", min: 0, defaultValue: 0 }, { name: "availableQuantity", label: "Available Qty", type: "number", defaultValue: 0 },
        { name: "safetyStock", label: "Safety Stock", type: "number", min: 0, defaultValue: 0 }, { name: "plannedQuantity", label: "Planned Qty", type: "number", min: 0.000001, defaultValue: 1 },
        { name: "finishedGoodsWarehouse", label: "FG Warehouse", type: "relation", endpoint: "/inventory/warehouses?limit=100&status=active" },
        { name: "requiredDate", label: "Required Date", type: "date" }, { name: "priority", label: "Priority", type: "select", defaultValue: "normal", options: ["low", "normal", "high", "urgent"] },
      ]},
    ]}
    actions={[{ label: "Approve Plan", permission: "manufacturing-plan:approve", path: "approve", when: (row) => row.status === "draft", success: "Production plan approved" }]} />
}
