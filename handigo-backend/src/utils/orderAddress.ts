import type { IOrder } from "../models/order.model";

// Đơn mới dùng địa chỉ tại thời điểm đặt; đơn cũ tiếp tục đọc liên kết hiện có.
export const withOrderAddress = <T extends { addressId?: unknown; addressSnapshot?: IOrder["addressSnapshot"] }>(order: T): T => {
  if (!order.addressSnapshot) return order;
  const address = order.addressId;
  const id = address && typeof address === "object" && "_id" in address ? address._id : address;
  return { ...order, addressId: { _id: id, ...order.addressSnapshot } };
};
