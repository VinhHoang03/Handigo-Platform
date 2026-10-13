import { Types } from "mongoose";
import { Order } from "../models/order.model";
import { Provider } from "../models/provider.model";
import { AppError } from "../utils/appError";

export const getQuotationOrderForProvider = async (
  orderId: string,
  providerUserId: string,
) => {
  if (!Types.ObjectId.isValid(orderId)) {
    throw new AppError("ID đơn hàng không hợp lệ.", 400);
  }

  const [order, provider] = await Promise.all([
    Order.findById(orderId),
    Provider.findOne({
      userId: providerUserId,
      verified: true,
      isDeleted: false,
    }).select("_id"),
  ]);
  if (!order) throw new AppError("Đơn hàng không tồn tại.", 404);
  if (!provider) throw new AppError("Provider không tồn tại.", 404);
  if (
    !order.providerId ||
    order.providerId.toString() !== provider._id.toString()
  ) {
    throw new AppError(
      "Bạn không phải provider được phân công cho đơn hàng này.",
      403,
    );
  }
  if (!order.inspectionRequired) {
    throw new AppError("Đơn hàng này không yêu cầu báo giá sửa chữa.", 400);
  }

  return order;
};

