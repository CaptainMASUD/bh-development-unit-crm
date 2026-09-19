import WorkCenter from "../../models/manufacturing/workCenter.model.js";
import { createCrudController } from "./crud.factory.js";
const crud=createCrudController({Model:WorkCenter,searchFields:["code", "name"],populate:["warehouse", "location"]});
export const listWorkCenters=crud.list;
export const getWorkCenter=crud.get;
export const createWorkCenter=crud.create;
export const updateWorkCenter=crud.update;
export const deleteWorkCenter=crud.remove;
