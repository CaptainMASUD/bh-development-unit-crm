import multer from "multer";

const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB limit
});

export default upload;
