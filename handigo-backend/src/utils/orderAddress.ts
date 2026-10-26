import type { IOrder } from "../models/order.model";

// Đơn mới dùng địa chỉ tại thời điểm đặt; đơn cũ tiếp tục đọc liên kết hiện có.
export const withOrderAddress = <T extends { addressId?: unknown; addressSnapshot?: IOrder["addressSnapshot"] }>(order: T): T => {
  if (!order.addressSnapshot) return order;
  const address = order.addressId;
  const id = address && typeof address === "object" && "_id" in address ? address._id : address;
  return { ...order, addressId: { _id: id, ...order.addressSnapshot } };
};

// Đề nghị chưa nhận chỉ được chứa khu vực, kể cả khi địa chỉ chỉ dùng một lần.
export const withAssignmentArea = <T extends { addressId?: unknown; addressSnapshot?: IOrder["addressSnapshot"] }>(order: T | null) => {
  if (!order) return order;
  const { addressSnapshot, ...value } = order;
  const address = order.addressId as { _id?: unknown; ward?: string; province?: string } | null;
  return { ...value, addressId: {
    _id: address?._id ?? null,
    ward: addressSnapshot?.ward ?? address?.ward,
    province: addressSnapshot?.province ?? address?.province,
  } };
};
