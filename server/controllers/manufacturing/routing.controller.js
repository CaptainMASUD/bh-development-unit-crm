import Routing from "../../models/manufacturing/routing.model.js";
import { createCrudController } from "./crud.factory.js";
const crud=createCrudController({Model:Routing,searchFields:["routeNumber"],populate:["product", "operations.workCenter", "operations.machine", "operations.supplier"]});
export const listRoutings=crud.list;
export const getRouting=crud.get;
export const createRouting=crud.create;
export const updateRouting=crud.update;
export const deleteRouting=crud.remove;
