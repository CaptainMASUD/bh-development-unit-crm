import MaintenanceOrder from "../../models/manufacturing/maintenanceOrder.model.js";
import { createCrudController } from "./crud.factory.js";
const crud=createCrudController({Model:MaintenanceOrder,searchFields:["maintenanceNumber", "findings", "resolution"],populate:["machine", "plan", "assignedTo"]});
export const listMaintenanceOrders=crud.list;
export const getMaintenanceOrder=crud.get;
export const createMaintenanceOrder=crud.create;
export const updateMaintenanceOrder=crud.update;
export const deleteMaintenanceOrder=crud.remove;
