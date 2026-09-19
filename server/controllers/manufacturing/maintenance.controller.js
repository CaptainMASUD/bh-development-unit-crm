export * from "./maintenancePlan.controller.js";
export * from "./maintenanceOrder.controller.js";
import { assertTenant } from "../../utils/manufacturingError.js";
import { generateDueMaintenanceOrders } from "../../services/manufacturing/maintenance.service.js";
export const generateMaintenance=async(req,res)=>{assertTenant(req);res.status(201).json({success:true,data:await generateDueMaintenanceOrders({tenantId:req.tenantId,asOf:req.body.asOf?new Date(req.body.asOf):new Date(),userId:req.user?._id})});};
