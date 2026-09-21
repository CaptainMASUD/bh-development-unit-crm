import {
  getCompanyProfile,
  removeCompanyLogo,
  replaceCompanyLogo,
  updateCompanyProfile,
} from "../../services/administration/companyProfile.service.js";
import {
  getSystemSettings,
  updateSystemSettings,
} from "../../services/administration/systemSettings.service.js";
import { getReqMeta } from "../../utils/audit.js";

export const asyncAdministrationHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export const getCurrentCompany = asyncAdministrationHandler(async (req, res) => {
  const company = await getCompanyProfile({ tenantId: req.tenantId });
  return res.json({ success: true, data: { company } });
});

export const patchCurrentCompany = asyncAdministrationHandler(async (req, res) => {
  const company = await updateCompanyProfile({
    tenantId: req.tenantId,
    actorId: req.user?._id,
    input: req.body,
    reqMeta: getReqMeta(req),
  });
  return res.json({
    success: true,
    message: "Company details updated.",
    data: { company },
  });
});

export const putCurrentCompanyLogo = asyncAdministrationHandler(async (req, res) => {
  const company = await replaceCompanyLogo({
    tenantId: req.tenantId,
    actorId: req.user?._id,
    file: req.file,
    reqMeta: getReqMeta(req),
  });
  return res.json({
    success: true,
    message: "Company logo updated.",
    data: { company },
  });
});

export const deleteCurrentCompanyLogo = asyncAdministrationHandler(async (req, res) => {
  const company = await removeCompanyLogo({
    tenantId: req.tenantId,
    actorId: req.user?._id,
    reqMeta: getReqMeta(req),
  });
  return res.json({
    success: true,
    message: "Company logo removed.",
    data: { company },
  });
});

export const getCurrentSystemSettings = asyncAdministrationHandler(async (req, res) => {
  const settings = await getSystemSettings({ tenantId: req.tenantId });
  return res.json({ success: true, data: { settings } });
});

export const patchCurrentSystemSettings = asyncAdministrationHandler(async (req, res) => {
  const settings = await updateSystemSettings({
    tenantId: req.tenantId,
    actorId: req.user?._id,
    input: req.body,
    expectedVersion: req.body?.revision,
    reqMeta: getReqMeta(req),
  });
  return res.json({
    success: true,
    message: "System defaults updated.",
    data: { settings },
  });
});
