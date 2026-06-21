import { Types } from "mongoose";
import { randomBytes } from "crypto";
import { Order, IOrder } from "../models/order.model";
import { OrderAssignment } from "../models/orderAssignment.model";
import { Provider } from "../models/provider.model";
import { Service } from "../models/service.model";
import { ServiceOption } from "../models/serviceOption.model";
import { Address } from "../models/address.model";
import { AppError } from "../utils/appError";
import { DispatchService } from "./dispatch.service";
import { getNumberConfigValue } from "./systemConfig.service";
import { isAddressInProviderWorkingAreas } from "../utils/providerArea";

// ─── Helpers ────────────────────────────────────────────────────────────────

const DEFAULT_PLATFORM_COMMISSION_PERCENT = 15;
const PLATFORM_FEE_PERCENT_CONFIG_KEY = "PLATFORM_FEE_PERCENT";
const QUOTATION_SERVICE_DEPOSIT_AMOUNT_CONFIG_KEY = "QUOTATION_SERVICE_DEPOSIT_AMOUNT";

function generateOrderCode(): string {
  return `ORD-${randomBytes(6).toString("hex").toUpperCase()}`;
}

async function getProviderByUserId(providerUserId: string) {
  const provider = await Provider.findOne({ userId: providerUserId }).select("_id");
  if (!provider) {
    throw new AppError("Provider không tồn tại.", 404);
  }
  return provider;
}

