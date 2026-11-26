import { z } from "zod";
import type { AgentTool } from "../tool.interface";
import { idSchema } from "./booking.schemas";
import { AgentUnpaidOrderService } from "../../../services/agentUnpaidOrder.service";

const schema = z.object({ orderId: idSchema }).strict();
export const discardUnpaidOrderTool: AgentTool<z.infer<typeof schema>> = {
  name: "discard_unpaid_order", description: "Xóa đơn đã tạo nhưng chưa thanh toán, chưa đưa vào tìm thợ, sau khi khách xác nhận riêng. Khác với bỏ bản nháp chat và hủy đơn. Backend kiểm tra/đóng QR trước; không xóa khi đã trả tiền hoặc chưa rõ kết quả. Lấy ID từ danh sách đơn thuộc khách.",
  inputSchema: schema, roles: ["CUSTOMER"], mutates: true, requiresConfirmation: true,
  preview: (ctx, args) => AgentUnpaidOrderService.preview(ctx.user.id, args.orderId),
  execute: (ctx, args) => AgentUnpaidOrderService.discard(ctx.user.id, args.orderId, ctx.confirmedPreview),
  reconcile: (ctx, args) => AgentUnpaidOrderService.reconcile(ctx.user.id, args.orderId, ctx.actionCreatedAt),
  reply: result => ({ state: "COMPLETED", message: (result as { message: string }).message }),
};
