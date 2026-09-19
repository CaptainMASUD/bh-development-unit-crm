"use client"
import { FiCpu } from "react-icons/fi"
import ManufacturingResourcePage from "./ManufacturingResourcePage"

export default function Machines() {
  return <ManufacturingResourcePage title="Machines & Equipment" subtitle="Track machine capacity, hourly cost, operating status, meter readings, and maintenance dates." endpoint="/manufacturing/machines" icon={<FiCpu />} viewPermission="manufacturing-machine:view" managePermission="manufacturing-machine:manage" deletePermission="manufacturing-machine:delete" createLabel="New Machine" statusOptions={["available", "running", "maintenance", "breakdown", "inactive"]}
    columns={[{ key: "code", label: "Code" }, { key: "name", label: "Machine" }, { key: "workCenter", label: "Work Center", type: "relation" }, { key: "capacityPerHour", label: "Capacity / Hr", type: "number" }, { key: "hourlyCost", label: "Hourly Cost", type: "money" }, { key: "status", label: "Status", type: "status" }, { key: "nextMaintenanceAt", label: "Next Maintenance", type: "date" }]}
    formFields={[
      { name: "code", label: "Code", type: "text" }, { name: "name", label: "Name", type: "text" },
      { name: "workCenter", label: "Work Center", type: "relation", endpoint: "/manufacturing/work-centers?limit=100&status=active" }, { name: "serialNumber", label: "Serial Number", type: "text" },
      { name: "capacityPerHour", label: "Capacity / Hour", type: "number", min: 0, defaultValue: 0 }, { name: "hourlyCost", label: "Hourly Cost", type: "number", min: 0, defaultValue: 0 },
      { name: "meterReading", label: "Meter Reading", type: "number", min: 0, defaultValue: 0 }, { name: "status", label: "Status", type: "select", defaultValue: "available", options: ["available", "running", "maintenance", "breakdown", "inactive"] },
      { name: "lastMaintenanceAt", label: "Last Maintenance", type: "date" }, { name: "nextMaintenanceAt", label: "Next Maintenance", type: "date" },
    ]} />
}
