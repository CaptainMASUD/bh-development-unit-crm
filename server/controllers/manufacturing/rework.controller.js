import ReworkOrder from "../../models/manufacturing/reworkOrder.model.js";
import { createCrudController } from "./crud.factory.js";
const crud=createCrudController({Model:ReworkOrder,searchFields:["reworkNumber", "reason"],populate:["manufacturingOrder", "nonConformance", "product", "routing"]});
export const listReworkOrders=crud.list;
export const getReworkOrder=crud.get;
export const createReworkOrder=crud.create;
export const updateReworkOrder=crud.update;
export const deleteReworkOrder=crud.remove;
