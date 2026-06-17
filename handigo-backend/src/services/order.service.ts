import { Types } from "mongoose";
import { randomBytes } from "crypto";
import { Order, IOrder } from "../models/order.model";
import { Service } from "../models/service.model";
import { ServiceOption } from "../models/serviceOption.model";
import { Address } from "../models/address.model";
import { AppError } from "../utils/appError";
import { DispatchService } from "./dispatch.service";

// ─── Helpers ────────────────────────────────────────────────────────────────

const PLATFORM_COMMISSION_RATE = 0.15; // 15 %

function generateOrderCode(): string {
  return `ORD-${randomBytes(6).toString("hex").toUpperCase()}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CreateOrderPayload {
  customerId: string;
  serviceId: string;
  servicePackageId?: string;
  selectedOptionIds?: string[];
  addressId: string;
  orderType?: "normal" | "urgent" | "scheduled" | "recurring";
  scheduledAt?: Date;
  problemDescription?: string;
  customerAttachments?: string[];
  promotionId?: string;
  voucherId?: string;
  paymentMethod: "wallet" | "bank" | "cash";
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const OrderService = {
  /**
   * Step 1 – Create a new booking order.
   *
   * Logic:
   *  1. Validate service, address, options.
   *  2. Calculate pricing snapshot.
   *  3. Persist order with status = "created".
   *  4. Hand off to DispatchService to find & assign the nearest provider.
   */
  async createOrder(payload: CreateOrderPayload): Promise<IOrder> {
    // 1. Validate service
    const service = await Service.findById(payload.serviceId);
    if (!service || !service.isActive) {
      throw new AppError("Dịch vụ không tồn tại hoặc đã ngừng hoạt động.", 404);
    }

    // 2. Validate address belongs to customer
    const address = await Address.findOne({
      _id: payload.addressId,
      userId: payload.customerId,
    });
    if (!address) {
      throw new AppError("Địa chỉ không hợp lệ.", 404);
    }

    // 3. Validate & snapshot selected options
    const optionIds = (payload.selectedOptionIds ?? []).map(
      (id) => new Types.ObjectId(id),
    );
    const options =
      optionIds.length > 0
        ? await ServiceOption.find({ _id: { $in: optionIds } })
        : [];

    const selectedOptionsSnapshot = options.map((opt) => ({
      optionId: opt._id as Types.ObjectId,
      name: opt.name,
      optionType: opt.optionType,
      price: opt.price,
    }));

    // 4. Calculate pricing — price comes entirely from selected ServiceOptions
    const bookingBasePrice = selectedOptionsSnapshot.reduce(
      (sum, o) => sum + (o.price ?? 0),
      0,
    );
    const totalAmount = bookingBasePrice;

    const platformCommissionAmount = Math.round(
      totalAmount * PLATFORM_COMMISSION_RATE,
    );
    const providerEarningAmount = totalAmount - platformCommissionAmount;

    // 5. Determine if inspection is required (repair service)
    const inspectionRequired = service.serviceType === "variable_price";

    // 6. Persist order
    const order = await Order.create({
      orderCode: generateOrderCode(),
      customerId: new Types.ObjectId(payload.customerId),
      serviceId: new Types.ObjectId(payload.serviceId),
      servicePackageId: payload.servicePackageId
        ? new Types.ObjectId(payload.servicePackageId)
        : null,
      selectedOptionIds: optionIds,
      selectedOptionsSnapshot,
      addressId: new Types.ObjectId(payload.addressId),
      orderType: payload.orderType ?? "normal",
      scheduledAt: payload.scheduledAt ?? null,
      status: "created",
      paymentMethod: payload.paymentMethod,
      paymentStatus: "unpaid",
      depositAmount: service.serviceType === "variable_price" ? bookingBasePrice : 0,
      inspectionRequired,
      hasAdditionalQuotation: false,
      problemDescription: payload.problemDescription ?? null,
      customerAttachments: payload.customerAttachments ?? [],
      pricing: {
        bookingAmount: totalAmount, // The amount including options for the current payment phase
        platformCommissionRate: PLATFORM_COMMISSION_RATE,
        platformCommissionAmount,
        providerEarningAmount,
        promotionDiscountAmount: 0,
        voucherDiscountAmount: 0,
        totalPaidAmount: totalAmount,
      },
      confirmation: {
        customerConfirmedAt: null,
        providerConfirmedAt: null,
      },
    });

    // 7. Trigger async dispatch (non-blocking – failures are logged, not thrown)
    DispatchService.dispatchOrder(order._id.toString(), {
      latitude: address.latitude,
      longitude: address.longitude,
      serviceCategoryId: service.categoryId.toString(),
    }).catch((err: unknown) =>
      console.error(`[OrderService] Dispatch failed for order ${order.orderCode}:`, err),
    );

    return order;
  },

  /**
   * Get paginated list of orders for a customer.
   */
  async getOrdersByCustomer(
    customerId: string,
    page = 1,
    limit = 10,
    filters: { status?: string; search?: string } = {},
  ): Promise<{ items: IOrder[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const skip = (page - 1) * limit;
    const conditions: any[] = [{ customerId: new Types.ObjectId(customerId) }];

    if (filters.status && filters.status !== "all" && filters.status !== "Tất cả") {
      conditions.push({ status: filters.status });
    }

    const search = filters.search?.trim();
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const matchedServices = await Service.find({
        name: { $regex: escapedSearch, $options: "i" },
      }).select("_id");
      const serviceIds = matchedServices.map((s) => s._id);

      conditions.push({
        $or: [
          { orderCode: { $regex: escapedSearch, $options: "i" } },
          { problemDescription: { $regex: escapedSearch, $options: "i" } },
          { serviceId: { $in: serviceIds } },
        ],
      });
    }

    const query = { $and: conditions };
    const [data, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("serviceId", "name image serviceType")
        .lean(),
      Order.countDocuments(query),
    ]);

    return {
      items: data as IOrder[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Get single order detail.
   */
  async getOrderById(orderId: string, userId: string): Promise<IOrder> {
    const order = await Order.findById(orderId)
      .populate("serviceId", "name image serviceType categoryId")
      .populate("addressId")
      .populate("providerId")
      .lean();

    if (!order) throw new AppError("Đơn hàng không tồn tại.", 404);

    // Only customer or assigned provider can view
    const isOwner = order.customerId.toString() === userId;
    const isProvider =
      order.providerId && order.providerId.toString() === userId;
    if (!isOwner && !isProvider) {
      throw new AppError("Bạn không có quyền xem đơn hàng này.", 403);
    }

    return order as IOrder;
  },

  /**
   * Customer cancel an order (only when status is "created" or "accepted").
   */
  async cancelOrder(
    orderId: string,
    userId: string,
    role: "customer" | "provider" | "admin",
    reason: string,
  ): Promise<IOrder> {
    const order = await Order.findById(orderId);
    if (!order) throw new AppError("Đơn hàng không tồn tại.", 404);

    const cancellableStatuses = ["created", "accepted"];
    if (!cancellableStatuses.includes(order.status)) {
      throw new AppError(
        `Không thể hủy đơn hàng ở trạng thái "${order.status}".`,
        400,
      );
    }

    if (
      role === "customer" &&
      order.customerId.toString() !== userId
    ) {
      throw new AppError("Bạn không có quyền hủy đơn hàng này.", 403);
    }

    order.status = "cancelled";
    order.cancellation = {
      cancelledBy: new Types.ObjectId(userId),
      cancelledByRole: role,
      reason,
      cancelledAt: new Date(),
    };
    await order.save();
    return order;
  },
};
