"use client"

import { useSelector } from "react-redux"
import AdminCustomersPage from "../Admin/crm/CustomersPage"
import EmployeeCustomersPage from "./CustomersPage"
import { hasPermission, PERMISSIONS } from "../Auth/permissions"

export default function EmployeeClientsPage() {
  const user = useSelector((state) => state.user?.currentUser)
  return hasPermission(user, PERMISSIONS.CUSTOMERS_MANAGE) ? <AdminCustomersPage /> : <EmployeeCustomersPage />
}
