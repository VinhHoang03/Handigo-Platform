import { z } from "zod";
import type { AgentTool } from "../tool.interface";
import { getRewardOverview, getRewardHistory, getMyRewardVouchers } from "../../../services/reward.service";
import { getCurrentWallet, getWalletTransactionHistory } from "../../../services/wallet.service";
import { walletTransactionQuerySchema } from "../../../validations/wallet.validator";
import { AgentCustomerAccountService as account } from "../../../services/agentCustomerAccount.service";

const empty = z.object({}).strict();
const page = z.object({ page: z.number().int().min(1).max(1000).default(1) }).strict();
const offer = z.object({ offerId: z.string().trim().min(1).max(100) }).strict();
const amount = z.object({ amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) }).strict();
const deposit = z.object({ orderCode: z.string().regex(/^\d{1,16}$/, "Mã khoản nạp không hợp lệ.") }).strict();
const history = z.object({ page: page.shape.page, type: z.enum(["deposit", "payment", "refund", "adjustment"]).optional(),
  fromDate: z.string().datetime({ offset: true }).optional(), toDate: z.string().datetime({ offset: true }).optional() }).strict();
const reply = (result: unknown) => {
  const data = result as { message: string; checkoutUrl?: string | null };
  return { state: "COMPLETED" as const, message: data.message + (data.checkoutUrl ? `\n[Thanh toán nạp ví](${data.checkoutUrl})` : "") };
};
export const getMyRewardsTool: AgentTool<z.infer<typeof empty>> = {
  name: "get_my_rewards", description: "Tra số điểm thực tế và các gói đổi voucher còn hoạt động, điều kiện và offerId. Không tự đổi điểm hoặc suy đoán quyền lợi.",
  inputSchema: empty, roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
  execute: (ctx) => getRewardOverview(ctx.user.id),
};
export const getRewardHistoryTool: AgentTool<z.infer<typeof page>> = {
  name: "get_reward_history", description: "Xem lịch sử tích/đổi điểm của chính khách, mỗi trang 5 mục.",
  inputSchema: page, roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
  execute: async (ctx, args) => {
    const result = await getRewardHistory(ctx.user.id, args.page);
    return { ...result, items: result.items.map((item) => ({ kind: item.kind, points: item.points,
      balanceAfter: item.balanceAfter, description: item.description, createdAt: item.createdAt })) };
  },
};
export const getMyRewardVouchersTool: AgentTool<z.infer<typeof page>> = {
  name: "get_my_reward_vouchers", description: "Xem voucher riêng khách sở hữu và điều kiện/hạn dùng. Danh sách này không chứng minh mã áp được vào đơn cụ thể; dùng công cụ voucher đặt đơn để kiểm tra.",
  inputSchema: page, roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
  execute: (ctx, args) => getMyRewardVouchers(ctx.user.id, args.page),
};
export const redeemRewardTool: AgentTool<z.infer<typeof offer>> = {
  name: "redeem_reward", description: "Đổi điểm lấy đúng ưu đãi khách chọn từ get_my_rewards. Phải xác nhận số điểm bị trừ và điều kiện voucher; không tự đổi chỉ vì khách hỏi mã tốt nhất.",
  inputSchema: offer, roles: ["CUSTOMER"], mutates: true, requiresConfirmation: true,
  preview: (ctx, args) => account.previewReward(ctx.user.id, args.offerId),
  execute: (ctx, args) => account.redeem(ctx.user, args.offerId, ctx.confirmedPreview, ctx.actionId),
  reconcile: (ctx, args) => account.reconcileReward(ctx.user, args.offerId, ctx.actionId), reply,
};
export const getMyWalletTool: AgentTool<z.infer<typeof empty>> = {
  name: "get_my_wallet", description: "Tra số dư ví hiện tại của chính khách. Không dùng kết quả lượt cũ để kết luận đủ tiền.",
  inputSchema: empty, roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
  execute: (ctx) => getCurrentWallet(ctx.user),
};
export const getWalletHistoryTool: AgentTool<z.infer<typeof history>> = {
  name: "get_wallet_history", description: "Tra lịch sử ví của khách theo loại, khoảng ngày và trang; trả mã khoản nạp để đối soát. Không nhầm khoản nạp với thanh toán đơn.",
  inputSchema: history, roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
  execute: async (ctx, args) => {
    const result = await getWalletTransactionHistory(ctx.user, walletTransactionQuerySchema.parse({ ...args, limit: 10 }));
    return { pagination: result.pagination, items: result.items.map((item) => ({ type: item.type, amount: item.amount,
      direction: item.direction, status: item.status, balanceAfter: item.balanceAfter,
      orderCode: item.gatewayOrderCode, description: item.description, createdAt: item.createdAt })) };
  },
};
export const createWalletDepositTool: AgentTool<z.infer<typeof amount>> = {
  name: "create_wallet_deposit", description: "Tạo liên kết PayOS nạp ví với số tiền nguyên VND khách yêu cầu. Cần nút xác nhận trước khi tạo. Chỉ tạo QR/liên kết; chưa ghi nhận tiền vào ví. Không tạo lại nếu kết quả cũ chưa rõ.",
  inputSchema: amount, roles: ["CUSTOMER"], mutates: true, requiresConfirmation: true,
  preview: async (_ctx, args) => ({ title: "Tạo liên kết nạp ví", amount: args.amount, paymentMethod: "bank",
    note: "Bạn cần thanh toán liên kết PayOS; ví chỉ được cộng khi backend xác minh đã nhận đủ tiền." }),
  execute: (ctx, args) => account.createDeposit(ctx.user, args.amount, ctx.actionId),
  reconcile: (ctx, args) => account.reconcileDeposit(ctx.user, args.amount, ctx.actionId), reply,
};
export const getWalletDepositStatusTool: AgentTool<z.infer<typeof deposit>> = {
  name: "get_wallet_deposit_status", description: "Đối soát khoản nạp của khách với PayOS bằng mã orderCode thực tế lấy từ lịch sử ví/kết quả tạo. Không tin ảnh chuyển khoản hoặc lời khách là đã nhận tiền.",
  inputSchema: deposit, roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
  execute: (ctx, args) => account.statusDeposit(ctx.user, args.orderCode), reply,
};
export const cancelWalletDepositTool: AgentTool<z.infer<typeof deposit>> = {
  name: "cancel_wallet_deposit", description: "Hủy riêng liên kết nạp ví đang chờ sau xác nhận và đối soát PayOS. Không hủy đơn dịch vụ, không rút hoặc hoàn tiền. Đã nhận tiền thì trả kết quả đối soát.",
  inputSchema: deposit, roles: ["CUSTOMER"], mutates: true, requiresConfirmation: true,
  preview: (ctx, args) => account.previewCancelDeposit(ctx.user, args.orderCode),
  execute: (ctx, args) => account.cancelDeposit(ctx.user, args.orderCode),
  reconcile: (ctx, args) => account.reconcileCancelDeposit(ctx.user, args.orderCode), reply,
};
