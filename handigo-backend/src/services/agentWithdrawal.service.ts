import { z } from "zod";
import type { RequestUser } from "../middlewares/authContext";
import { listMyBankAccounts } from "./bankAccount.service";
import { createWithdrawal, previewWithdrawal, getMyWithdrawals, getMyWithdrawalById } from "./withdrawal.service";
import { agentActionResourceId } from "../utils/agentActionResourceId";
import { requireCustomerAction } from "./agentCustomerAccount.service";
import { AppError } from "../utils/appError";
import { ActionPreconditionError } from "../utils/actionPreconditionError";
import { idSchema } from "../ai/tools/implementations/booking.schemas";

export const agentWithdrawalSchema = z.object({ amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), bankAccountId: idSchema }).strict();
type WithdrawalArgs = z.infer<typeof agentWithdrawalSchema>;
const view = (item: NonNullable<Awaited<ReturnType<typeof getMyWithdrawalById>>>) => ({
  withdrawalId: String(item._id), amount: item.amount, status: item.status,
  createdAt: item.createdAt, reviewedAt: item.reviewedAt, path: "/customer/wallet",
  message: item.status === "pending" ? "Yêu cầu rút tiền đang chờ duyệt; chưa xác nhận tiền đã về ngân hàng."
    : item.status === "approved" ? "Yêu cầu rút tiền đã được duyệt theo trạng thái hệ thống; hãy kiểm tra tài khoản nhận tiền."
      : "Yêu cầu rút tiền đã bị từ chối; kiểm tra số dư và lịch sử ví để đối chiếu.",
});
const requireCustomer = (user: RequestUser) => { if (user.role !== "CUSTOMER") throw new AppError("Chỉ khách hàng được dùng chức năng này.", 403); };
export const AgentWithdrawalService = {
  async accounts(user: RequestUser) {
    requireCustomer(user);
    const accounts = await listMyBankAccounts(user);
    return { accounts: accounts.filter((item) => item.status === "active").map((item) => ({ bankAccountId: String(item._id),
      bankName: item.bankName, accountHolderName: item.accountHolderName, maskedAccountNumber: `••••${item.accountNumber.slice(-4)}`, isDefault: item.isDefault })),
      path: "/customer/bank-accounts", note: "Chọn tài khoản nhận tiền. Chưa có tài khoản hoạt động thì thêm tại mục Tài khoản ngân hàng; không gửi số tài khoản hoặc OTP vào chat." };
  },
  async preview(user: RequestUser, args: WithdrawalArgs) { requireCustomer(user); return previewWithdrawal(user, agentWithdrawalSchema.parse(args)); },
  async create(user: RequestUser, args: WithdrawalArgs, sessionId: string, actionId: string | undefined, expected: unknown) {
    const key = requireCustomerAction(user, actionId);
    const preview = z.object({ amount: z.number(), bankAccountId: idSchema, bankFingerprint: z.string().min(1) }).parse(expected);
    if (preview.amount !== args.amount || preview.bankAccountId !== args.bankAccountId) throw new AppError("Thông tin rút tiền không khớp bản xác nhận.", 409);
    let result;
    try {
      result = await createWithdrawal(user, agentWithdrawalSchema.parse(args), {
        resourceId: agentActionResourceId(user.id, sessionId, key), expectedBankFingerprint: preview.bankFingerprint,
      });
    } catch (error) {
      // Các lỗi nghiệp vụ này xảy ra trước ghi hoặc sau rollback; lỗi driver/kết quả commit chưa rõ vẫn phải đối soát.
      if (error instanceof AppError && error.statusCode < 500) throw new ActionPreconditionError(error.message);
      throw error;
    }
    if (!result) throw new AppError("Chưa xác định được kết quả rút tiền. Cần đối soát trước khi gửi lại.", 409);
    return view(result);
  },
  async list(user: RequestUser, args: Parameters<typeof getMyWithdrawals>[1]) {
    requireCustomer(user); const result = await getMyWithdrawals(user, args);
    return { items: result.items.map(view), pagination: result.pagination };
  },
  async detail(user: RequestUser, id: string) { requireCustomer(user); return view(await getMyWithdrawalById(user, id)); },
  async reconcile(user: RequestUser, args: WithdrawalArgs, sessionId: string, actionId?: string) {
    const key = requireCustomerAction(user, actionId);
    try {
      const item = await getMyWithdrawalById(user, String(agentActionResourceId(user.id, sessionId, key)));
      const bank = item.bankAccountId as unknown as { _id?: unknown };
      return item.amount === args.amount && String(bank?._id ?? item.bankAccountId) === args.bankAccountId ? view(item) : null;
    } catch (error) { if (error instanceof AppError && error.statusCode === 404) return null; throw error; }
  },
};
