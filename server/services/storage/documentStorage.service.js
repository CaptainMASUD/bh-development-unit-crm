import crypto from "node:crypto";
import path from "node:path";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const sanitizeFilename = (filename = "") => {
  const base = path.basename(String(filename || "").trim());
  return base.replace(/[^a-zA-Z0-9._-]/g, "_") || "unnamed_document";
};

const BLOCKED_EXTENSIONS = new Set([
  ".exe", ".bat", ".cmd", ".sh", ".vbs", ".msi", ".jar", ".com", ".pif", ".scr", ".reg"
]);

const BLOCKED_MIME_TYPES = new Set([
  "application/x-msdownload",
  "application/x-sh",
  "application/x-executable",
  "application/x-dosexec",
  "application/x-msdos-program"
]);

export const isDangerousFile = (filename = "", mimeType = "") => {
  const ext = path.extname(filename).toLowerCase();
  if (BLOCKED_EXTENSIONS.has(ext)) return true;
  if (BLOCKED_MIME_TYPES.has(String(mimeType || "").toLowerCase())) return true;
  return false;
};

export const isImageMimeType = (mimeType = "") => {
  const normalized = String(mimeType || "").toLowerCase().trim();
  return (
    normalized.startsWith("image/") &&
    !normalized.includes("svg") // keep svgs in R2 for security against embedded scripts
  );
};

// Internal in-memory test store for environments without live R2 credentials
const mockR2Store = new Map();

let s3ClientInstance = null;

const getR2Client = () => {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    return null; // Local development or test fallback
  }

  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return s3ClientInstance;
};

/**
 * Upload an image buffer directly to Cloudinary preserving full fidelity
 */
export const uploadImageToCloudinary = async (fileBuffer, { folder = "commercial-lc/documents", publicId = null } = {}) => {
  return new Promise((resolve, reject) => {
    const options = {
      resource_type: "image",
      folder,
      use_filename: false,
      unique_filename: true,
      ...(publicId ? { public_id: publicId } : {}),
    };

    const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve({
        secure_url: result.secure_url,
        public_id: result.public_id,
        bytes: result.bytes || 0,
        format: result.format,
      });
    });

    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};

/**
 * Upload a document to Cloudflare R2
 */
export const uploadDocumentToR2 = async (fileBuffer, { storageKey, mimeType, bucket = process.env.R2_BUCKET_NAME || "commercial-lc-docs" }) => {
  const client = getR2Client();
  if (!client) {
    // In-memory mock storage for local test runs
    mockR2Store.set(storageKey, {
      buffer: fileBuffer,
      mimeType,
      size: fileBuffer?.length || 0,
      bucket,
      createdAt: new Date(),
    });
    return {
      storageKey,
      bucket,
      isMock: true,
    };
  }

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    Body: fileBuffer,
    ContentType: mimeType || "application/octet-stream",
  });

  await client.send(command);
  return {
    storageKey,
    bucket,
    isMock: false,
  };
};

/**
 * High-level document router:
 * Determines storage destination (Cloudinary for images, R2 for business documents)
 */
export const uploadDocumentFile = async ({ file, tenantId = null, lcId = null }) => {
  if (!file || !file.buffer) {
    throw Object.assign(new Error("No file content received for upload."), { statusCode: 400 });
  }

  const originalName = sanitizeFilename(file.originalname);
  const mimeType = String(file.mimetype || "application/octet-stream").toLowerCase();
  const fileSize = Number(file.size || file.buffer.length || 0);

  if (isDangerousFile(originalName, mimeType)) {
    throw Object.assign(
      new Error("Executable or unsafe file formats are not permitted for upload."),
      { statusCode: 400 }
    );
  }

  const safeTenant = tenantId ? String(tenantId) : "common";
  const safeLc = lcId ? String(lcId) : "general";
  const uuid = crypto.randomUUID();
  const timestamp = Date.now();

  if (isImageMimeType(mimeType)) {
    // Route to Cloudinary
    try {
      const folder = `commercial-lc/${safeTenant}/${safeLc}`;
      const uploadResult = await uploadImageToCloudinary(file.buffer, { folder });
      return {
        originalName,
        storedName: path.basename(uploadResult.public_id),
        mimeType,
        fileSize,
        fileUrl: uploadResult.secure_url,
        storageProvider: "cloudinary",
        storageKey: uploadResult.public_id,
        uploadedAt: new Date(),
      };
    } catch (err) {
      console.error("[StorageService] Cloudinary upload error:", err);
      throw Object.assign(new Error(`Image upload failed: ${err.message}`), { statusCode: 502 });
    }
  }

  // Non-image business documents -> Cloudflare R2
  const storedName = `${timestamp}-${uuid}-${originalName}`;
  const storageKey = `commercial-lc/${safeTenant}/${safeLc}/${storedName}`;

  try {
    await uploadDocumentToR2(file.buffer, { storageKey, mimeType });
    return {
      originalName,
      storedName,
      mimeType,
      fileSize,
      fileUrl: "", // Private R2 bucket: access only via signed download URL
      storageProvider: "r2",
      storageKey,
      uploadedAt: new Date(),
    };
  } catch (err) {
    console.error("[StorageService] R2 upload error:", err);
    throw Object.assign(new Error(`Document upload failed: ${err.message}`), { statusCode: 502 });
  }
};

/**
 * Generate temporary presigned download URL for private documents
 */
export const getDocumentDownloadUrl = async ({ storageProvider, storageKey, fileUrl, originalName = "document", expiresIn = 300 }) => {
  if (storageProvider === "cloudinary" || (!storageKey && fileUrl)) {
    return fileUrl;
  }

  if (storageProvider === "r2" && storageKey) {
    const client = getR2Client();
    if (!client) {
      // Mock signed URL for test environment
      return `https://mock-r2.local/download/${encodeURIComponent(storageKey)}?filename=${encodeURIComponent(originalName)}&expires=${Date.now() + expiresIn * 1000}`;
    }

    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME || "commercial-lc-docs",
      Key: storageKey,
      ResponseContentDisposition: `inline; filename="${encodeURIComponent(originalName)}"`,
    });

    return await getSignedUrl(client, command, { expiresIn });
  }

  return fileUrl || "";
};

/**
 * Delete a document from Cloudinary or Cloudflare R2
 */
export const deleteDocumentFile = async ({ storageProvider, storageKey }) => {
  if (!storageKey) return true;

  try {
    if (storageProvider === "cloudinary") {
      const res = await cloudinary.uploader.destroy(storageKey, { resource_type: "image" });
      return res?.result === "ok" || res?.result === "not found";
    }

    if (storageProvider === "r2") {
      const client = getR2Client();
      if (!client) {
        mockR2Store.delete(storageKey);
        return true;
      }

      await client.send(
        new DeleteObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME || "commercial-lc-docs",
          Key: storageKey,
        })
      );
      return true;
    }
  } catch (err) {
    console.warn(`[StorageService] Failed to delete file (${storageProvider}:${storageKey}):`, err.message);
    return false;
  }

  return true;
};
