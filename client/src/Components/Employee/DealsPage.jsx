"use client"

import AdminDealsPage from "../Admin/AdminDealsPage"
import { useSelector } from "react-redux"
import { hasPermission, PERMISSIONS } from "../Auth/permissions"

export default function EmployeeDealsPage() {
  const user = useSelector((state) => state.user?.currentUser)
  return <AdminDealsPage employeeMode={!hasPermission(user, PERMISSIONS.DEALS_MANAGE)} />
}
