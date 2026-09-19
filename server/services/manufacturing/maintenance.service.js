import MaintenancePlan from "../../models/manufacturing/maintenancePlan.model.js";
import MaintenanceOrder from "../../models/manufacturing/maintenanceOrder.model.js";
import Machine from "../../models/manufacturing/machine.model.js";
import { nextManufacturingNumber } from "./manufacturingNumbering.service.js";
export const generateDueMaintenanceOrders = async ({ tenantId, asOf=new Date(), userId=null }) => {
  const plans=await MaintenancePlan.find({status:"active",$or:[{triggerType:"calendar",nextDueAt:{$lte:asOf}},{triggerType:"meter"}]}).lean();
  const created=[];
  for(const plan of plans){
    const machine=await Machine.findById(plan.machine).lean();
    const due=plan.triggerType==="calendar" ? Boolean(plan.nextDueAt&&new Date(plan.nextDueAt)<=asOf) : Number(machine?.meterReading||0)>=Number(plan.nextDueMeter||Infinity);
    if(!due) continue;
    const existing=await MaintenanceOrder.exists({plan:plan._id,status:{$in:["open","scheduled","in_progress"]}}); if(existing) continue;
    created.push(await MaintenanceOrder.create({tenantId,maintenanceNumber:await nextManufacturingNumber({tenantId,key:"maintenanceOrder"}),plan:plan._id,machine:plan.machine,type:"preventive",status:"open",createdBy:userId,updatedBy:userId}));
  }
  return created;
};
