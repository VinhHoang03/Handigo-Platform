import type { IOrder } from "../models/order.model";

// Đơn mới dùng địa chỉ tại thời điểm đặt; đơn cũ tiếp tục đọc liên kết hiện có.
export const withOrderAddress = <T extends { addressId?: unknown; addressSnapshot?: IOrder["addressSnapshot"] }>(order: T): T => {
  if (!order.addressSnapshot) return order;
  const address = order.addressId;
  const id = address && typeof address === "object" && "_id" in address ? address._id : address;
  return { ...order, addressId: { _id: id, ...order.addressSnapshot } };
};

// Đề nghị gửi riêng cho thợ gồm địa chỉ thực hiện, không kèm thông tin liên hệ.
export const withAssignmentArea = <T extends { addressId?: unknown; addressSnapshot?: IOrder["addressSnapshot"] }>(order: T | null) => {
  if (!order) return order;
  const { addressSnapshot, addressId, ...value } = order;
  const address = addressId as { _id?: unknown; fullAddress?: string; ward?: string; province?: string } | null;
  return { ...value, addressId: {
    _id: address?._id ?? null,
    fullAddress: addressSnapshot?.fullAddress ?? address?.fullAddress,
    ward: addressSnapshot?.ward ?? address?.ward,
    province: addressSnapshot?.province ?? address?.province,
  } };
};
