import MRPRun from "../../models/manufacturing/mrpRun.model.js";
import { createCrudController } from "./crud.factory.js";
import { assertTenant } from "../../utils/manufacturingError.js";
import { runMrp } from "../../services/manufacturing/mrp.service.js";
const crud=createCrudController({Model:MRPRun,searchFields:["runNumber"],populate:["productionPlan","requirements.product","requirements.defaultSupplier"]});
export const listMrpRuns=crud.list; export const getMrpRun=crud.get;
export const executeMrp=async(req,res)=>{assertTenant(req);const run=await runMrp({tenantId:req.tenantId,productionPlanId:req.body.productionPlanId,userId:req.user?._id});res.status(201).json({success:true,data:run});};
