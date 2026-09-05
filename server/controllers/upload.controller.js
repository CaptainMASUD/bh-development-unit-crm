// controllers/upload.controller.js
import s3 from "../config/s3v3.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import path from "path";

export const buildUploadTarget = ({
  scope,
  fileName,
  fileType,
  customerId,
  taskId,
  templateId,
  subtitleId,
  now = Date.now(),
  random = crypto.randomBytes(12).toString("hex"),
} = {}) => {
  const uploadScope = String(scope || "task").toLowerCase();

  if (!fileName || !fileType) {
    throw Object.assign(new Error("fileName and fileType are required"), { statusCode: 400 });
  }

  if (uploadScope === "product") {
    if (!["image/png", "image/jpeg", "image/webp"].includes(String(fileType).toLowerCase())) {
      throw Object.assign(new Error("Product images must be PNG, JPG, or WEBP."), { statusCode: 400 });
    }
  } else if (uploadScope === "task") {
    if (!customerId || !taskId) {
      throw Object.assign(new Error("customerId and taskId are required when scope=task"), { statusCode: 400 });
    }
  } else if (uploadScope === "subtitle") {
    if (!customerId || !taskId || !subtitleId) {
      throw Object.assign(new Error("customerId, taskId and subtitleId are required when scope=subtitle"), { statusCode: 400 });
    }
  } else if (uploadScope === "templatesubtitle") {
    if (!templateId || !subtitleId) {
      throw Object.assign(new Error("templateId and subtitleId are required when scope=templateSubtitle"), { statusCode: 400 });
    }
  } else {
    throw Object.assign(new Error("Invalid scope. Use task | subtitle | templateSubtitle | product"), { statusCode: 400 });
  }

  const ext = path.extname(fileName) || "";
  let key = "";

  if (uploadScope === "product") key = `inventory/products/${now}-${random}${ext}`;
  if (uploadScope === "task") key = `customers/${customerId}/tasks/${taskId}/files/${now}-${random}${ext}`;
  if (uploadScope === "subtitle") key = `customers/${customerId}/tasks/${taskId}/subtitles/${subtitleId}/files/${now}-${random}${ext}`;
  if (uploadScope === "templatesubtitle") key = `task-templates/${templateId}/subtitles/${subtitleId}/files/${now}-${random}${ext}`;

  return { scope: uploadScope, key };
};

export const presignUpload = async (req, res) => {
  try {
    const {
      fileName,
      fileType,
      customerId,
      taskId,
      templateId,
      subtitleId,
      scope,
    } = req.body;

    /**
     * scope:
     * - "task"            => customers/<customerId>/tasks/<taskId>/files/...
     * - "subtitle"        => customers/<customerId>/tasks/<taskId>/subtitles/<subtitleId>/files/...
     * - "templateSubtitle"=> task-templates/<templateId>/subtitles/<subtitleId>/files/...
     */
    const target = buildUploadTarget({ scope, fileName, fileType, customerId, taskId, templateId, subtitleId });
    const uploadScope = target.scope;
    const key = target.key;

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 });

    const fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    return res.status(200).json({
      uploadUrl,
      key,
      url: fileUrl,
      scope: uploadScope,
      templateId: uploadScope === "templatesubtitle" ? templateId : undefined,
      subtitleId: subtitleId || undefined,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      message: "Failed to generate presigned URL",
      error: err.message,
    });
  }
};
