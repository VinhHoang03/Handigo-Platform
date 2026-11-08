import mongoose from "mongoose";
import { NewsArticle } from "../models/newsArticle.model";
import User from "../models/user.model";
import { Service } from "../models/service.model";
import { Category } from "../models/category.model";
import { buildRepairNews, repairCaseMatchesService } from "./repairNewsContent";
import { planNewsImport } from "./importNewsArticles";
import { REPAIR_NEWS_CATEGORY, repairTipSlug, searchRepairArticles } from "../services/repairNews.service";
import { repairCases } from "../ai/knowledge/repair-cases";

export async function importRepairNews(args = process.argv.slice(2)) {
  const database = args.find((arg) => arg.startsWith("--database="))?.slice(11);
  if (!database || !process.env.MONGO_URI) throw new Error("Cần tên database và cấu hình kết nối được cấp cho tiến trình.");
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 15000 });
  try {
    if (mongoose.connection.name !== database) throw new Error("Database không trùng phạm vi đã chỉ định.");
    const categoryIds = await Category.distinct("_id", { isActive: true, isDeleted: false });
    const services = await Service.find({ isActive: true, isDeleted: false, categoryId: { $in: categoryIds } })
      .select("name coverImage image").lean();
    const cover = await NewsArticle.findOne({ category: REPAIR_NEWS_CATEGORY, status: "published", isDeleted: false })
      .select("coverImage").lean();
    if (!cover?.coverImage) throw new Error("Cần ảnh bìa công khai phù hợp từ mục Mẹo sửa chữa hiện có.");
    const rows = buildRepairNews(services, cover.coverImage);
    if (args.includes("--verify")) {
      const cases = repairCases.filter((item) => services.some((service) => repairCaseMatchesService(item, service.name)));
      const checks = [];
      for (const item of cases) {
        const results = await searchRepairArticles(`${item.devices[0]} ${item.symptoms[0]}`);
        checks.push({ case: item.id, found: results.some((article) => article.path === `/tin-tuc/${repairTipSlug(item.id)}`) });
      }
      const count = await NewsArticle.countDocuments({ category: REPAIR_NEWS_CATEGORY, status: "published", isDeleted: false });
      console.log(JSON.stringify({ database, publishedRepairTips: count, checks }, null, 2));
      if (checks.some((check) => !check.found)) throw new Error("Có tình huống chưa đọc được nguồn phù hợp từ Tin tức.");
      return;
    }
    const existing = await NewsArticle.find({ slug: { $in: rows.map((row) => row.slug) } }).select("slug isDeleted").lean();
    const plan = planNewsImport(rows, existing);
    const pending = plan.filter((row) => row.action === "insert");
    const admin = await User.findOne({ role: "ADMIN", status: "active", isDeleted: false }).select("_id").sort({ createdAt: 1, _id: 1 }).lean();
    if (!admin) throw new Error("Chưa có quản trị viên hợp lệ để gán người tạo bài.");
    // Toàn bộ bài phải qua schema trước lần ghi đầu tiên; chỉ thêm, không ghi đè bài biên tập.
    for (const row of pending) await new NewsArticle({ ...row.payload, slug: row.slug, publishedAt: row.publishedAt, createdBy: admin._id }).validate();
    console.log(JSON.stringify({ database, category: REPAIR_NEWS_CATEGORY,
      mode: args.includes("--apply") ? "ghi" : "xem_truoc", total: rows.length,
      insert: pending.map((row) => ({ slug: row.slug, title: row.payload.title })), keep: plan.length - pending.length }, null, 2));
    if (!args.includes("--apply")) return;
    let inserted = 0;
    for (const row of pending) {
      const result = await NewsArticle.updateOne({ slug: row.slug }, { $setOnInsert: {
        ...row.payload, slug: row.slug, publishedAt: row.publishedAt, createdBy: admin._id,
      } }, { upsert: true, runValidators: true });
      inserted += result.upsertedCount;
    }
    const stored = await NewsArticle.find({ slug: { $in: pending.map((row) => row.slug) }, status: "published", isDeleted: false })
      .select("slug title category content richContent").lean();
    if (stored.length !== pending.length || stored.some((article) => article.category !== REPAIR_NEWS_CATEGORY || !article.richContent)) {
      throw new Error("Kết quả đọc lại chưa khớp các bài vừa thêm.");
    }
    console.log(JSON.stringify({ message: "Đã thêm và đọc lại xác minh Mẹo sửa chữa.", inserted, verified: stored.length, kept: plan.length - pending.length }));
  } finally { await mongoose.disconnect(); }
}

if (require.main === module) void importRepairNews().catch(() => {
  console.error("Chưa hoàn tất nhập Mẹo sửa chữa; lỗi kết nối gốc đã được ẩn. Có thể chạy lại an toàn để kiểm tra các slug còn thiếu.");
  process.exitCode = 1;
});
