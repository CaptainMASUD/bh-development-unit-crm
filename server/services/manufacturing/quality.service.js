import QualityInspection from "../../models/manufacturing/qualityInspection.model.js";
import ManufacturingOrder from "../../models/manufacturing/manufacturingOrder.model.js";
import NonConformance from "../../models/manufacturing/nonConformance.model.js";
import { nextManufacturingNumber } from "./manufacturingNumbering.service.js";
export const finalizeInspection = async ({ inspectionId, result, userId = null }) => {
  const inspection = await QualityInspection.findById(inspectionId);
  if (!inspection) throw Object.assign(new Error("Quality inspection not found."), { statusCode: 404 });
  const normalized = String(result||"").toLowerCase();
  if (!["pass","fail","hold"].includes(normalized)) throw Object.assign(new Error("Inspection result must be pass, fail, or hold."), { statusCode: 400 });
  inspection.result=normalized; inspection.inspectedAt=new Date(); inspection.inspectedBy=userId; inspection.updatedBy=userId; await inspection.save();
  if (inspection.manufacturingOrder) await ManufacturingOrder.updateOne({ _id: inspection.manufacturingOrder }, { $set: { qualityStatus: normalized==="pass"?"passed":normalized==="fail"?"failed":"hold", ...(normalized!=="pass"?{status:"quality_hold"}:{}), updatedBy:userId } });
  return inspection;
};
export const createNcrFromInspection = async ({ tenantId, inspectionId, defectType, severity="minor", quantity, userId=null }) => {
  const inspection=await QualityInspection.findById(inspectionId).lean();
  if(!inspection) throw Object.assign(new Error("Quality inspection not found."),{statusCode:404});
  return NonConformance.create({tenantId,ncrNumber:await nextManufacturingNumber({tenantId,key:"ncr"}),inspection:inspection._id,manufacturingOrder:inspection.manufacturingOrder,product:inspection.product,defectType,severity,quantity:quantity||inspection.quantityFailed||1,createdBy:userId,updatedBy:userId});
};
