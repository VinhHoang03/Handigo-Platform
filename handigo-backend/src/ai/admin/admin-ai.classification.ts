import type { z } from "zod";
import { AdminAIAssessment } from "./admin-ai.models";
import { SupportTicket } from "../../models/supportTicket.model";
import { Schema, model } from "mongoose";
import { AppError } from "../../utils/appError";
import type { correctionSchema } from "./admin-ai.validation";

export const AdminAIClassificationCorrection = model("AdminAIClassificationCorrection", new Schema({
  assessmentId: { type: Schema.Types.ObjectId, ref: "AdminAIAssessment", required: true },
  ticketId: { type: Schema.Types.ObjectId, ref: "SupportTicket", required: true },
  actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  before: { type: Schema.Types.Mixed, required: true }, after: { type: Schema.Types.Mixed, required: true }, reason: { type: String, required: true },
}, { timestamps: true }).index({ assessmentId: 1, createdAt: -1 }));

export async function classificationContext(assessmentId: string) {
  const assessment = await AdminAIAssessment.findOne({ _id: assessmentId, feature: "support_classification" }).lean();
  if (!assessment) throw new AppError("Không tìm thấy kết quả phân loại.", 404);
  const ticket = await SupportTicket.findOne({ _id: assessment.sourceId, isDeleted: false }).select("category priority status updatedAt").lean();
  if (!ticket) throw new AppError("Không tìm thấy phiếu hỗ trợ.", 404);
  const corrections = await AdminAIClassificationCorrection.find({ assessmentId }).sort({ createdAt: -1 }).limit(10).lean();
  return { ticket, corrections };
}
export async function correctClassification(_assessmentId: string, _adminId: string, _input: z.infer<typeof correctionSchema>) {
  throw new AppError("Chức năng AI phân loại phản ánh đã được ngừng sử dụng.", 410);
}
