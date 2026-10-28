import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { createFeedback, getOrderFeedbackContext, updateMyFeedback } from "./feedback.service";
import { bookingAttachmentsSchema } from "../ai/agent/booking-attachments";
import { createFeedbackSchema } from "../validations/feedback.validator";
import { AppError } from "../utils/appError";
import { ActionPreconditionError } from "../utils/actionPreconditionError";
import { agentActionResourceId } from "../utils/agentActionResourceId";

export const agentFeedbackSchema = createFeedbackSchema.omit({ images: true }).extend({
  mode: z.enum(["create", "update"]).default("create"), customerAttachments: bookingAttachmentsSchema.optional(),
}).strict();
type Arguments = z.infer<typeof agentFeedbackSchema>;

export const AgentFeedbackService = {
  async get(userId: string, orderId: string) {
    const { order, feedback, canReview, reason } = await getOrderFeedbackContext(userId, orderId);
    return { orderId: String(order._id), orderCode: order.orderCode, canReview, reason,
      feedback: feedback ? { id: String(feedback._id), rating: feedback.rating, comment: feedback.comment,
        images: feedback.images, updatedAt: feedback.updatedAt.toISOString() } : null };
  },
  async preview(userId: string, args: Arguments) {
    const current = await this.get(userId, args.orderId);
    if (!current.canReview) throw new AppError(current.reason ?? "Đơn chưa đủ điều kiện đánh giá.", 409);
    if (args.mode === "create" && current.feedback) throw new AppError("Đơn đã có đánh giá. Nếu muốn sửa, hãy yêu cầu sửa đánh giá hiện tại.", 409);
    if (args.mode === "update" && !current.feedback) throw new AppError("Đơn chưa có đánh giá để sửa. Vui lòng tạo đánh giá mới.", 409);
    return { title: args.mode === "update" ? "Sửa đánh giá dịch vụ" : "Đánh giá dịch vụ", orderId: current.orderId,
      orderCode: current.orderCode, rating: args.rating, description: args.comment === undefined ? current.feedback?.comment ?? "" : args.comment ?? "",
      customerAttachments: args.customerAttachments ?? current.feedback?.images ?? [], feedbackId: current.feedback?.id ?? null,
      feedbackVersion: current.feedback?.updatedAt ?? null,
      note: "Chỉ gửi đánh giá sau khi bạn xác nhận. Đánh giá không tạo yêu cầu khiếu nại hoặc hoàn tiền." };
  },
  async submit(userId: string, args: Arguments, expected: unknown, sessionId?: string, actionId?: string) {
    let current;
    try { current = await this.preview(userId, args); }
    catch (error) {
      if (error instanceof AppError && error.statusCode < 500) throw new ActionPreconditionError(error.message);
      throw error;
    }
    if (!isDeepStrictEqual(JSON.parse(JSON.stringify(current)), expected)) throw new ActionPreconditionError("Đánh giá đã thay đổi. Vui lòng kiểm tra và xác nhận lại.");
    const payload = { rating: args.rating, comment: current.description, images: current.customerAttachments };
    let result;
    try {
      result = args.mode === "update" && current.feedbackId
        ? await updateMyFeedback(userId, current.feedbackId, { rating: args.rating,
          ...(args.comment !== undefined ? { comment: current.description } : {}),
          ...(args.customerAttachments !== undefined ? { images: args.customerAttachments } : {}) }, current.feedbackVersion!)
        : await createFeedback(userId, { ...payload, orderId: args.orderId },
          sessionId && actionId ? agentActionResourceId(userId, sessionId, actionId) : undefined);
    } catch (error) {
      if (error instanceof AppError && error.statusCode < 500) throw new ActionPreconditionError(error.message);
      if (args.mode === "create" && error && typeof error === "object" && "code" in error && error.code === 11000) {
        throw new ActionPreconditionError("Đơn vừa có đánh giá từ yêu cầu khác. Vui lòng kiểm tra đánh giá hiện tại.");
      }
      throw error;
    }
    return { orderId: args.orderId, orderCode: current.orderCode, feedbackId: String(result._id), rating: result.rating,
      message: args.mode === "update" ? "Đã cập nhật đánh giá dịch vụ." : "Đã gửi đánh giá dịch vụ." };
  },
  async reconcile(userId: string, args: Arguments, expected: unknown, sessionId: string, actionId: string, createdAt: string) {
    const current = await this.get(userId, args.orderId);
    const preview = z.object({ rating: z.number(), description: z.string(), customerAttachments: z.array(z.string()),
      feedbackId: z.string().nullable() }).parse(expected);
    const feedback = current.feedback;
    const expectedId = args.mode === "update" ? preview.feedbackId : String(agentActionResourceId(userId, sessionId, actionId));
    if (!feedback || feedback.id !== expectedId || feedback.rating !== preview.rating
      || (feedback.comment ?? "") !== preview.description || !isDeepStrictEqual(feedback.images, preview.customerAttachments)
      || Date.parse(feedback.updatedAt) < Date.parse(createdAt)) return null;
    return { orderId: args.orderId, orderCode: current.orderCode, feedbackId: feedback.id, rating: feedback.rating,
      message: "Đã kiểm tra và xác nhận đánh giá đã được lưu đúng nội dung." };
  },
};
