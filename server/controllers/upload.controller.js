// controllers/upload.controller.js
import s3 from "../config/s3v3.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import path from "path";

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
    const uploadScope = String(scope || "task").toLowerCase();

    if (!fileName || !fileType) {
      return res.status(400).json({ message: "fileName and fileType are required" });
    }

    if (uploadScope === "task") {
      if (!customerId || !taskId) {
        return res.status(400).json({ message: "customerId and taskId are required when scope=task" });
      }
    } else if (uploadScope === "subtitle") {
      if (!customerId || !taskId || !subtitleId) {
        return res.status(400).json({
          message: "customerId, taskId and subtitleId are required when scope=subtitle",
        });
      }
    } else if (uploadScope === "templatesubtitle") {
      if (!templateId || !subtitleId) {
        return res.status(400).json({
          message: "templateId and subtitleId are required when scope=templateSubtitle",
        });
      }
    } else {
      return res.status(400).json({ message: "Invalid scope. Use task | subtitle | templateSubtitle" });
    }

    const ext = path.extname(fileName) || "";
    const random = crypto.randomBytes(12).toString("hex");

    let key = "";

    if (uploadScope === "task") {
      key = `customers/${customerId}/tasks/${taskId}/files/${Date.now()}-${random}${ext}`;
    }

    if (uploadScope === "subtitle") {
      key = `customers/${customerId}/tasks/${taskId}/subtitles/${subtitleId}/files/${Date.now()}-${random}${ext}`;
    }

    if (uploadScope === "templatesubtitle") {
      key = `task-templates/${templateId}/subtitles/${subtitleId}/files/${Date.now()}-${random}${ext}`;
    }

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
    return res.status(500).json({
      message: "Failed to generate presigned URL",
      error: err.message,
    });
  }
};
