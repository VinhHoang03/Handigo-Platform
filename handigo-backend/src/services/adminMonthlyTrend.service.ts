import { Order } from "../models/order.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { AppError } from "../utils/appError";
import type { AdminDashboardQuery } from "../validations/adminDashboard.validator";

const OFFSET = 7 * 3_600_000;
const monthStart = (date: Date) => {
  const local = new Date(date.getTime() + OFFSET);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - OFFSET);
};

export const getAdminMonthlyTrend = async (query: AdminDashboardQuery, now = new Date()) => {
  const toDate = query.toDate ?? now;
  if (query.fromDate && query.fromDate > toDate) throw new AppError("Ngày bắt đầu không được lớn hơn ngày kết thúc.", 400);
  const end = new Date(toDate.getTime() + OFFSET);
  const sixMonthsAgo = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 5, 1) - OFFSET);
  const fromDate = query.fromDate && query.fromDate < sixMonthsAgo ? monthStart(query.fromDate) : sixMonthsAgo;
  const match = { isDeleted: false, createdAt: { $gte: fromDate, $lte: toDate } };
  const month = { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "Asia/Ho_Chi_Minh" } };
  const [orders, revenue] = await Promise.all([
    Order.aggregate<{ _id: string; count: number }>([
      { $match: match }, { $group: { _id: month, count: { $sum: 1 } } },
    ]),
    WalletTransaction.aggregate<{ _id: string; amount: number }>([
      { $match: { ...match, type: "platform_fee", direction: "out", status: "success" } },
      { $group: { _id: month, amount: { $sum: "$amount" } } },
    ]),
  ]);
  const counts = new Map(orders.map(item => [item._id, item.count]));
  const amounts = new Map(revenue.map(item => [item._id, item.amount]));
  const cursor = new Date(fromDate.getTime() + OFFSET);
  const points: Array<{ month: string; orders: number; platformRevenue: number }> = [];
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 7);
    points.push({ month: key, orders: counts.get(key) ?? 0, platformRevenue: amounts.get(key) ?? 0 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return { fromDate, toDate, points };
};
