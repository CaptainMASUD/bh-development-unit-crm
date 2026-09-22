import ProductionPlan from "../../models/manufacturing/productionPlan.model.js";
import { createCrudController } from "./crud.factory.js";
import { assertTenant } from "../../utils/manufacturingError.js";
import { nextManufacturingNumber } from "../../services/manufacturing/manufacturingNumbering.service.js";
const crud=createCrudController({Model:ProductionPlan,searchFields:["planNumber","name"],populate:["lines.product","lines.bom","lines.routing","lines.finishedGoodsWarehouse"]});
export const listProductionPlans=crud.list; export const getProductionPlan=crud.get; export const updateProductionPlan=crud.update; export const deleteProductionPlan=crud.remove;
export const createProductionPlan=async(req,res)=>{assertTenant(req);const item=await ProductionPlan.create({...req.body,tenantId:req.tenantId,planNumber:await nextManufacturingNumber({tenantId:req.tenantId,key:"plan",providedValue:req.body.planNumber}),createdBy:req.user?._id,updatedBy:req.user?._id});res.status(201).json({success:true,data:item});};
export const approveProductionPlan=async(req,res)=>{assertTenant(req);const item=await ProductionPlan.findById(req.params.id);if(!item)return res.status(404).json({success:false,message:"Production plan not found."});if(item.status!=="draft")return res.status(409).json({success:false,message:"Only draft production plans can be approved."});item.status="approved";item.approvedBy=req.user?._id;item.approvedAt=new Date();await item.save();res.json({success:true,data:item});};
