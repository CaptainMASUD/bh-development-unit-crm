import Machine from "../../models/manufacturing/machine.model.js";
import { createCrudController } from "./crud.factory.js";
const crud=createCrudController({Model:Machine,searchFields:["code", "name", "serialNumber"],populate:["workCenter"]});
export const listMachines=crud.list;
export const getMachine=crud.get;
export const createMachine=crud.create;
export const updateMachine=crud.update;
export const deleteMachine=crud.remove;
