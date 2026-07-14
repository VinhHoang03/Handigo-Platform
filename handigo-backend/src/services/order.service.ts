import { Types } from "mongoose";
import { randomBytes } from "crypto";
import { Order, IOrder } from "../models/order.model";
import { OrderAssignment } from "../models/orderAssignment.model";
import { Provider } from "../models/provider.model";
import { Service } from "../models/service.model";
import { Category } from "../models/category.model";
import { Address } from "../models/address.model";
import { AppError } from "../utils/appError";
import { getNumberConfigValue } from "./systemConfig.service";
import { buildServicePricingSnapshot } from "./servicePricing.service";

// ─── Helpers ────────────────────────────────────────────────────────────────

const DEFAULT_PLATFORM_COMMISSION_PERCENT = 15;
const PLATFORM_FEE_PERCENT_CONFIG_KEY = "PLATFORM_FEE_PERCENT";

function generateOrderCode(): string {
  return `ORD-${randomBytes(6).toString("hex").toUpperCase()}`;
}

async function getProviderByUserId(providerUserId: string) {
  const provider = await Provider.findOne({ userId: providerUserId }).select(
    "_id",
  );
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
  scheduledAt?: Date | string;
  problemDescription?: string;
  customerAttachments?: string[];
  promotionId?: string;
  voucherId?: string;
  preferredProviderId?: string;
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
    if (!payload.paymentMethod || !["wallet", "bank", "cash"].includes(payload.paymentMethod)) {
      throw new AppError("Phương thức thanh toán không hợp lệ.", 400);
    }
    const orderType = payload.orderType ?? "normal";
    const scheduledAt = payload.scheduledAt
      ? new Date(payload.scheduledAt)
      : null;
    if (
      scheduledAt &&
      Number.isNaN(scheduledAt.getTime())
    ) {
      throw new AppError("Thời gian thực hiện không hợp lệ.", 400);
    }
    if (
      ["scheduled", "recurring"].includes(orderType) &&
      (!scheduledAt || scheduledAt.getTime() <= Date.now())
    ) {
      throw new AppError(
        "Vui lòng chọn thời gian thực hiện trong tương lai.",
        400,
      );
    }

    // 1. Validate service
    if (!Types.ObjectId.isValid(payload.serviceId)) {
      throw new AppError("Dịch vụ không hợp lệ.", 400);
    }
    const service = await Service.findOne({
      _id: payload.serviceId,
      isActive: true,
      isDeleted: false,
    });
    if (!service) {
      throw new AppError("Dịch vụ không tồn tại hoặc đã ngừng hoạt động.", 404);
    }
    const activeCategory = await Category.exists({
      _id: service.categoryId,
      isActive: true,
      isDeleted: false,
    });
    if (!activeCategory) {
      throw new AppError("Danh mục của dịch vụ đang ngừng hoạt động.", 400);
    }
    if (payload.servicePackageId) {
      throw new AppError(
        "Gói riêng của provider chưa được hỗ trợ trong luồng đặt dịch vụ tự động.",
        400,
      );
    }
    if (payload.paymentMethod === "wallet") {
      throw new AppError(
        "Thanh toán đơn dịch vụ bằng ví chưa được hỗ trợ. Vui lòng chọn chuyển khoản hoặc tiền mặt.",
        400,
      );
    }
    if (
      payload.preferredProviderId &&
      !Types.ObjectId.isValid(payload.preferredProviderId)
    ) {
      throw new AppError("Chuyên gia ưu tiên không hợp lệ.", 400);
    }

    // 2. Validate address belongs to customer
    if (!Types.ObjectId.isValid(payload.addressId)) {
      throw new AppError("Địa chỉ không hợp lệ.", 400);
    }
    const address = await Address.findOne({
      _id: payload.addressId,
      userId: payload.customerId,
    });
    if (!address) {
      throw new AppError("Địa chỉ không hợp lệ.", 404);
    }

    // 3. Validate & snapshot selected options
    const pricingSnapshot = await buildServicePricingSnapshot(
      service,
      payload.selectedOptionIds,
    );

    const platformCommissionPercent = await getNumberConfigValue(
      PLATFORM_FEE_PERCENT_CONFIG_KEY,
      DEFAULT_PLATFORM_COMMISSION_PERCENT,
    );
    const platformCommissionRate = Math.max(platformCommissionPercent, 0) / 100;
    // 4. Giá cố định gồm giá cơ bản và phụ phí; giá linh hoạt chỉ thu tiền cọc.
    const totalAmount = pricingSnapshot.bookingAmount;

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
      preferredProviderId: payload.preferredProviderId
        ? new Types.ObjectId(payload.preferredProviderId)
        : null,
      serviceId: new Types.ObjectId(payload.serviceId),
      servicePackageId: null,
      selectedOptionIds: pricingSnapshot.optionIds,
      selectedOptionsSnapshot: pricingSnapshot.selectedOptionsSnapshot,
      addressId: new Types.ObjectId(payload.addressId),
      orderType,
      scheduledAt: orderType === "normal" ? null : scheduledAt,
      status: "created",
      paymentMethod: payload.paymentMethod,
      paymentStatus: "unpaid",
      readyForMatching: false,
      matchingStartedAt: null,
      depositAmount: pricingSnapshot.depositAmount,
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
  ): Promise<{
    items: IOrder[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const skip = (page - 1) * limit;
    const conditions: any[] = [{ customerId: new Types.ObjectId(customerId) }];

    if (
      filters.status &&
      filters.status !== "all" &&
      filters.status !== "Tất cả"
    ) {
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
    const pendingOrderIds = pendingAssignments.map(
      (assignment) => assignment.orderId,
    );

    return Order.find({
      $or: [{ providerId: provider._id }, { _id: { $in: pendingOrderIds } }],
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
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const provider = await getProviderByUserId(providerUserId);
    const skip = (page - 1) * limit;
    const conditions: Record<string, unknown>[] = [
      { providerId: provider._id },
    ];

    if (
      filters.status &&
      filters.status !== "all" &&
      filters.status !== "Tất cả"
    ) {
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
      .populate(
        "serviceId",
        "name image serviceType categoryId depositAmount fixedPrice",
      )
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

    if (
      !order.providerId ||
      order.providerId.toString() !== provider._id.toString()
    ) {
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

    if (
      !order.providerId ||
      order.providerId.toString() !== provider._id.toString()
    ) {
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
    if (
      order.paymentStatus === "unpaid" ||
      order.paymentStatus === "partially_paid"
    ) {
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
      if (
        !order.providerId ||
        order.providerId.toString() !== provider._id.toString()
      ) {
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
