import ScrapEntry from "../../models/manufacturing/scrapEntry.model.js";
import { createCrudController } from "./crud.factory.js";
const crud=createCrudController({Model:ScrapEntry,searchFields:["scrapNumber", "reason"],populate:["manufacturingOrder", "workOrder", "product"]});
export const listScrapEntrys=crud.list;
export const getScrapEntry=crud.get;
export const createScrapEntry=crud.create;
export const updateScrapEntry=crud.update;
export const deleteScrapEntry=crud.remove;
