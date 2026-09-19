import { assertTenant } from "../../utils/manufacturingError.js";
import { getManufacturingDashboard } from "../../services/manufacturing/manufacturingReporting.service.js";
export const manufacturingDashboard=async(req,res)=>{assertTenant(req);res.json({success:true,data:await getManufacturingDashboard()});};
