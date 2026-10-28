import { Types } from "mongoose";
import { Order } from "../models/order.model";
import { OrderStatus } from "../models/orderStatus.model";

/** Đơn cũ thiếu mốc bắt đầu chỉ dùng lịch sử thực hiện, không lấy ngày tạo đơn. */
export const findOverdueOrders = async (now: Date, overdueHours: number) => Order.aggregate<{
  _id: Types.ObjectId;
  orderCode: string;
  customerId: Types.ObjectId;
  providerId: Types.ObjectId;
  updatedAt: Date;
}>([
  { $match: { status: "in_progress", isDeleted: false, "overdueReview.escalatedAt": null } },
  { $lookup: {
    from: OrderStatus.collection.name,
    let: { orderId: "$_id", startedAt: "$schedule.expectedStartAt" },
    pipeline: [
      { $match: { status: "in_progress", isDeleted: false, $expr: {
        $and: [ { $eq: ["$orderId", "$$orderId"] }, { $eq: [{ $ifNull: ["$$startedAt", null] }, null] } ],
      } } },
      { $sort: { createdAt: -1, _id: -1 } },
      { $limit: 1 },
      { $project: { createdAt: 1 } },
    ],
    as: "executionHistory",
  } },
  { $set: { executionStartedAt: { $ifNull: ["$schedule.expectedStartAt", { $arrayElemAt: ["$executionHistory.createdAt", 0] }] } } },
  { $match: { executionStartedAt: { $type: "date", $lte: new Date(now.getTime() - overdueHours * 3600000) } } },
  { $sort: { executionStartedAt: 1, _id: 1 } },
  { $limit: 100 },
  { $project: { _id: 1, orderCode: 1, customerId: 1, providerId: 1, updatedAt: 1 } },
]);
