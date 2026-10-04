import "dotenv/config";
import mongoose from "mongoose";
import { Category } from "../models/category.model";
import { createLogger } from "../utils/logger";

const logger = createLogger("MigrateCategoryIconColors");
const colorPattern = /^#[0-9a-f]{6}$/i;
const apply = process.argv.includes("--apply");

// Mặc định chỉ xem trước; dùng --apply khi đã dừng các thao tác ghi danh mục.
const migrate = async () => {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("Chưa cấu hình MONGO_URI hoặc MONGODB_URI.");
  await mongoose.connect(mongoUri, { autoIndex: false });
  try {
    const categories = await Category.find({ isDeleted: false })
      .select("name iconColor updatedAt")
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    const used = new Set(categories
      .filter((category) => category.iconColor && colorPattern.test(category.iconColor))
      .map((category) => category.iconColor!.toLowerCase()));
    const seen = new Set<string>();
    let changed = 0;
    for (const category of categories) {
      const original = category.iconColor;
      let color = original?.toLowerCase();
      if (!color || !colorPattern.test(color) || seen.has(color)) {
        let value = 0x3525cd;
        while (used.has(`#${value.toString(16).padStart(6, "0")}`)) {
          value = (value + 0x9e3779) % 0x1000000;
        }
        color = `#${value.toString(16).padStart(6, "0")}`;
        used.add(color);
      }
      seen.add(color);
      if (original === color) continue;
      logger.info(apply ? "Cập nhật màu danh mục." : "Dự kiến cập nhật màu danh mục.", {
        categoryId: category._id.toString(), name: category.name,
        previousColor: original ?? null, iconColor: color,
      });
      if (apply) {
        const result = await Category.updateOne(
          { _id: category._id, isDeleted: false, updatedAt: category.updatedAt },
          { $set: { iconColor: color } },
          { runValidators: true },
        );
        if (result.modifiedCount !== 1) {
          throw new Error("Danh mục đã thay đổi trong lúc chuyển đổi. Vui lòng dừng thao tác ghi và chạy lại.");
        }
      }
      changed += 1;
    }
    if (apply) {
      await Category.collection.createIndex(
        { iconColor: 1 },
        {
          unique: true,
          partialFilterExpression: { iconColor: { $type: "string" }, isDeleted: false },
          collation: { locale: "en", strength: 2 },
        },
      );
    }
    logger.info(apply ? "Đã hoàn tất chuyển đổi màu danh mục." : "Đã hoàn tất xem trước, chưa ghi dữ liệu.", {
      total: categories.length, changed,
    });
  } finally {
    await mongoose.disconnect();
  }
};

migrate().catch(() => {
  logger.error("Không thể hoàn tất chuyển đổi màu danh mục. Vui lòng kiểm tra kết nối, dừng thao tác ghi và chạy lại.");
  process.exitCode = 1;
});
