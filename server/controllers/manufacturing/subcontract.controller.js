import SubcontractOrder from "../../models/manufacturing/subcontractOrder.model.js";
import { createCrudController } from "./crud.factory.js";
const crud=createCrudController({Model:SubcontractOrder,searchFields:["subcontractNumber", "operationName"],populate:["manufacturingOrder", "workOrder", "supplier"]});
export const listSubcontractOrders=crud.list;
export const getSubcontractOrder=crud.get;
export const createSubcontractOrder=crud.create;
export const updateSubcontractOrder=crud.update;
export const deleteSubcontractOrder=crud.remove;
