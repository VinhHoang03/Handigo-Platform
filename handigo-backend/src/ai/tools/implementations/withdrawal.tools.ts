import { z } from "zod";
import type { AgentTool } from "../tool.interface";
import { AgentWithdrawalService as withdrawal, agentWithdrawalSchema } from "../../../services/agentWithdrawal.service";
import { withdrawalListQuerySchema } from "../../../validations/withdrawal.validator";
import { idSchema } from "./booking.schemas";

const list = withdrawalListQuerySchema.omit({ limit: true }).strict();
const id = z.object({ withdrawalId: idSchema }).strict();
export const getWithdrawalAccountsTool: AgentTool<Record<string, never>> = {
  name: "get_withdrawal_accounts", description: "Danh sách tài khoản ngân hàng hoạt động của chính khách, số tài khoản được che. Dùng để khách chọn nơi nhận tiền; không tự thêm/sửa ngân hàng.",
  inputSchema: z.object({}).strict(), roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
  execute: (ctx) => withdrawal.accounts(ctx.user),
};
export const createWithdrawalTool: AgentTool<z.infer<typeof agentWithdrawalSchema>> = {
  name: "create_withdrawal", description: "Tạo yêu cầu rút số tiền nguyên VND từ ví về tài khoản ngân hàng khách đã chọn. Kiểm tra giới hạn, số dư, ngân hàng hoạt động và quyền sở hữu. Cần nút xác nhận; tiền chuyển sang chờ duyệt, chưa phải chuyển khoản thành công. Không tự gửi lại nếu kết quả chưa rõ.",
  inputSchema: agentWithdrawalSchema, roles: ["CUSTOMER"], mutates: true, requiresConfirmation: true,
  preview: (ctx, args) => withdrawal.preview(ctx.user, args),
  execute: (ctx, args) => withdrawal.create(ctx.user, args, ctx.sessionId, ctx.actionId, ctx.confirmedPreview),
  reconcile: (ctx, args) => withdrawal.reconcile(ctx.user, args, ctx.sessionId, ctx.actionId),
  reply: (result) => ({ state: "COMPLETED", message: (result as { message: string }).message }),
};
export const getMyWithdrawalsTool: AgentTool<z.infer<typeof list>> = {
  name: "get_my_withdrawals", description: "Tra yêu cầu rút tiền của chính khách theo trang và trạng thái chờ duyệt/đã duyệt/từ chối; không trả hồ sơ admin hoặc ngân hàng đầy đủ.",
  inputSchema: list, roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
  execute: (ctx, args) => withdrawal.list(ctx.user, { ...args, limit: 10 }),
};
export const getWithdrawalTool: AgentTool<z.infer<typeof id>> = {
  name: "get_withdrawal", description: "Xem số tiền và trạng thái yêu cầu rút tiền thuộc khách. Không hứa thời hạn duyệt hoặc khẳng định ngân hàng đã nhận tiền.",
  inputSchema: id, roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
  execute: (ctx, args) => withdrawal.detail(ctx.user, args.withdrawalId),
};
