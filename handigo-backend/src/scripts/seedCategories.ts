import "dotenv/config";
import mongoose from "mongoose";
import { Category } from "../models/category.model";
import { createLogger } from "../utils/logger";

const seedLogger = createLogger("SeedCategories");

const categories = [
  { name: "Điện dân dụng", slug: "dien-dan-dung", icon: "bolt" },
  { name: "Điện lạnh", slug: "dien-lanh", icon: "ac_unit" },
  { name: "Nước và đường ống", slug: "nuoc-va-duong-ong", icon: "plumbing" },
  { name: "Vệ sinh nhà cửa", slug: "ve-sinh-nha-cua", icon: "cleaning_services" },
  { name: "Sửa chữa gia dụng", slug: "sua-chua-gia-dung", icon: "home_repair_service" },
];

async function seed() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("Chưa cấu hình MONGODB_URI hoặc MONGO_URI");

  await mongoose.connect(uri);
  await Promise.all(
    categories.map((category) =>
      Category.updateOne(
        { slug: category.slug },
        {
          $set: {
            name: category.name,
            icon: category.icon,
            isActive: true,
            isDeleted: false,
            deletedAt: null,
          },
          $setOnInsert: { description: null },
        },
        { upsert: true },
      ),
    ),
  );
  seedLogger.info("Đã seed danh mục.", { count: categories.length });
  await mongoose.disconnect();
}

seed().catch(async (error) => {
  seedLogger.error("Seed danh mục thất bại.", error);
  await mongoose.disconnect();
  process.exit(1);
});
