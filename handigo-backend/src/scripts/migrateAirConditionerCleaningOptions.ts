import "dotenv/config";
import mongoose from "mongoose";
import { Service } from "../models/service.model";
import { ServiceOption } from "../models/serviceOption.model";
import { createLogger } from "../utils/logger";

const migrationLogger = createLogger("MigrateAirConditionerCleaningOptions");
const SOURCE_SERVICE_SLUG = "dieu-hoa";
const TARGET_SERVICE_SLUG = "ve-sinh-dieu-hoa";

const migrate = async () => {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("Chưa cấu hình MONGO_URI hoặc MONGODB_URI.");
  }

  await mongoose.connect(mongoUri);

  const [sourceService, targetService] = await Promise.all([
    Service.findOne({ slug: SOURCE_SERVICE_SLUG, isDeleted: false }),
    Service.findOne({ slug: TARGET_SERVICE_SLUG, isDeleted: false }),
  ]);
  if (!sourceService || !targetService) {
    throw new Error("Không tìm thấy dịch vụ sửa chữa hoặc vệ sinh điều hòa.");
  }
  if (!sourceService.categoryId.equals(targetService.categoryId)) {
    throw new Error("Hai dịch vụ điều hòa không thuộc cùng một danh mục.");
  }

  const sourceOptions = await ServiceOption.find({
    serviceId: sourceService._id,
    isActive: true,
    isDeleted: false,
  }).sort({ sortOrder: 1, createdAt: 1 });
  if (sourceOptions.length === 0) {
    throw new Error("Dịch vụ sửa chữa điều hòa chưa có tùy chọn để sao chép.");
  }

  const desiredKeys = sourceOptions.map((option) => ({
    name: option.name,
    selectionGroup: option.selectionGroup || null,
  }));
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      await Service.updateOne(
        { _id: targetService._id },
        {
          $set: {
            description:
              "Dịch vụ vệ sinh điều hòa tại nhà giúp làm sạch dàn lạnh, lưới lọc và khu vực thoát nước, hỗ trợ thiết bị làm lạnh hiệu quả, hạn chế bụi bẩn, mùi khó chịu và tình trạng chảy nước. Khách hàng chọn loại điều hòa và công suất thiết bị để kỹ thuật viên chuẩn bị dụng cụ phù hợp trước khi đến.",
            requiresOptionSelection: true,
          },
        },
        { session, runValidators: true },
      );

      await ServiceOption.updateMany(
        {
          serviceId: targetService._id,
          isDeleted: false,
          $nor: desiredKeys,
        },
        {
          $set: {
            isActive: false,
            isDeleted: true,
            deletedAt: new Date(),
          },
        },
        { session, runValidators: true },
      );

      for (const option of sourceOptions) {
        await ServiceOption.updateOne(
          {
            serviceId: targetService._id,
            name: option.name,
            selectionGroup: option.selectionGroup || null,
          },
          {
            $set: {
              description: option.description || null,
              image: option.image || null,
              optionType: option.optionType,
              price: 0,
              selectionGroup: option.selectionGroup || null,
              selectionMode: option.selectionMode,
              isRequired: option.isRequired,
              sortOrder: option.sortOrder,
              isActive: true,
              isDeleted: false,
              deletedAt: null,
            },
            $setOnInsert: {
              serviceId: targetService._id,
              name: option.name,
            },
          },
          { upsert: true, session, runValidators: true },
        );
      }
    });
  } finally {
    await session.endSession();
  }

  const activeOptionCount = await ServiceOption.countDocuments({
    serviceId: targetService._id,
    isActive: true,
    isDeleted: false,
  });
  migrationLogger.info("Đã cập nhật dữ liệu vệ sinh điều hòa.", {
    sourceOptionCount: sourceOptions.length,
    activeOptionCount,
  });
};

migrate()
  .catch((error: unknown) => {
    migrationLogger.error("Cập nhật dữ liệu vệ sinh điều hòa thất bại.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
