import mongoose, { Types } from "mongoose";
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
import { DispatchService } from "./dispatch.service";
import {
  cancelOrderWithSettlement,
  getCancellationPreview,
} from "./orderCancellation.service";
import { Payment } from "../models/payment.model";
import { recordCompletedOrderSettlement } from "./wallet.service";
import { MatchingService } from "./matching.service";
import { emitToUser } from "../sockets/socketServer";
import { createNotificationRecord } from "./notification.service";

// ─── Helpers ────────────────────────────────────────────────────────────────

const DEFAULT_PLATFORM_COMMISSION_PERCENT = 15;
const PLATFORM_FEE_PERCENT_CONFIG_KEY = "PLATFORM_FEE_PERCENT";
const DEFAULT_APPOINTMENT_RESPONSE_MINUTES = 30;

function generateOrderCode(): string {
  return `ORD-${randomBytes(6).toString("hex").toUpperCase()}`;
}

function buildRecurringDates(
  start: Date,
  unit: "weekly" | "monthly",
  count: number,
): Date[] {
  return Array.from({ length: count }, (_, index) => {
    const occurrence = new Date(start);
    if (unit === "weekly") {
      occurrence.setDate(start.getDate() + index * 7);
      return occurrence;
    }

    const targetDay = start.getDate();
    occurrence.setDate(1);
    occurrence.setMonth(start.getMonth() + index);
    const lastDayOfMonth = new Date(
      occurrence.getFullYear(),
      occurrence.getMonth() + 1,
      0,
    ).getDate();
    occurrence.setDate(Math.min(targetDay, lastDayOfMonth));
    return occurrence;
  });
}

