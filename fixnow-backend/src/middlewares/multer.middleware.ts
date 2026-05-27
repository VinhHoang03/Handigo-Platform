// middlewares/multer.middleware.ts
import multer from "multer";
import path from "path";

// lưu tạm vào 1 folder duy nhất
const storage = multer.diskStorage({
  destination: "uploads/images/",

  filename: (req, file, cb) => {
    const uniqueSuffix =
      Date.now() + "-" + Math.round(Math.random() * 1e9);

    cb(
      null,
      `image-${uniqueSuffix}${path.extname(file.originalname)}`
    );
  },
});

export const uploadImage = multer({
  storage,

  // validate chỉ cho phép image
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only images are allowed"));
    }
    cb(null, true);
  },

  // giới hạn size (optional)
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});