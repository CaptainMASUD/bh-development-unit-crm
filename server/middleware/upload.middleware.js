import multer from "multer";
import multerS3 from "multer-s3";
import path from "path";
import s3 from "../config/s3v3.js";

const upload = multer({
  storage: multerS3({
    s3, // ✅ must be AWS.S3() (v2)
    bucket: process.env.AWS_S3_BUCKET,
    acl: "private",
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const userId = req.user?._id?.toString() || "guest";
      const ext = path.extname(file.originalname);
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `applications/${userId}/${unique}${ext}`);
    },
  }),
});

export default upload;