async function getProviderByUserId(providerUserId: string) {
  const provider = await Provider.findOne({
    userId: providerUserId,
    isDeleted: false,
  }).select("_id");
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

export async function dispatchOrderForMatching(orderId: string) {
  const order = await Order.findById(orderId).select(
    "addressId serviceId status readyForMatching",
  );
  if (!order || order.status !== "created" || !order.readyForMatching) return;

  const address = await Address.findById(order.addressId).select(
    "latitude longitude province ward",
  );
  if (!address) {
    throw new AppError("Địa chỉ không hợp lệ.", 404);
  }

  DispatchService.dispatchOrder(order._id.toString(), {
    latitude: address.latitude,
    longitude: address.longitude,
    serviceId: order.serviceId.toString(),
    province: address.province,
    ward: address.ward,
  }).catch((err: unknown) =>
    console.error(
      `[OrderService] Dispatch failed for order ${order._id}:`,
      err,
    ),
  );
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
  recurrenceUnit?: "weekly" | "monthly";
  recurrenceCount?: number;
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
    const requiresProviderConfirmation = ["scheduled", "recurring"].includes(orderType);
    if (requiresProviderConfirmation && !payload.preferredProviderId) {
      throw new AppError("Vui lòng chọn chuyên gia cụ thể cho lịch hẹn.", 400);
    }
    const validRecurrenceCount =
      payload.recurrenceUnit === "weekly"
        ? [1, 2, 3, 4].includes(payload.recurrenceCount || 0)
        : payload.recurrenceUnit === "monthly"
          ? [4, 8, 12].includes(payload.recurrenceCount || 0)
          : false;
    if (orderType === "recurring" && !validRecurrenceCount) {
      throw new AppError("Vui lòng chọn chu kỳ và số buổi định kỳ hợp lệ.", 400);
    }
    const occurrenceDates =
      orderType === "recurring" && scheduledAt
        ? buildRecurringDates(
            scheduledAt,
            payload.recurrenceUnit as "weekly" | "monthly",
            payload.recurrenceCount as number,
          )
        : scheduledAt
          ? [scheduledAt]
          : [];

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

    let appointmentProvider: Awaited<
      ReturnType<typeof MatchingService.findNearestProviders>
    >[number] | null = null;
    if (requiresProviderConfirmation && scheduledAt && payload.preferredProviderId) {
      const candidates = await MatchingService.findNearestProviders({
        latitude: address.latitude,
        longitude: address.longitude,
        serviceId: service._id.toString(),
        province: address.province,
        ward: address.ward,
        onlyProviderId: new Types.ObjectId(payload.preferredProviderId),
        limit: 1,
        requireOnline: false,
      });
      appointmentProvider = candidates[0] ?? null;
      if (!appointmentProvider) {
        throw new AppError(
          "Chuyên gia không còn phù hợp với dịch vụ hoặc khu vực đã chọn.",
          409,
        );
      }

      for (const occurrenceDate of occurrenceDates) {
        const conflictStart = new Date(occurrenceDate.getTime() - 60 * 60 * 1000);
        const slotEnd = new Date(occurrenceDate.getTime() + 60 * 60 * 1000);
        const hasConflict = await Order.exists({
          providerId: appointmentProvider.providerId,
          status: { $in: ["accepted", "in_progress"] },
          scheduledAt: { $gt: conflictStart, $lt: slotEnd },
          isDeleted: false,
        });
        if (hasConflict) {
          throw new AppError(
            `Chuyên gia đã có lịch vào ${occurrenceDate.toLocaleString("vi-VN")}.`,
            409,
          );
        }
      }
    }

    // 3. Validate & snapshot selected options
    const pricingSnapshot = await buildServicePricingSnapshot(
      service,
      payload.selectedOptionIds,
    );

    const inspectionRequired = service.serviceType === "variable_price";
    const platformCommissionPercent = await getNumberConfigValue(
      PLATFORM_FEE_PERCENT_CONFIG_KEY,
      DEFAULT_PLATFORM_COMMISSION_PERCENT,
    );
    const platformCommissionRate = inspectionRequired
      ? 0
      : Math.max(platformCommissionPercent, 0) / 100;
    // 4. Giá cố định gồm giá cơ bản và phụ phí; giá linh hoạt chỉ thu tiền cọc.
    const totalAmount = pricingSnapshot.bookingAmount;

    const platformCommissionAmount = Math.round(
      totalAmount * platformCommissionRate,
    );
    const providerEarningAmount = totalAmount - platformCommissionAmount;

    // 6. Persist order
    const recurringGroupId = orderType === "recurring" ? new Types.ObjectId() : null;
    const orderDates = orderType === "normal" ? [null] : occurrenceDates;
    const orderDocuments = orderDates.map((orderDate, index) => ({
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
      scheduledAt: orderDate,
      bookingStatus: requiresProviderConfirmation
        ? "awaiting_provider"
        : "not_required",
      paymentDueAt: null,
      recurringGroupId,
      recurrenceUnit: orderType === "recurring" ? payload.recurrenceUnit : null,
      occurrenceNumber: orderType === "recurring" ? index + 1 : null,
      totalOccurrences: orderType === "recurring" ? orderDates.length : null,
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
    }));
    const createdOrders = await Order.insertMany(
      orderDocuments as Array<Partial<IOrder>>,
    );
    const order = createdOrders[0] as unknown as IOrder;

    if (requiresProviderConfirmation && scheduledAt && appointmentProvider) {
      const responseMinutes = Math.max(
        await getNumberConfigValue(
          "APPOINTMENT_RESPONSE_MINUTES",
          DEFAULT_APPOINTMENT_RESPONSE_MINUTES,
        ),
        5,
      );
      const responseDeadline = new Date(
        Math.min(
          Date.now() + responseMinutes * 60 * 1000,
          scheduledAt.getTime(),
        ),
      );
      const assignment = await OrderAssignment.create({
        orderId: order._id,
        providerId: appointmentProvider.providerId,
        assignmentType: "appointment",
        status: "pending",
        assignedAt: new Date(),
        responseDeadline,
      });

      emitToUser(appointmentProvider.userId.toString(), "assignment:new", {
        assignmentId: assignment._id.toString(),
        orderId: order._id.toString(),
        responseDeadline,
      });
      await createNotificationRecord({
        userId: appointmentProvider.userId,
        type: "ORDER",
        title: "Yêu cầu lịch hẹn mới",
        content: `Khách hàng muốn đặt lịch ${scheduledAt.toLocaleString("vi-VN")}.`,
        data: { orderId: order._id, assignmentId: assignment._id },
      });
    }

    return order;
  },

  async selectAppointmentProvider(
    orderId: string,
    customerId: string,
    providerId: string,
  ): Promise<IOrder> {
    if (!Types.ObjectId.isValid(orderId) || !Types.ObjectId.isValid(providerId)) {
      throw new AppError("Đơn hàng hoặc chuyên gia không hợp lệ.", 400);
    }

    const order = await Order.findOne({
      _id: orderId,
      customerId,
      status: "created",
      bookingStatus: "rejected",
      orderType: { $in: ["scheduled", "recurring"] },
      isDeleted: false,
    });
    if (!order || !order.scheduledAt) {
      throw new AppError("Lịch hẹn không ở trạng thái có thể chọn lại chuyên gia.", 409);
    }

    const address = await Address.findOne({
      _id: order.addressId,
      userId: customerId,
    });
    if (!address) throw new AppError("Địa chỉ không hợp lệ.", 404);

    const candidates = await MatchingService.findNearestProviders({
      latitude: address.latitude,
      longitude: address.longitude,
      serviceId: order.serviceId.toString(),
      province: address.province,
      ward: address.ward,
      onlyProviderId: new Types.ObjectId(providerId),
      limit: 1,
      requireOnline: false,
    });
    const candidate = candidates[0];
    if (!candidate) {
      throw new AppError("Chuyên gia không còn phù hợp với lịch hẹn này.", 409);
    }

    const appointmentOrders = order.recurringGroupId
      ? await Order.find({
          recurringGroupId: order.recurringGroupId,
          status: "created",
          isDeleted: false,
        }).select("_id scheduledAt")
      : [order];
    for (const appointmentOrder of appointmentOrders) {
      if (!appointmentOrder.scheduledAt) continue;
      const conflictStart = new Date(
        appointmentOrder.scheduledAt.getTime() - 60 * 60 * 1000,
      );
      const slotEnd = new Date(
        appointmentOrder.scheduledAt.getTime() + 60 * 60 * 1000,
      );
      const hasConflict = await Order.exists({
        _id: { $nin: appointmentOrders.map((item) => item._id) },
        providerId: candidate.providerId,
        status: { $in: ["accepted", "in_progress"] },
        scheduledAt: { $gt: conflictStart, $lt: slotEnd },
        isDeleted: false,
      });
      if (hasConflict) {
        throw new AppError(
          `Chuyên gia đã có lịch vào ${appointmentOrder.scheduledAt.toLocaleString("vi-VN")}.`,
          409,
        );
      }
    }

    const responseMinutes = Math.max(
      await getNumberConfigValue(
        "APPOINTMENT_RESPONSE_MINUTES",
        DEFAULT_APPOINTMENT_RESPONSE_MINUTES,
      ),
      5,
    );
    const responseDeadline = new Date(
      Math.min(
        Date.now() + responseMinutes * 60 * 1000,
        order.scheduledAt.getTime(),
      ),
    );
    const claimedOrder = await Order.findOneAndUpdate(
      { _id: order._id, status: "created", bookingStatus: "rejected" },
      {
        $set: {
          preferredProviderId: candidate.providerId,
          bookingStatus: "awaiting_provider",
          paymentDueAt: null,
        },
      },
      { returnDocument: "after", runValidators: true },
    );
    if (!claimedOrder) {
      throw new AppError("Lịch hẹn vừa được cập nhật bởi yêu cầu khác.", 409);
    }
    if (order.recurringGroupId) {
      await Order.updateMany(
        {
          recurringGroupId: order.recurringGroupId,
          status: "created",
          bookingStatus: "rejected",
        },
        {
          $set: {
            preferredProviderId: candidate.providerId,
            bookingStatus: "awaiting_provider",
            paymentDueAt: null,
          },
        },
        { runValidators: true },
      );
    }

    try {
      const assignment = await OrderAssignment.create({
        orderId: order._id,
        providerId: candidate.providerId,
        assignmentType: "appointment",
        status: "pending",
        assignedAt: new Date(),
        responseDeadline,
      });
      emitToUser(candidate.userId.toString(), "assignment:new", {
        assignmentId: assignment._id.toString(),
        orderId: order._id.toString(),
        responseDeadline,
      });
      await createNotificationRecord({
        userId: candidate.userId,
        type: "ORDER",
        title: "Yêu cầu lịch hẹn mới",
        content: `Khách hàng muốn đặt lịch ${order.scheduledAt.toLocaleString("vi-VN")}.`,
        data: { orderId: order._id, assignmentId: assignment._id },
      });
    } catch (error) {
      await Order.updateMany(
        order.recurringGroupId
          ? { recurringGroupId: order.recurringGroupId, bookingStatus: "awaiting_provider" }
          : { _id: order._id, bookingStatus: "awaiting_provider" },
        {
          $set: {
            bookingStatus: "rejected",
            preferredProviderId: null,
          },
        },
      );
      throw error;
    }

    return claimedOrder;
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

  async getRecurringSeries(orderId: string, customerId: string): Promise<IOrder[]> {
    const anchorOrder = await Order.findById(orderId).lean();
    if (!anchorOrder) throw new AppError("Đơn hàng không tồn tại.", 404);
    if (anchorOrder.customerId.toString() !== customerId) {
      throw new AppError("Bạn không có quyền xem chuỗi lịch này.", 403);
    }
    if (anchorOrder.orderType !== "recurring" || !anchorOrder.recurringGroupId) {
      throw new AppError("Đơn hàng không thuộc lịch định kỳ.", 400);
    }

    const orders = await Order.find({
      recurringGroupId: anchorOrder.recurringGroupId,
      customerId: anchorOrder.customerId,
      isDeleted: false,
    })
      .sort({ occurrenceNumber: 1 })
      .lean();

    return orders as IOrder[];
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

    if (["scheduled", "recurring"].includes(order.orderType)) {
      if (order.bookingStatus !== "confirmed") {
        throw new AppError("Lịch hẹn chưa được khách hàng thanh toán và xác nhận.", 409);
      }
      if (
        order.scheduledAt &&
        order.scheduledAt.getTime() - 30 * 60 * 1000 > Date.now()
      ) {
        throw new AppError("Chỉ có thể bắt đầu trước giờ hẹn tối đa 30 phút.", 400);
      }
      if (order.paymentMethod !== "cash" && order.paymentStatus !== "paid") {
        throw new AppError("Lịch hẹn chưa được thanh toán thành công.", 409);
      }
      await Provider.findByIdAndUpdate(provider._id, {
        $set: { availabilityStatus: "busy" },
      });
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

    if (order.inspectionRequired && order.paymentStatus !== "paid") {
      throw new AppError(
        "Không thể hoàn thành đơn khi khách hàng chưa thanh toán đủ báo giá.",
        400,
      );
    }
    if (order.paymentMethod !== "cash" && order.paymentStatus !== "paid") {
      throw new AppError(
        "Không thể hoàn thành đơn khi thanh toán điện tử chưa được xác nhận.",
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

    const session = await mongoose.startSession();
    let completedOrder: IOrder | null = null;

    try {
      await session.withTransaction(async () => {
        const transactionalOrder = await Order.findById(orderId).session(session);
        const transactionalProvider = await Provider.findById(provider._id).session(
          session,
        );
        if (!transactionalOrder || !transactionalProvider) {
          throw new AppError("Không tìm thấy dữ liệu đơn hàng hoặc nhà cung cấp.", 404);
        }
        if (
          !transactionalOrder.providerId ||
          transactionalOrder.providerId.toString() !==
            transactionalProvider._id.toString()
        ) {
          throw new AppError("Bạn không có quyền thực hiện thao tác này.", 403);
        }
        if (transactionalOrder.status !== "in_progress") {
          throw new AppError(
            `Không thể hoàn thành đơn hàng ở trạng thái "${transactionalOrder.status}".`,
            400,
          );
        }
        if (
          transactionalOrder.inspectionRequired &&
          transactionalOrder.paymentStatus !== "paid"
        ) {
          throw new AppError(
            "Không thể hoàn thành đơn khi khách hàng chưa thanh toán đủ báo giá.",
            400,
          );
        }
        if (
          transactionalOrder.paymentMethod !== "cash" &&
          transactionalOrder.paymentStatus !== "paid"
        ) {
          throw new AppError(
            "Không thể hoàn thành đơn khi thanh toán điện tử chưa được xác nhận.",
            400,
          );
        }

        const totalAmount = transactionalOrder.pricing.totalPaidAmount;
        const commissionRate = transactionalOrder.inspectionRequired
          ? 0
          : Math.max(transactionalOrder.pricing.platformCommissionRate, 0);
        const platformCommissionAmount = Math.min(
          Math.round(totalAmount * commissionRate),
          totalAmount,
        );
        transactionalOrder.pricing.platformCommissionAmount =
          platformCommissionAmount;
        transactionalOrder.pricing.providerEarningAmount =
          totalAmount - platformCommissionAmount;
        if (transactionalOrder.inspectionRequired) {
          transactionalOrder.pricing.platformCommissionRate = 0;
        }

        if (transactionalOrder.paymentMethod === "cash") {
          const cashPayment = await Payment.findOne({
            orderId: transactionalOrder._id,
            method: "cash",
            status: { $in: ["pending", "paid"] },
            isDeleted: false,
          }).session(session);
          if (!cashPayment) {
            throw new AppError(
              "Không tìm thấy giao dịch tiền mặt hợp lệ của đơn hàng.",
              409,
            );
          }
          if (cashPayment.status === "pending") {
            cashPayment.status = "paid";
            cashPayment.paidAt = new Date();
            await cashPayment.save({ session });
          }
          transactionalOrder.paymentStatus = "paid";
        }

        await recordCompletedOrderSettlement(
          transactionalOrder,
          transactionalProvider,
          session,
        );

        transactionalOrder.status = "completed";
        transactionalOrder.completionEvidenceImages = evidenceImages;
        transactionalOrder.completionNote = completionNote?.trim() || null;
        transactionalOrder.confirmation.providerConfirmedAt = new Date();
        await transactionalOrder.save({ session });

        transactionalProvider.totalCompletedOrders += 1;
        transactionalProvider.availabilityStatus = "online";
        await transactionalProvider.save({ session });

        completedOrder = transactionalOrder;
      });
    } finally {
      await session.endSession();
    }

    if (!completedOrder) {
      throw new AppError("Không thể hoàn tất đơn hàng.", 500);
    }
    return completedOrder;
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
    return cancelOrderWithSettlement({
      orderId,
      actorId: userId,
      role,
      reason,
    });
  },

  async previewCancellation(
    orderId: string,
    userId: string,
    role: "customer" | "provider" | "admin",
    scope: "single" | "series" = "single",
  ) {
    if (scope === "single") {
      const preview = await getCancellationPreview({
        orderId,
        actorId: userId,
        role,
      });
      return {
        scope,
        orderCount: 1,
        policyVersion: preview.policyVersion,
        paidAmount: preview.paidAmount,
        refundAmount: preview.refundAmount,
        cancellationFee: preview.cancellationFee,
        providerCompensation: preview.providerCompensation,
        platformRetainedAmount: preview.platformRetainedAmount,
        canCancel: preview.canCancel,
        items: [preview],
      };
    }

    if (role !== "customer") {
      throw new AppError("Chỉ khách hàng được xem trước hủy chuỗi lịch.", 403);
    }

    const anchorOrder = await Order.findById(orderId).lean();
    if (!anchorOrder || anchorOrder.isDeleted) {
      throw new AppError("Đơn hàng không tồn tại.", 404);
    }
    if (anchorOrder.customerId.toString() !== userId) {
      throw new AppError("Bạn không có quyền hủy chuỗi lịch này.", 403);
    }
    if (
      anchorOrder.orderType !== "recurring" ||
      !anchorOrder.recurringGroupId ||
      !anchorOrder.scheduledAt
    ) {
      throw new AppError("Đơn hàng không thuộc lịch định kỳ.", 400);
    }

    const orders = await Order.find({
      recurringGroupId: anchorOrder.recurringGroupId,
      customerId: anchorOrder.customerId,
      scheduledAt: { $gte: anchorOrder.scheduledAt },
      status: { $in: ["created", "accepted"] },
      isDeleted: false,
    })
      .select("_id")
      .sort({ scheduledAt: 1 })
      .lean();
    if (orders.length === 0) {
      throw new AppError("Không còn buổi nào có thể hủy trong chuỗi lịch này.", 409);
    }

    const items = await Promise.all(
      orders.map((order) =>
        getCancellationPreview({
          orderId: order._id.toString(),
          actorId: userId,
          role,
        }),
      ),
    );

    return {
      scope,
      orderCount: items.length,
      policyVersion: items[0].policyVersion,
      paidAmount: items.reduce((sum, item) => sum + item.paidAmount, 0),
      refundAmount: items.reduce((sum, item) => sum + item.refundAmount, 0),
      cancellationFee: items.reduce((sum, item) => sum + item.cancellationFee, 0),
      providerCompensation: items.reduce(
        (sum, item) => sum + item.providerCompensation,
        0,
      ),
      platformRetainedAmount: items.reduce(
        (sum, item) => sum + item.platformRetainedAmount,
        0,
      ),
      canCancel: items.every((item) => item.canCancel),
      items,
    };
  },

  async cancelRecurringSeries(
    orderId: string,
    customerId: string,
    reason: string,
  ): Promise<{ cancelledCount: number; orders: IOrder[] }> {
    const anchorOrder = await Order.findById(orderId).lean();
    if (!anchorOrder) throw new AppError("Đơn hàng không tồn tại.", 404);
    if (anchorOrder.customerId.toString() !== customerId) {
      throw new AppError("Bạn không có quyền hủy chuỗi lịch này.", 403);
    }
    if (
      anchorOrder.orderType !== "recurring" ||
      !anchorOrder.recurringGroupId ||
      !anchorOrder.scheduledAt
    ) {
      throw new AppError("Đơn hàng không thuộc lịch định kỳ.", 400);
    }

    const cancellableOrders = await Order.find({
      recurringGroupId: anchorOrder.recurringGroupId,
      customerId: anchorOrder.customerId,
      scheduledAt: { $gte: anchorOrder.scheduledAt },
      status: { $in: ["created", "accepted"] },
      isDeleted: false,
    }).sort({ scheduledAt: 1 });

    if (cancellableOrders.length === 0) {
      throw new AppError("Không còn buổi nào có thể hủy trong chuỗi lịch này.", 409);
    }

    const cancelledOrders: IOrder[] = [];
    for (const recurringOrder of cancellableOrders) {
      const cancelledOrder = await cancelOrderWithSettlement({
        orderId: recurringOrder._id.toString(),
        actorId: customerId,
        role: "customer",
        reason,
      });
      cancelledOrders.push(cancelledOrder);
    }

    return {
      cancelledCount: cancelledOrders.length,
      orders: cancelledOrders,
    };
  },
};
