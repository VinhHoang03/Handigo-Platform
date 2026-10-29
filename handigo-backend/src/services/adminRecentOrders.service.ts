import { Order } from "../models/order.model";

/** Danh sách mới nhất toàn hệ thống, độc lập với kỳ thống kê doanh thu. */
export const getAdminRecentOrders = async ({ page, limit }: { page: number; limit: number }) => {
  const filter = { isDeleted: false };
  const [items, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit)
      .select("orderCode serviceId customerId pricing.totalPaidAmount status createdAt")
      .populate({ path: "serviceId", select: "name", match: { isDeleted: false } })
      .populate({ path: "customerId", select: "fullName", match: { isDeleted: false } }).lean(),
    Order.countDocuments(filter),
  ]);
  return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};
