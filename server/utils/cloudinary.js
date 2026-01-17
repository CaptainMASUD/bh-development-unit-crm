import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload buffer to Cloudinary (returns { secure_url, public_id })
 */
export const uploadCloudinary = async (fileBuffer) => {
  try {
    return await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: "image",
          folder: "users/avatars",
          transformation: [
            { width: 400, height: 400, crop: "fill", gravity: "face" },
            { fetch_format: "auto", quality: "auto" },
          ],
        },
        (error, result) => {
          if (error) return reject(error);
          resolve({
            secure_url: result.secure_url,
            public_id: result.public_id,
          });
        }
      );

      streamifier.createReadStream(fileBuffer).pipe(uploadStream);
    });
  } catch (error) {
    console.error(`Error uploading to Cloudinary: ${error.message}`);
    return null;
  }
};

/**
 * Delete from Cloudinary by public_id
 */
export const deleteCloudinary = async (publicId) => {
  if (!publicId) return true;
  try {
    const res = await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
    });
    return res?.result === "ok" || res?.result === "not found";
  } catch (error) {
    console.error(`Error deleting from Cloudinary: ${error.message}`);
    return false;
  }
};

export default uploadCloudinary;

