import assert from "node:assert/strict";
import { mock } from "node:test";
import { Types } from "mongoose";
import { getProviderOverview, getProviderEarnings } from "../services/dashboard.service";
import { providerDashboardQuerySchema } from "../validations/dashboard.validator";
import { Provider } from "../models/provider.model";
import { Wallet } from "../models/wallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { WithdrawRequest } from "../models/withdrawRequest.model";
import { Order } from "../models/order.model";

// Chỉ giả lập collection để kiểm tra nguồn thu nhập và ranh giới ngày Việt Nam.
async function run() {
  const user = { id: new Types.ObjectId().toString(), role: "PROVIDER" as const };
  const providerId = new Types.ObjectId(), otherUser = new Types.ObjectId().toString();
  mock.method(Date, "now", () => Date.parse("2030-11-01T00:30:00+07:00"));
  const day = providerDashboardQuerySchema.parse({ fromDate: "2030-11-01", toDate: "2030-11-01" });
  assert.equal(day.fromDate!.toISOString(), "2030-10-31T17:00:00.000Z");
  assert.equal(day.toDate!.toISOString(), "2030-11-01T16:59:59.999Z");
  assert(!providerDashboardQuerySchema.safeParse({ fromDate: "2030-11-02", toDate: "2030-11-01" }).success);
  assert(!providerDashboardQuerySchema.safeParse({ fromDate: "không phải ngày" }).success);
  const instant = providerDashboardQuerySchema.parse({ fromDate: "2030-10-31T18:00:00Z" });
  assert.equal(instant.fromDate!.getTime(), day.fromDate!.getTime());
  type Row = { userId: string; type: string; amount: number; status: string; isDeleted: boolean; createdAt: Date; metadata?: { systemRevenueOnly?: boolean } };
  const row = (type: string, amount: number, date = "2030-11-01T00:00:00+07:00", extra: Partial<Row> = {}): Row =>
    ({ userId: user.id, type, amount, status: "success", isDeleted: false, createdAt: new Date(date), ...extra });
  const rows = [row("provider_earning", 200000), row("platform_fee", 20000),
    row("provider_earning", 100000), row("platform_fee", 10000),
    row("deposit", 500000), row("withdraw", 50000), row("refund", 60000),
    row("provider_earning", 800000, undefined, { status: "pending" }),
    row("provider_earning", 800000, undefined, { status: "failed" }),
    row("provider_earning", 800000, undefined, { isDeleted: true }),
    row("provider_earning", 800000, undefined, { userId: otherUser }),
    row("platform_fee", 40000, undefined, { metadata: { systemRevenueOnly: true } }),
    row("provider_earning", 500000, "2030-10-31T23:59:59+07:00"),
    row("provider_earning", 500000, "2030-12-01T00:00:00+07:00"),
    row("provider_earning", 10000, "2030-11-30T23:59:59+07:00"),
    ...Array.from({ length: 8 }, () => row("provider_earning", 1000))];
  mock.method(Provider, "findOne", (filter: { userId: Types.ObjectId }) => Promise.resolve(String(filter.userId) === user.id
    ? { _id: providerId, availabilityStatus: "online", averageRating: 4.8 } : null) as never);
  mock.method(Wallet, "findOne", () => Promise.resolve({ balance: 9000000, pendingBalance: 0 }) as never);
  mock.method(Order, "countDocuments", () => Promise.resolve(100) as never);
  mock.method(WithdrawRequest, "aggregate", async () => [] as never);
  const ranges: Array<{ $gte?: Date; $lte?: Date }> = [];
  const evaluate = (expression: unknown, item: Row): unknown => {
    if (typeof expression === "string" && expression.startsWith("$")) return item[expression.slice(1) as keyof Row];
    if (!expression || typeof expression !== "object") return expression;
    const value = expression as { $cond?: unknown[]; $eq?: unknown[]; $multiply?: unknown[] };
    if (value.$eq) return evaluate(value.$eq[0], item) === evaluate(value.$eq[1], item);
    if (value.$cond) return evaluate(value.$cond[evaluate(value.$cond[0], item) ? 1 : 2], item);
    if (value.$multiply) return value.$multiply.reduce<number>((total, term) => total * Number(evaluate(term, item)), 1);
    throw Error("Biểu thức kiểm thử chưa được hỗ trợ.");
  };
  mock.method(WalletTransaction, "aggregate", async (pipeline: unknown[]) => {
    const stages = pipeline as Array<{ $match?: { userId: Types.ObjectId; status: string; isDeleted: boolean;
      type?: { $in: string[] }; createdAt?: { $gte?: Date; $lte?: Date }; "metadata.systemRevenueOnly"?: { $ne: boolean } };
      $group?: { _id: null | { $dateToString: { timezone: string } }; total?: { $sum: unknown }; amount?: { $sum: unknown } };
      $facet?: unknown; $project?: Record<string, unknown> }>;
    const match = stages[0].$match!;
    assert.equal(String(match.userId), user.id); assert.equal(match.status, "success"); assert.equal(match.isDeleted, false);
    if (stages.some((stage) => stage.$facet)) return [{ items: [], total: [] }] as never;
    ranges.push(match.createdAt ?? {});
    const included = rows.filter((item) => item.userId === String(match.userId) && item.status === match.status && item.isDeleted === match.isDeleted
      && (!match.type || match.type.$in.includes(item.type))
      && (!match["metadata.systemRevenueOnly"] || item.metadata?.systemRevenueOnly !== match["metadata.systemRevenueOnly"].$ne)
      && (!match.createdAt?.$gte || item.createdAt >= match.createdAt.$gte) && (!match.createdAt?.$lte || item.createdAt <= match.createdAt.$lte));
    const group = stages.find((stage) => stage.$group)!.$group!;
    if (group._id === null) return [{ total: included.reduce((sum, item) => sum + Number(evaluate(group.total!.$sum, item)), 0) }] as never;
    assert.equal(group._id.$dateToString.timezone, "Asia/Ho_Chi_Minh", "Biểu đồ provider phải chia ngày/tuần/tháng theo giờ Việt Nam.");
    const project = stages.find((stage) => stage.$project)!.$project!;
    const label = Object.keys(project).find((key) => project[key] === "$_id")!;
    return [{ [label]: "2030-11-01", amount: included.reduce((sum, item) => sum + Number(evaluate(group.amount!.$sum, item)), 0) }] as never;
  });
  const overview = await getProviderOverview(user, providerDashboardQuerySchema.parse({}));
  assert.equal(overview.monthlyEarnings, 288000, "Thu nhập gồm mọi quyết toán thành công trong tháng, sau phí; không cộng nạp/rút ví, dữ liệu lỗi hoặc khách khác.");
  assert.notEqual(overview.monthlyEarnings, overview.walletBalance);
  assert.equal(ranges[0].$gte!.toISOString(), "2030-10-31T17:00:00.000Z");
  assert.equal(ranges[0].$lte!.toISOString(), "2030-11-30T16:59:59.999Z");
  const earning = await getProviderEarnings(user, day);
  assert.equal(earning.earningsByDay[0].amount, 278000, "Giao dịch lúc 00h Việt Nam thuộc đúng ngày, không lọt giao dịch tháng trước.");
  assert.equal(earning.completedOrders.amount, 278000);
  await assert.rejects(() => getProviderOverview({ ...user, id: otherUser }, day), /Không tìm thấy hồ sơ/);
  rows.length = 0;
  assert.equal((await getProviderOverview(user, day)).monthlyEarnings, 0, "Không có giao dịch thì thu nhập bằng 0.");
  console.log("Đạt tổng quan provider: thu nhập quyết toán sau phí, tách số dư/nạp/rút ví, không giới hạn 5 đơn, đúng tài khoản và ranh giới ngày/tháng Việt Nam.");
}
void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => mock.restoreAll());
