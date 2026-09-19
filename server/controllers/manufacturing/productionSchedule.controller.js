import ProductionSchedule from "../../models/manufacturing/productionSchedule.model.js";
import { createCrudController } from "./crud.factory.js";
import { assertTenant } from "../../utils/manufacturingError.js";
import { createSchedule, hasScheduleConflict } from "../../services/manufacturing/productionScheduling.service.js";
const crud=createCrudController({Model:ProductionSchedule,searchFields:["scheduleNumber"],populate:["manufacturingOrder","workOrder","workCenter","machine"]});
export const listProductionSchedules=crud.list; export const getProductionSchedule=crud.get; export const deleteProductionSchedule=crud.remove;
export const createProductionSchedule=async(req,res)=>{assertTenant(req);res.status(201).json({success:true,data:await createSchedule({tenantId:req.tenantId,data:req.body,userId:req.user?._id})});};
export const updateProductionSchedule=async(req,res)=>{assertTenant(req);if(await hasScheduleConflict({...req.body,excludeId:req.params.id}))return res.status(409).json({success:false,message:"Schedule overlaps an existing booking."});return crud.update(req,res);};
