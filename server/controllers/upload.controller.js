// controllers/upload.controller.js
// ✅ CRM/task uploads via S3 presigned PUT (one call per file)
import s3 from "../config/s3v3.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import path from "path";

export const presignUpload = async (req, res) => {
  try {
    const { fileName, fileType, customerId, taskId } = req.body;

    // ✅ We include taskId to keep keys organized by task (recommended)
    if (!fileName || !fileType || !customerId || !taskId) {
      return res.status(400).json({
        message: "fileName, fileType, customerId and taskId are required",
      });
    }

    const ext = path.extname(fileName) || "";
    const random = crypto.randomBytes(12).toString("hex");

    // ✅ key structure: customers/<customerId>/tasks/<taskId>/<timestamp-random>.ext
    const key = `customers/${customerId}/tasks/${taskId}/${Date.now()}-${random}${ext}`;

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 });

    // object is private by default; this is NOT publicly accessible without signed GET
    const fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    return res.status(200).json({ uploadUrl, key, url: fileUrl });
  } catch (err) {
    return res.status(500).json({
      message: "Failed to generate presigned URL",
      error: err.message,
    });
  }
};
