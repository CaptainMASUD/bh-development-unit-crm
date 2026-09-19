import MaintenancePlan from "../../models/manufacturing/maintenancePlan.model.js";
import { createCrudController } from "./crud.factory.js";
const crud=createCrudController({Model:MaintenancePlan,searchFields:["planNumber", "name"],populate:["machine"]});
export const listMaintenancePlans=crud.list;
export const getMaintenancePlan=crud.get;
export const createMaintenancePlan=crud.create;
export const updateMaintenancePlan=crud.update;
export const deleteMaintenancePlan=crud.remove;
