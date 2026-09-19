import { assertTenant, pageParams } from "../../utils/manufacturingError.js";
export const createCrudController = ({ Model, searchFields=[], populate=[] }) => ({
  list: async (req,res) => {
    assertTenant(req); const {page,limit}=pageParams(req); const filter={};
    if(req.query.status) filter.status=req.query.status;
    if(req.query.q&&searchFields.length) filter.$or=searchFields.map(f=>({[f]:{$regex:String(req.query.q).trim(),$options:"i"}}));
    const q=Model.find(filter).sort({createdAt:-1}).skip((page-1)*limit).limit(limit); for(const p of populate) q.populate(p);
    const [items,total]=await Promise.all([q.lean(),Model.countDocuments(filter)]);
    res.json({success:true,data:items,pagination:{page,limit,total,pages:Math.ceil(total/limit)}});
  },
  get: async (req,res) => { assertTenant(req); const q=Model.findById(req.params.id); for(const p of populate) q.populate(p); const item=await q.lean(); if(!item)return res.status(404).json({success:false,message:"Record not found."}); res.json({success:true,data:item}); },
  create: async (req,res) => { assertTenant(req); const payload={...req.body,tenantId:req.tenantId,createdBy:req.user?._id||null,updatedBy:req.user?._id||null}; delete payload._id; const item=await Model.create(payload); res.status(201).json({success:true,data:item}); },
  update: async (req,res) => { assertTenant(req); const payload={...req.body,updatedBy:req.user?._id||null}; delete payload._id; delete payload.tenantId; const item=await Model.findByIdAndUpdate(req.params.id,{$set:payload},{new:true,runValidators:true}); if(!item)return res.status(404).json({success:false,message:"Record not found."}); res.json({success:true,data:item}); },
  remove: async (req,res) => { assertTenant(req); const item=await Model.findById(req.params.id); if(!item)return res.status(404).json({success:false,message:"Record not found."}); if(item.status&&!['draft','inactive','cancelled'].includes(item.status))return res.status(409).json({success:false,message:"Only draft, inactive, or cancelled records can be deleted."}); await item.deleteOne(); res.json({success:true,message:"Record deleted."}); },
});
