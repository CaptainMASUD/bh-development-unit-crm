import WIP from "../../models/manufacturing/wip.model.js";
import { createCrudController } from "./crud.factory.js";
const crud=createCrudController({Model:WIP,searchFields:["stage"],populate:["manufacturingOrder", "workOrder", "product", "workCenter"]});
export const listWIPs=crud.list;
export const getWIP=crud.get;
export const createWIP=crud.create;
export const updateWIP=crud.update;
export const deleteWIP=crud.remove;
