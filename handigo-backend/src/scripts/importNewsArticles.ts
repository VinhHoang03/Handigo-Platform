import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { z } from "zod";
import { NewsArticle } from "../models/newsArticle.model";
import User from "../models/user.model";
import { createNewsArticleSchema } from "../validations/newsArticle.validator";
import type { NewsRichNode } from "../utils/newsRichContent";

const directory = path.resolve(__dirname, "../../data/news-articles-2026-10-30");
const importSchema = createNewsArticleSchema.extend({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  origin: z.enum(["legacy", "new"]),
  publishedAt: z.string().datetime(),
  status: z.literal("published").default("published"),
  sources: z.array(z.object({ label: z.string().min(1), url: z.string().url() }).strict()).default([]),
});

export function readNewsImport() {
  const rows = z.array(importSchema).min(1).parse(JSON.parse(readFileSync(path.join(directory, "articles.json"), "utf8")));
  if (new Set(rows.map(row => row.slug)).size !== rows.length) throw new Error("Dữ liệu nhập có đường dẫn bài viết trùng nhau.");
  return rows.map(row => {
    const content = [...row.content];
    const richNodes: NewsRichNode[] = content.map(block => {
      if (block.type === "list") return { type: "bulletList", content: block.items.map(text => ({ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text }] }] })) };
      if (block.type === "quote") return { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: block.text }] }] };
      return { type: block.type === "heading" ? "heading" : "paragraph", ...(block.type === "heading" ? { attrs: { level: 2 } } : {}), content: [{ type: "text", text: block.text }] };
    });
    if (row.sources.length) {
      content.push({ type: "heading", text: "Nguồn tham khảo" });
      richNodes.push({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Nguồn tham khảo" }] });
      for (const source of row.sources) {
        content.push({ type: "paragraph", text: `${source.label}: ${source.url}` });
        richNodes.push({ type: "paragraph", content: [{ type: "text", text: source.label, marks: [{ type: "link", attrs: { href: source.url, target: "_blank", rel: "noopener noreferrer nofollow" } }] }] });
      }
    }
    const payload = createNewsArticleSchema.parse({
      title: row.title, excerpt: row.excerpt, category: row.category, coverImage: row.coverImage,
      authorName: row.authorName, content, richContent: { type: "doc", content: richNodes }, status: row.status, isFeatured: row.isFeatured,
    });
    return { slug: row.slug, origin: row.origin, publishedAt: new Date(row.publishedAt), payload };
  });
}

export function planNewsImport(rows: ReturnType<typeof readNewsImport>, existing: { slug: string; isDeleted?: boolean }[]) {
  return rows.map(row => ({ ...row, action: existing.some(article => article.slug === row.slug) ? "keep" as const : "insert" as const }));
}

export async function runNewsImport(args = process.argv.slice(2)) {
  const rows = readNewsImport();
  if (args.includes("--validate-only")) {
    console.log(JSON.stringify({ thongBao: "Dữ liệu tin tức hợp lệ; chưa kết nối database.", tong: rows.length, baiCu: rows.filter(row => row.origin === "legacy").length, baiMoi: rows.filter(row => row.origin === "new").length }));
    return;
  }
  const option = (name: string) => args.find(arg => arg.startsWith(`${name}=`))?.slice(name.length + 1);
  const expectedDatabase = option("--database");
  if (!expectedDatabase) throw new Error("Cần chỉ rõ --database=tên_database trước khi kết nối.");
  if (args.includes("--load-env")) require("dotenv").config({ quiet: true });
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("Tiến trình chưa có cấu hình kết nối MongoDB.");
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 15000 });
  try {
    if (mongoose.connection.name !== expectedDatabase) throw new Error("Database trong cấu hình không trùng database được chỉ định; đã dừng nhập.");
    const slugs = rows.map(row => row.slug);
    // Kể cả bài đã xóa cũng được giữ nguyên, không tự khôi phục qua lần nhập lại.
    const existing = await NewsArticle.find({ slug: { $in: slugs } }).lean();
    const plan = planNewsImport(rows, existing);
    console.log(JSON.stringify({ database: expectedDatabase, cheDo: args.includes("--apply") ? "ghi" : "xem_truoc", keHoach: plan.map(row => ({ slug: row.slug, hanhDong: row.action === "insert" ? "them" : "giu_nguyen" })) }, null, 2));
    if (!args.includes("--apply")) return;
    const pending = plan.filter(row => row.action === "insert");
    if (!pending.length) { console.log("Tất cả bài đã tồn tại; không thay đổi dữ liệu."); return; }
    const admin = await User.findOne({ role: "ADMIN", status: "active", isDeleted: false }).select("_id").sort({ createdAt: 1, _id: 1 }).lean();
    if (!admin) throw new Error("Cần có tài khoản ADMIN đang hoạt động để gán người tạo bài.");
    for (const row of pending) await new NewsArticle({ ...row.payload, slug: row.slug, publishedAt: row.publishedAt, createdBy: admin._id }).validate();
    const reportPath = path.join(directory, "import-result.json");
    const report = { database: expectedDatabase, collection: NewsArticle.collection.name, thoiDiem: new Date().toISOString(), daThem: [] as string[], daGiuNguyen: plan.filter(row => row.action === "keep").map(row => row.slug) };
    mkdirSync(directory, { recursive: true });
    writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
    await NewsArticle.createCollection();
    await NewsArticle.createIndexes();
    for (const row of pending) {
      const result = await NewsArticle.updateOne({ slug: row.slug, isDeleted: false }, { $setOnInsert: {
        ...row.payload, slug: row.slug, publishedAt: row.publishedAt, createdBy: admin._id,
      } }, { upsert: true, runValidators: true });
      if (result.upsertedCount) report.daThem.push(row.slug);
      else report.daGiuNguyen.push(row.slug);
      writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
    }
    const stored = await NewsArticle.find({ slug: { $in: report.daThem }, isDeleted: false }).lean();
    if (stored.length !== report.daThem.length || stored.some(article => article.status !== "published" || !article.richContent || article.content.length < 8)) throw new Error("Kết quả đọc lại chưa khớp dữ liệu vừa nhập; kiểm tra báo cáo trước khi chạy lại.");
    console.log(JSON.stringify({ thongBao: "Đã nhập và đọc lại xác minh tin tức.", daThem: report.daThem.length, daGiuNguyen: report.daGiuNguyen.length, baoCao: reportPath }));
  } finally { await mongoose.disconnect(); }
}

if (require.main === module) void runNewsImport().catch((error: unknown) => {
  // Không in lỗi kết nối gốc vì có thể chứa thông tin cấu hình.
  console.error(error instanceof z.ZodError ? "Dữ liệu tin tức không vượt qua validation." : "Không thể hoàn tất nhập tin tức. Kiểm tra cấu hình, quyền database và báo cáo nhập nếu đã có.");
  process.exitCode = 1;
});