function getPopulatedId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "object" && value !== null && "_id" in value) {
    return String((value as { _id: unknown })._id);
  }
  return String(value);
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

    const providersForService = await Provider.find({
      serviceIds: service._id,
      verified: true,
      isDeleted: false,
    })
      .select("workingAreas")
      .lean();
    const hasProviderInArea = providersForService.some((provider) =>
      isAddressInProviderWorkingAreas(provider.workingAreas, address),
    );
    if (!hasProviderInArea) {
      throw new AppError(
        "Hiện chưa có Provider phục vụ dịch vụ này tại địa chỉ đã chọn.",
        422,
      );
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

    const platformCommissionPercent = await getNumberConfigValue(
      PLATFORM_FEE_PERCENT_CONFIG_KEY,
      DEFAULT_PLATFORM_COMMISSION_PERCENT,
    );
    const platformCommissionRate = Math.max(platformCommissionPercent, 0) / 100;
    const quotationDepositAmount = await getNumberConfigValue(
      QUOTATION_SERVICE_DEPOSIT_AMOUNT_CONFIG_KEY,
      service.depositAmount ?? 0,
    );

    // 4. Dịch vụ giá linh hoạt chỉ thu tiền cọc; dịch vụ cố định giữ cách tính hiện có.
    const bookingBasePrice =
      service.serviceType === "variable_price"
        ? quotationDepositAmount
        : selectedOptionsSnapshot.reduce(
            (sum, o) => sum + (o.price ?? 0),
            0,
          );
    const totalAmount = bookingBasePrice;

    const platformCommissionAmount = Math.round(
      totalAmount * platformCommissionRate,
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
        platformCommissionRate,
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
      serviceId: service._id.toString(),
      province: address.province,
      ward: address.ward,
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
   * Get newest orders assigned to the currently logged-in provider.
   */
  async getRecentOrdersByProvider(
    providerUserId: string,
    limit = 5,
  ): Promise<IOrder[]> {
    const provider = await getProviderByUserId(providerUserId);

    const safeLimit = Math.min(Math.max(limit, 1), 20);
    const pendingAssignments = await OrderAssignment.find({
      providerId: provider._id,
      status: "pending",
    }).select("orderId");
    const pendingOrderIds = pendingAssignments.map((assignment) => assignment.orderId);

    return Order.find({
      $or: [
        { providerId: provider._id },
        { _id: { $in: pendingOrderIds } },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .populate("customerId", "fullName avatar phone")
      .populate("serviceId", "name image serviceType")
      .populate("addressId")
      .lean() as Promise<IOrder[]>;
  },

  /**
   * Get paginated list of orders assigned to the logged-in provider.
   */
  async getOrdersByProvider(
    providerUserId: string,
    page = 1,
    limit = 10,
    filters: { status?: string; search?: string } = {},
  ): Promise<{
    items: IOrder[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const provider = await getProviderByUserId(providerUserId);
    const skip = (page - 1) * limit;
    const conditions: Record<string, unknown>[] = [{ providerId: provider._id }];

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
        .populate("customerId", "fullName avatar phone")
        .populate("serviceId", "name image serviceType")
        .populate("addressId")
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
      .populate("customerId", "fullName avatar phone email")
      .populate("serviceId", "name image serviceType categoryId depositAmount fixedPrice")
      .populate("addressId")
      .populate({
        path: "providerId",
        populate: { path: "userId", select: "fullName phone avatar" },
      })
      .lean();

    if (!order) throw new AppError("Đơn hàng không tồn tại.", 404);

    const customerId = getPopulatedId(order.customerId);
    const isCustomer = customerId === userId;

    const provider = await Provider.findOne({ userId }).select("_id");
    const providerIdOnOrder = getPopulatedId(order.providerId);
    const isAssignedProvider =
      !!provider && providerIdOnOrder === provider._id.toString();

    let hasPendingAssignment = false;
    if (provider && !isCustomer && !isAssignedProvider) {
      const pending = await OrderAssignment.findOne({
        orderId: order._id,
        providerId: provider._id,
        status: "pending",
        responseDeadline: { $gte: new Date() },
      }).lean();
      hasPendingAssignment = !!pending;
    }

    if (!isCustomer && !isAssignedProvider && !hasPendingAssignment) {
      throw new AppError("Bạn không có quyền xem đơn hàng này.", 403);
    }

    return order as IOrder;
  },

  /**
   * Provider starts working on an accepted fixed-price order.
   */
  async startOrder(orderId: string, providerUserId: string): Promise<IOrder> {
    const provider = await getProviderByUserId(providerUserId);
    const order = await Order.findById(orderId);
    if (!order) throw new AppError("Đơn hàng không tồn tại.", 404);

    if (!order.providerId || order.providerId.toString() !== provider._id.toString()) {
      throw new AppError("Bạn không có quyền thực hiện thao tác này.", 403);
    }

    if (order.status !== "accepted") {
      throw new AppError(
        `Không thể bắt đầu đơn hàng ở trạng thái "${order.status}".`,
        400,
      );
    }

    if (order.inspectionRequired) {
      throw new AppError(
        "Đơn hàng báo giá cần tạo báo giá sửa chữa trước khi bắt đầu.",
        400,
      );
    }

    order.status = "in_progress";
    await order.save();
    return order;
  },

  /**
   * Provider marks an in-progress order as completed.
   */
  async completeOrder(
    orderId: string,
    providerUserId: string,
    completionEvidenceImages: string[],
    completionNote?: string,
  ): Promise<IOrder> {
    const provider = await getProviderByUserId(providerUserId);
    const order = await Order.findById(orderId);
    if (!order) throw new AppError("Đơn hàng không tồn tại.", 404);

    if (!order.providerId || order.providerId.toString() !== provider._id.toString()) {
      throw new AppError("Bạn không có quyền thực hiện thao tác này.", 403);
    }

    if (order.status !== "in_progress") {
      throw new AppError(
        `Không thể hoàn thành đơn hàng ở trạng thái "${order.status}".`,
        400,
      );
    }

    const evidenceImages = completionEvidenceImages
      .map((url) => url.trim())
      .filter(Boolean);
    if (evidenceImages.length === 0) {
      throw new AppError(
        "Vui lòng tải lên ít nhất một ảnh bằng chứng hoàn thành.",
        400,
      );
    }
    if (evidenceImages.length > 5) {
      throw new AppError(
        "Chỉ được tải lên tối đa 5 ảnh bằng chứng hoàn thành.",
        400,
      );
    }

    order.status = "completed";
    order.completionEvidenceImages = evidenceImages;
    order.completionNote = completionNote?.trim() || null;
    order.confirmation.providerConfirmedAt = new Date();
    if (order.paymentStatus === "unpaid" || order.paymentStatus === "partially_paid") {
      order.paymentStatus = "paid";
    }
    await order.save();

    await Provider.findByIdAndUpdate(provider._id, {
      $inc: { totalCompletedOrders: 1 },
      availabilityStatus: "online",
    });

    return order;
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

    if (role === "customer" && order.customerId.toString() !== userId) {
      throw new AppError("Bạn không có quyền hủy đơn hàng này.", 403);
    }

    if (role === "provider") {
      const provider = await getProviderByUserId(userId);
      if (!order.providerId || order.providerId.toString() !== provider._id.toString()) {
        throw new AppError("Bạn không có quyền hủy đơn hàng này.", 403);
      }
    }

    order.status = "cancelled";
    order.cancellation = {
      cancelledBy: new Types.ObjectId(userId),
      cancelledByRole: role,
      reason,
      cancelledAt: new Date(),
    };
    await order.save();

    if (role === "provider" && order.providerId) {
      await Provider.findByIdAndUpdate(order.providerId, {
        availabilityStatus: "online",
      });
    }

    return order;
  },
};
