import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadCloudinary = async (fileBuffer) => {
  try {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: 'auto' }, // Automatically detect file type
        (error, result) => {
          if (error) {
            console.error(`Cloudinary Upload Error: ${error.message}`);
            reject(error);
          } else {
            resolve(result.secure_url);
          }
        }
      );

      streamifier.createReadStream(fileBuffer).pipe(uploadStream);
    });
  } catch (error) {
    console.error(`Error uploading to Cloudinary: ${error.message}`);
    return null;
  }
};

export default uploadCloudinary;
