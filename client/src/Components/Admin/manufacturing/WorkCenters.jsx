"use client"
import { FiGrid } from "react-icons/fi"
import ManufacturingResourcePage from "./ManufacturingResourcePage"

export default function WorkCenters() {
  return <ManufacturingResourcePage title="Work Centers" subtitle="Maintain production stations, daily capacity, labor rates, and overhead rates." endpoint="/manufacturing/work-centers" icon={<FiGrid />} viewPermission="manufacturing-work-center:view" managePermission="manufacturing-work-center:manage" deletePermission="manufacturing-work-center:delete" createLabel="New Work Center" statusOptions={["active", "inactive"]}
    columns={[{ key: "code", label: "Code" }, { key: "name", label: "Work Center" }, { key: "type", label: "Type" }, { key: "capacityPerHour", label: "Capacity / Hr", type: "number" }, { key: "hoursPerDay", label: "Hours / Day", type: "number" }, { key: "status", label: "Status", type: "status" }]}
    formFields={[
      { name: "code", label: "Code", type: "text" }, { name: "name", label: "Name", type: "text" },
      { name: "type", label: "Type", type: "select", defaultValue: "internal", options: ["internal", "subcontract"] },
      { name: "warehouse", label: "Warehouse", type: "relation", endpoint: "/inventory/warehouses?limit=100&status=active" },
      { name: "capacityPerHour", label: "Capacity / Hour", type: "number", min: 0, defaultValue: 0 }, { name: "hoursPerDay", label: "Hours / Day", type: "number", min: 0, max: 24, defaultValue: 8 },
      { name: "laborRatePerHour", label: "Labor Rate / Hour", type: "number", min: 0, defaultValue: 0 }, { name: "overheadRatePerHour", label: "Overhead / Hour", type: "number", min: 0, defaultValue: 0 },
      { name: "status", label: "Status", type: "select", defaultValue: "active", options: ["active", "inactive"] }, { name: "notes", label: "Notes", type: "textarea", full: true },
    ]} />
}
