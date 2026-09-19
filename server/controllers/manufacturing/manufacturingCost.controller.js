import ManufacturingCost from "../../models/manufacturing/manufacturingCost.model.js";
import { createCrudController } from "./crud.factory.js";
import { assertTenant } from "../../utils/manufacturingError.js";
import { calculateManufacturingCost } from "../../services/manufacturing/manufacturingCosting.service.js";
const crud=createCrudController({Model:ManufacturingCost,searchFields:["costNumber"],populate:["manufacturingOrder"]});
export const listManufacturingCosts=crud.list; export const getManufacturingCost=crud.get;
export const recalculateManufacturingCost=async(req,res)=>{assertTenant(req);res.json({success:true,data:await calculateManufacturingCost({tenantId:req.tenantId,manufacturingOrderId:req.params.manufacturingOrderId,userId:req.user?._id,finalize:Boolean(req.body.finalize)})});};
