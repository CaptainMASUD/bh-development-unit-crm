import WorkOrder from "../../models/manufacturing/workOrder.model.js";
import { createCrudController } from "./crud.factory.js";
import { assertTenant } from "../../utils/manufacturingError.js";
import { startWorkOrder, completeWorkOrder } from "../../services/manufacturing/productionExecution.service.js";
const crud=createCrudController({Model:WorkOrder,searchFields:["woNumber","operationName"],populate:["manufacturingOrder","workCenter","machine","assignedUsers"]});
export const listWorkOrders=crud.list; export const getWorkOrder=crud.get; export const updateWorkOrder=crud.update;
export const startWork=async(req,res)=>{assertTenant(req);res.json({success:true,data:await startWorkOrder({workOrderId:req.params.id,userId:req.user?._id})});};
export const completeWork=async(req,res)=>{assertTenant(req);res.json({success:true,data:await completeWorkOrder({workOrderId:req.params.id,...req.body,userId:req.user?._id})});};
export const pauseWork=async(req,res)=>{assertTenant(req);const item=await WorkOrder.findByIdAndUpdate(req.params.id,{$set:{status:"paused",updatedBy:req.user?._id}},{new:true});if(!item)return res.status(404).json({success:false,message:"Work order not found."});res.json({success:true,data:item});};
