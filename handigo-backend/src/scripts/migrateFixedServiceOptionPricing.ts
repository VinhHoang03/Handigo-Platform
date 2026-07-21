import "dotenv/config";
import mongoose from "mongoose";
import { Service } from "../models/service.model";
import { ServiceOption } from "../models/serviceOption.model";
import { createLogger } from "../utils/logger";

const migrationLogger = createLogger("MigrateFixedServiceOptionPricing");

const normalizeText = (value?: string | null) =>
  value
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase()
    .trim() || "";

const migrate = async () => {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("Chưa cấu hình MONGO_URI hoặc MONGODB_URI.");
  }

  await mongoose.connect(mongoUri);
  const services = await Service.find({
    serviceType: "fixed_price",
    isDeleted: false,
  });
  const session = await mongoose.startSession();
  let createdDefaultOptionCount = 0;

  try {
    await session.withTransaction(async () => {
      for (const service of services) {
        const legacyFixedPrice = Math.max(service.fixedPrice ?? 0, 0);
        const activeOptions = await ServiceOption.find({
          serviceId: service._id,
          isActive: true,
          isDeleted: false,
        }).session(session);

        if (activeOptions.length === 0 && legacyFixedPrice > 0) {
          await ServiceOption.create([{
            serviceId: service._id,
            name: "Gói tiêu chuẩn",
            description: "Giá dịch vụ tiêu chuẩn.",
            optionType: "package",
            price: legacyFixedPrice,
            selectionGroup: "Gói dịch vụ",
            selectionMode: "single",
            isRequired: false,
            allowsQuantity: false,
            sortOrder: 0,
            isActive: true,
          }], { session });
          createdDefaultOptionCount += 1;
        }

        if (service.slug === "ve-sinh-dieu-hoa") {
          for (const option of activeOptions) {
            const isAirConditionerType = normalizeText(option.selectionGroup)
              .includes("loai dieu hoa");
            if (option.allowsQuantity !== isAirConditionerType) {
              option.allowsQuantity = isAirConditionerType;
              await option.save({ session, validateModifiedOnly: true });
            }
          }
        }

        service.fixedPrice = null;
        service.requiresOptionSelection = true;
        await service.save({ session, validateModifiedOnly: true });
      }
    });
  } finally {
    await session.endSession();
  }

  migrationLogger.info("Đã chuyển giá dịch vụ cố định sang tùy chọn.", {
    serviceCount: services.length,
    createdDefaultOptionCount,
  });
};

migrate()
  .catch((error: unknown) => {
    migrationLogger.error("Chuyển giá dịch vụ cố định thất bại.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
