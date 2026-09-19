import { FiBarChart2 } from "react-icons/fi"

import ManufacturingResourcePage from "./ManufacturingResourcePage"

export default function CapacityPlanning() {
  return (
    <ManufacturingResourcePage
      title="Capacity Planning"
      subtitle="Review work-center capacity, utilization inputs, operating hours, labor rates, and overhead rates."
      endpoint="/manufacturing/work-centers"
      icon={<FiBarChart2 />}
      viewPermission="manufacturing-work-center:view"
      readOnly
      statusOptions={["active", "inactive"]}
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Work Center" },
        { key: "warehouse", label: "Warehouse", type: "relation" },
        { key: "capacityPerHour", label: "Capacity / Hr", type: "number" },
        { key: "hoursPerDay", label: "Hours / Day", type: "number" },
        { key: "laborRatePerHour", label: "Labor Rate", type: "money" },
        { key: "overheadRatePerHour", label: "Overhead Rate", type: "money" },
        { key: "status", label: "Status", type: "status" },
      ]}
    />
  )
}
