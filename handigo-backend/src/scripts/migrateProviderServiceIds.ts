import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { Provider } from "../models/provider.model";
import { ProviderApplication } from "../models/providerApplication.model";
import { Service } from "../models/service.model";
import { createLogger } from "../utils/logger";

const migrateLogger = createLogger("MigrateProviderServiceIds");

type LegacyProviderDocument = {
  _id: Types.ObjectId;
  serviceCategoryIds?: Types.ObjectId[];
};

const getServiceIdsForCategories = async (categoryIds: Types.ObjectId[]) => {
  if (!categoryIds.length) return [];

  const services = await Service.find({
    categoryId: { $in: categoryIds },
    isActive: true,
    isDeleted: false,
  }).select("_id");

  return services.map((service) => service._id);
};

const migrateCollection = async (
  label: string,
  collection: typeof Provider | typeof ProviderApplication,
) => {
  const docs = await collection.collection
    .find<LegacyProviderDocument>({
      serviceCategoryIds: { $exists: true },
    })
    .toArray();

  let updated = 0;

  for (const doc of docs) {
    const serviceCategoryIds = doc.serviceCategoryIds || [];
    const serviceIds = await getServiceIdsForCategories(serviceCategoryIds);

    await collection.collection.updateOne(
      { _id: doc._id },
      {
        $set: { serviceIds },
        $unset: { serviceCategoryIds: "" },
      },
    );
    updated += 1;
  }

  migrateLogger.info("Đã migrate serviceIds cho collection.", {
    collection: label,
    updated,
  });
};

async function migrate() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("Chưa cấu hình MONGODB_URI hoặc MONGO_URI");

  await mongoose.connect(uri);
  await migrateCollection("providers", Provider);
  await migrateCollection("providerapplications", ProviderApplication);
  await mongoose.disconnect();
}

migrate().catch(async (error) => {
  migrateLogger.error("Migrate serviceIds provider thất bại.", error);
  await mongoose.disconnect();
  process.exit(1);
});
