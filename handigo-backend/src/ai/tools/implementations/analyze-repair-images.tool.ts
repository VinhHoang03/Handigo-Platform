import { z } from "zod";
import type { AgentTool } from "../tool.interface";
import { agentRequestAttachments, bookingAttachmentsSchema } from "../../agent/booking-attachments";
import { analyzeRepairImages } from "../../../services/repairImageAnalysis.service";
import { getRepairAdviceTool } from "./get-repair-advice.tool";
import { repairSafetyAdvice } from "../../knowledge/repair-advice";
import { AppError } from "../../../utils/appError";

const schema = z.object({ description: z.string().trim().max(3000), customerAttachments: bookingAttachmentsSchema.optional() }).strict();
export const analyzeRepairImagesTool: AgentTool<z.infer<typeof schema>> = {
  name: "analyze_repair_images", description: "Đọc ảnh hiện trạng/mã lỗi khách đã tải trong đúng phiên khi họ muốn tư vấn từ ảnh. Chỉ quan sát dấu hiệu, không chẩn đoán chắc chắn; kết hợp bài Mẹo sửa chữa hiện hành để tư vấn. Mặc định lấy ảnh tin nhắn mới nhất, không tự phân tích ảnh bằng chứng/khiếu nại hoặc ảnh cũ không được yêu cầu.",
  inputSchema: schema, roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
  execute: async (ctx, args) => {
    const safety = repairSafetyAdvice(args.description);
    if (safety) return safety;
    const urls = agentRequestAttachments(ctx.session, args.customerAttachments);
    if (!urls.length) throw new AppError("Vui lòng đính kèm ảnh hiện trạng hoặc mô tả sự cố bằng chữ.", 400);
    const observations = await analyzeRepairImages(urls, args.description, ctx.signal);
    const hazards = observations.visibleHazards;
    if (hazards.length) {
      const labels = { smoke: "có khói", sparks: "có tia lửa", water_near_electricity: "nước gần ổ cắm", damaged_wire: "bị rò điện" };
      const urgent = repairSafetyAdvice(hazards.map((item) => labels[item]).join(", "));
      if (urgent) return { ...urgent, imageObservations: observations,
        observationNote: "Ảnh có dấu hiệu nguy hiểm có thể xảy ra. Không đến gần hoặc thử thiết bị để xác nhận." };
    }
    if (!observations.relevant || !observations.readable) return { imageObservations: observations,
      status: "needs_details", note: "Chưa đủ dữ liệu ảnh phù hợp để tư vấn; hỏi lại phần chưa rõ, không suy đoán lỗi." };
    const description = [args.description, observations.device, ...observations.observations,
      ...observations.errorCodes.map((code) => `Mã hiển thị: ${code}`)].filter(Boolean).join(". ").slice(0, 4000);
    const advice = await getRepairAdviceTool.execute(ctx, { description });
    return { imageObservations: observations, advice, note: "Quan sát từ ảnh có thể sai. Phân biệt dấu hiệu nhìn thấy với mô tả khách; chỉ dùng bài viết khớp thiết bị/triệu chứng, không giải mã lỗi khi chưa biết hãng/model. Chưa có dấu hiệu nguy hiểm trong ảnh không chứng minh an toàn." };
  },
  reply: getRepairAdviceTool.reply,
};
