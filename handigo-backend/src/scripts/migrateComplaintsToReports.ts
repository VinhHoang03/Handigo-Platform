import mongoose from "mongoose";
import { Complaint } from "../models/complaint.model";
import { ComplaintEvidence } from "../models/complaintEvidence.model";
import { Report } from "../models/report.model";
import { Violation } from "../models/violation.model";
import { complaintToReport } from "../services/complaintReportMigration";

async function migrate() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("Chưa cấu hình kết nối MongoDB trong môi trường chạy migration.");
  const apply = process.argv.includes("--apply");
  await mongoose.connect(uri, { autoIndex: false });
  let checked = 0;
  let inserted = 0;
  for await (const complaint of Complaint.find().cursor()) {
    const isNew = await mongoose.connection.transaction(async session => {
      const existing = await Report.findById(complaint._id).session(session);
      if (existing && String(existing.legacyComplaintId) !== String(complaint._id)) {
        throw new Error("Trùng định danh báo cáo với hồ sơ khác. Dừng để kiểm tra dữ liệu.");
      }
      if (!existing) {
        const evidence = await ComplaintEvidence.find({ complaintId: complaint._id }).session(session);
        const payload = complaintToReport(complaint, evidence);
        await new Report(payload).validate();
        if (apply) await Report.create([payload], { session, timestamps: false });
      }
      if (apply) {
        await Violation.updateMany(
          { sourceType: "COMPLAINT", relatedComplaintId: complaint._id },
          { $set: { sourceType: "REPORT", sourceId: complaint._id, relatedReportId: complaint._id } },
          { session, runValidators: true, timestamps: false },
        );
      }
      return !existing;
    });
    if (isNew) inserted++;
    checked++;
  }
  if (apply) await Report.createIndexes();
  console.log(apply ? "Đã chuyển khiếu nại sang báo cáo." : "Đã kiểm tra thử, chưa ghi dữ liệu.", { checked, inserted });
}

migrate().catch(() => {
  console.error("Migration thất bại. Kiểm tra kết nối, định danh và dữ liệu nguồn trước khi chạy lại.");
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
