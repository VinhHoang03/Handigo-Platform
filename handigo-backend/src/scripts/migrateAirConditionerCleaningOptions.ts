import "dotenv/config";
import mongoose from "mongoose";
import { Service } from "../models/service.model";
import { ServiceOption } from "../models/serviceOption.model";
import { createLogger } from "../utils/logger";

const logger = createLogger("MigrateAirConditionerCleaningOptions");

// Truyền đơn giá đã được xác nhận; không suy ra giá từ các tùy chọn khác nhau.
const migrate = async () => {
  const priceArgument = process.argv.find((argument) => argument.startsWith("--price="));
  const requestedPrice = priceArgument ? Number(priceArgument.slice("--price=".length)) : undefined;
  if (requestedPrice !== undefined && (!Number.isFinite(requestedPrice) || requestedPrice <= 0)) {
    throw new Error("Đơn giá mỗi máy phải là số lớn hơn 0.");
  }
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("Chưa cấu hình MONGO_URI hoặc MONGODB_URI.");
  await mongoose.connect(mongoUri);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const service = await Service.findOne({
        slug: "ve-sinh-dieu-hoa", isDeleted: false,
      }).session(session);
      if (!service) throw new Error("Không tìm thấy dịch vụ vệ sinh điều hòa.");
      const price = requestedPrice ?? service.fixedPrice;
      if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
        throw new Error("Chưa có đơn giá hợp lệ. Hãy truyền --price=<đơn giá mỗi máy>.");
      }
      service.serviceType = "fixed_price";
      service.fixedPrice = price;
      service.depositAmount = null;
      service.requiresOptionSelection = false;
      service.description = "Dịch vụ vệ sinh điều hòa tại nhà giúp làm sạch dàn lạnh, lưới lọc và khu vực thoát nước. Áp dụng một đơn giá cố định cho mỗi máy; khách hàng chỉ cần chọn số lượng máy.";
      await service.save({ session });
      await ServiceOption.updateMany(
        { serviceId: service._id, isDeleted: false },
        { $set: { isActive: false, isDeleted: true, deletedAt: new Date() } },
        { session, runValidators: true },
      );
    });
    logger.info("Đã chuyển vệ sinh điều hòa sang một đơn giá và số lượng máy.");
  } finally {
    await session.endSession();
  }
};

migrate().catch((error: unknown) => {
  logger.error("Cập nhật dịch vụ vệ sinh điều hòa thất bại.", error);
  process.exitCode = 1;
}).finally(async () => {
  await mongoose.disconnect();
});
