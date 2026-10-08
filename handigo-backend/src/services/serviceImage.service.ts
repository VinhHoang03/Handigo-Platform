import cloudinary from "../configs/cloudinary";
import { AppError } from "../utils/appError";

export const validateServiceImageMetadata = (image: { width: number; height: number; bytes: number; format: string }) => {
  if (![image.width, image.height, image.bytes].every(value => Number.isInteger(value) && value > 0) || image.width < 800 || image.height < 450 || image.width > 4096 || image.height > 2304 ||
      Math.abs(image.width / image.height - 16 / 9) > 0.002 ||
      image.bytes > 5 * 1024 * 1024 || image.format !== "png") {
    throw new AppError("Ảnh dịch vụ phải là PNG 16:9, từ 800 × 450 đến 4096 × 2304 px, tối đa 5 MB", 400);
  }
};

export const validateNewServiceImages = async (images: string[], existing: string[] = []) => {
  for (const url of new Set(images)) {
    if (existing.includes(url)) continue;
    const cloud = cloudinary.config().cloud_name;
    const prefix = `https://res.cloudinary.com/${cloud}/image/upload/`;
    if (!url.startsWith(prefix)) throw new AppError("Vui lòng tải ảnh dịch vụ qua công cụ cắt ảnh", 400);
    const path = url.slice(prefix.length).replace(/^v[0-9]+\//, "");
    if (!/^handigo\/service-images\/[a-zA-Z0-9_-]+\.png$/.test(path)) {
      throw new AppError("Ảnh không thuộc kho ảnh dịch vụ đã xác thực", 400);
    }
    try {
      const asset = await cloudinary.api.resource(path.replace(/\.png$/, ""), { resource_type: "image" });
      validateServiceImageMetadata(asset);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Không thể xác thực ảnh dịch vụ. Vui lòng thử lại", 400);
    }
  }
};
