import mongoose, { Types } from "mongoose";
import { randomBytes } from "crypto";
import { earnOrderRewards } from "./reward.service";
import { Order, IOrder } from "../models/order.model";
import { OrderAssignment } from "../models/orderAssignment.model";
import { Provider } from "../models/provider.model";
import { Service } from "../models/service.model";
import { Category } from "../models/category.model";
import { Address } from "../models/address.model";
import { ensureAddressCoordinates } from "./address.service";
import { AppError } from "../utils/appError";
import { ActionPreconditionError } from "../utils/actionPreconditionError";
import { getBookingPolicy, getNumberConfigValue } from "./systemConfig.service";
import { getOrderInterval, lockProviderSchedule, assertProviderSchedule } from "./providerSchedule.service";
import { calculateBookingSettlement, calculateDuration, getEarliestScheduledAt } from "../utils/bookingPolicy";
import { buildServicePricingSnapshot } from "./servicePricing.service";
import {
  DIRECT_PROVIDER_RESPONSE_TIMEOUT_MS,
  DispatchService,
  getMaxMatchingDurationSeconds,
} from "./dispatch.service";
import {
  cancelOrderWithSettlement,
  getCancellationPreview,
} from "./orderCancellation.service";
import { Payment } from "../models/payment.model";
import { RepairQuotation } from "../models/repairQuotation.model";
import { recordCompletedOrderSettlement } from "./wallet.service";
import { MatchingService } from "./matching.service";
import { emitToUser } from "../sockets/socketServer";
import { createNotificationRecord } from "./notification.service";
import { requestProviderReassignment } from "./orderReassignment.service";
import { isQuotationDeclinedReason } from "./refundPolicy.service";
import {
  markOrderVoucherAsUsed,
  resolveVoucherForAmount,
  reservePersonalVoucher,
} from "./voucher.service";

// ─── Helpers ────────────────────────────────────────────────────────────────

const DEFAULT_PLATFORM_COMMISSION_PERCENT = 15;
const PLATFORM_FEE_PERCENT_CONFIG_KEY = "PLATFORM_FEE_PERCENT";

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

async function attachQuotationFinalAmounts<T extends {
  currentQuotationId?: unknown;
}>(orders: T[]): Promise<Array<T & { quotationFinalAmount?: number }>> {
  const quotationIds = orders
    .map((order) => getPopulatedId(order.currentQuotationId))
    .filter((id): id is string => Boolean(id));

  if (quotationIds.length === 0) return orders;

  const quotations = await RepairQuotation.find({
    _id: { $in: quotationIds },
  })
    .select("_id finalAmount")
    .lean();
  const amountByQuotationId = new Map(
    quotations.map((quotation) => [
      quotation._id.toString(),
      quotation.finalAmount,
    ]),
  );

  return orders.map((order) => {
    const quotationId = getPopulatedId(order.currentQuotationId);
    const quotationFinalAmount = quotationId
      ? amountByQuotationId.get(quotationId)
      : undefined;
    return quotationFinalAmount === undefined
      ? order
      : { ...order, quotationFinalAmount };
  });
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
      `[OrderService] Điều phối đơn hàng ${order._id} thất bại:`,
      err,
    ),
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CreateOrderPayload {
  expectedBookingAmount?: number;
  uniformQuantity?: number;
  confirmedExpectation?: { amount: number; addressVersion: string };
  customerId: string;
  serviceId: string;
  servicePackageId?: string;
  selectedOptionIds?: string[];
  selectedOptions?: Array<{ optionId: string; quantity: number }>;
  addressId: string;
  orderType?: "normal" | "urgent" | "scheduled" | "recurring";
  scheduledAt?: Date | string;
  recurrenceUnit?: "weekly" | "monthly";
  recurrenceCount?: number;
  problemDescription?: string;
  customerAttachments?: string[];
  promotionId?: string;
  voucherId?: string;
  voucherCode?: string;
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
    const scheduledHour = scheduledAt
      ? new Date(scheduledAt.getTime() + 7 * 60 * 60 * 1000).getUTCHours()
      : null;
    if (
      ["scheduled", "recurring"].includes(orderType) &&
      (!scheduledAt
        || scheduledAt.getTime() < getEarliestScheduledAt().getTime()
        || scheduledHour === null
        || scheduledHour < 8
        || scheduledHour > 21)
    ) {
      throw new AppError(
        "Vui lòng chọn giờ từ 08:00 đến 21:59 và không sớm hơn phút hiện tại.",
        400,
      );
    }
    const isAppointment = ["scheduled", "recurring"].includes(orderType);
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
    const selectedAddress = await Address.findOne({
      _id: payload.addressId,
      userId: payload.customerId,
    });
    if (!selectedAddress) {
      throw new AppError("Địa chỉ không hợp lệ.", 404);
    }
    const address = await ensureAddressCoordinates(selectedAddress);

    const pricingSnapshot = await buildServicePricingSnapshot(
      service, payload.selectedOptionIds, payload.selectedOptions, payload.uniformQuantity, orderType,
    );
    if (payload.expectedBookingAmount !== undefined && payload.expectedBookingAmount !== pricingSnapshot.bookingAmount) {
      throw new AppError("Giá vừa thay đổi. Vui lòng kiểm tra lại tổng tiền trước khi xác nhận.", 409);
    }
    const scheduleIntervals = (isAppointment ? occurrenceDates : [new Date(Date.now() + pricingSnapshot.schedule.travelMinutes * 60000)])
      .map((date) => ({ start: date.getTime(), end: date.getTime() + pricingSnapshot.schedule.durationMinutes * 60000, ...pricingSnapshot.schedule }));

    if (!isAppointment) {
      const availableProviders = await MatchingService.findNearestProviders({
        latitude: address.latitude,
        longitude: address.longitude,
        serviceId: service._id.toString(),
        province: address.province,
        ward: address.ward,
        limit: 1,
        requireOnline: true,
        scheduleIntervals,
      });
      if (availableProviders.length === 0) {
        throw new AppError(
          "Chưa có chuyên gia phù hợp với dịch vụ và địa chỉ đã chọn.",
          409,
        );
      }
    } else if (!payload.preferredProviderId) {
      const availableProviders = await MatchingService.findNearestProviders({
        latitude: address.latitude,
        longitude: address.longitude,
        serviceId: service._id.toString(),
        province: address.province,
        ward: address.ward,
        limit: 1,
        requireOnline: true,
        scheduledDates: occurrenceDates,
        scheduleIntervals,
      });
      if (availableProviders.length === 0) {
        throw new AppError(
          "Chưa có chuyên gia phù hợp và còn trống trong thời gian đã chọn.",
          409,
        );
      }
    }

    let preferredProvider: Awaited<
      ReturnType<typeof MatchingService.findNearestProviders>
    >[number] | null = null;
    if (payload.preferredProviderId) {
      const candidates = await MatchingService.findNearestProviders({
        latitude: address.latitude,
        longitude: address.longitude,
        serviceId: service._id.toString(),
        province: address.province,
        ward: address.ward,
        onlyProviderId: new Types.ObjectId(payload.preferredProviderId),
        limit: 1,
        requireOnline: true,
        scheduledDates: isAppointment ? occurrenceDates : [],
      });
      preferredProvider = candidates[0] ?? null;
      if (!preferredProvider) {
        throw new AppError(
          "Chuyên gia không còn phù hợp với dịch vụ hoặc khu vực đã chọn.",
          409,
        );
      }

      for (const occurrenceDate of isAppointment ? occurrenceDates : []) {
        const conflictStart = new Date(occurrenceDate.getTime() - 60 * 60 * 1000);
        const slotEnd = new Date(occurrenceDate.getTime() + 60 * 60 * 1000);
        const hasConflict = await Order.exists({
          providerId: preferredProvider.providerId,
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

    const inspectionRequired = service.serviceType === "variable_price";
    const platformCommissionPercent = await getNumberConfigValue(
      PLATFORM_FEE_PERCENT_CONFIG_KEY,
      DEFAULT_PLATFORM_COMMISSION_PERCENT,
    );
    const platformCommissionRate = inspectionRequired
      ? 0
      : Math.max(platformCommissionPercent, 0) / 100;
    // Tiền đặt dịch vụ gồm giá gốc/cọc và phụ phí phục vụ ngay nếu có.
    const totalAmount = pricingSnapshot.bookingAmount;
    if (payload.confirmedExpectation && totalAmount !== payload.confirmedExpectation.amount) {
      throw new ActionPreconditionError();
    }
    const voucherResult = payload.voucherCode
      ? await resolveVoucherForAmount(payload.voucherCode, pricingSnapshot.baseAmount)
      : null;


    // 6. Persist order
    const recurringGroupId = orderType === "recurring" ? new Types.ObjectId() : null;
    const orderDates = orderType === "normal" ? [null] : occurrenceDates;
    const orderDocuments = orderDates.map((orderDate, index) => {
      const orderVoucher = index === 0 ? voucherResult : null;
      const voucherDiscountAmount = orderVoucher?.discountAmount ?? 0;
      const { platformCommissionAmount, providerEarningAmount } = calculateBookingSettlement(
        Math.max(totalAmount - voucherDiscountAmount, 0),
        platformCommissionRate,
        inspectionRequired,
      );
      return {
      _id: new Types.ObjectId(),
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
      schedule: pricingSnapshot.schedule,
      bookingStatus: orderType === "recurring" && index > 0 ? "reserved" : "not_required",
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
        baseAmount: pricingSnapshot.baseAmount,
        bookingAmount: totalAmount, // The amount including options for the current payment phase
        platformCommissionRate,
        platformCommissionAmount,
        providerEarningAmount,
        promotionDiscountAmount: 0,
        voucherDiscountAmount,
        totalPaidAmount: Math.max(totalAmount - voucherDiscountAmount, 0),
      },
      voucherSnapshot: orderVoucher?.snapshot ?? null,
      confirmation: {
        customerConfirmedAt: null,
        providerConfirmedAt: null,
      },
      };
    });
    const createdOrders = (await Order.insertMany(
      orderDocuments as Array<Partial<IOrder>>,
    )) as Array<IOrder>;
    const order = createdOrders[0] as unknown as IOrder;

    return order;
  },

  async discardUnpaidOrder(orderId: string, customerId: string) {
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(async () => {
        const order = await Order.findOne({
          _id: orderId,
          customerId,
          status: "created",
          paymentStatus: "unpaid",
          readyForMatching: false,
          isDeleted: false,
        }).session(session);
        if (!order) {
          throw new AppError("Đơn hàng không còn ở trạng thái có thể loại bỏ", 409);
        }

        const lockedPayment = await Payment.exists({
          orderId: order._id,
          status: { $in: ["pending", "paid", "refunded"] },
          isDeleted: false,
        }).session(session);
        if (lockedPayment) {
          throw new AppError(
            "Không thể loại bỏ đơn hàng đã có giao dịch thanh toán",
            409,
          );
        }

        await Payment.updateMany(
          { orderId: order._id, status: "failed" },
          { $set: { isDeleted: true } },
          { session },
        );
        await OrderAssignment.updateMany(
          { orderId: order._id, status: "pending" },
          {
            $set: {
              status: "cancelled",
              respondedAt: new Date(),
            },
          },
          { session },
        );

        order.isDeleted = true;
        order.readyForMatching = false;
        await order.save({ session });
        return { orderId: order._id.toString() };
      });
    } finally {
      await session.endSession();
    }
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
      isDeleted: false,
    });
    const isAppointment = Boolean(
      order && ["scheduled", "recurring"].includes(order.orderType),
    );
    if (!order || (isAppointment && !order.scheduledAt)) {
      throw new AppError("Đơn hàng không ở trạng thái có thể chọn lại provider.", 409);
    }

    const relatedOrderIds = order.recurringGroupId
      ? await Order.find({
        recurringGroupId: order.recurringGroupId,
        customerId: new Types.ObjectId(customerId),
        isDeleted: false,
      }).distinct("_id")
      : [order._id];
    const hasDeclinedAssignment = await OrderAssignment.exists({
      orderId: { $in: relatedOrderIds },
      providerId: new Types.ObjectId(providerId),
      status: { $in: ["rejected", "timeout"] },
      isDeleted: false,
    });
    if (hasDeclinedAssignment) {
      throw new AppError(
        "Chuyên gia này đã từ chối hoặc không phản hồi yêu cầu trước đó. Vui lòng chọn người khác.",
        409,
      );
    }

    const address = await Address.findOne({
      _id: order.addressId,
      userId: customerId,
    });
    if (!address) throw new AppError("Địa chỉ không hợp lệ.", 404);

    const appointmentOrders = order.recurringGroupId
      ? await Order.find({ recurringGroupId: order.recurringGroupId, status: "created", isDeleted: false })
      : [order];
    const policy = await getBookingPolicy();
    const scheduleIntervals = appointmentOrders.map((current) => {
      const interval = getOrderInterval(current, policy);
      if (current.scheduledAt) return interval;
      const start = Date.now() + interval.travelMinutes * 60000;
      return { ...interval, start, end: start + (interval.end - interval.start) };
    });
    const candidates = await MatchingService.findNearestProviders({
      latitude: address.latitude, longitude: address.longitude,
      serviceId: order.serviceId.toString(), province: address.province, ward: address.ward,
      onlyProviderId: new Types.ObjectId(providerId), limit: 1,
        requireOnline: true, scheduleIntervals,
    });
    const candidate = candidates[0];
    if (!candidate) throw new AppError("Chuyên gia không còn phù hợp hoặc không đủ thời gian trống.", 409);

    const responseDeadline = new Date(
      Date.now() + DIRECT_PROVIDER_RESPONSE_TIMEOUT_MS,
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
        assignmentType: isAppointment ? "appointment" : "direct_request",
        status: "pending",
        assignedAt: new Date(),
        responseDeadline,
      });
      emitToUser(
        candidate.userId.toString(),
        isAppointment ? "assignment:new" : "direct-request:new",
        {
          assignmentId: assignment._id.toString(),
          orderId: order._id.toString(),
          responseDeadline,
        },
      );
      await createNotificationRecord({
        userId: candidate.userId,
        type: "ORDER",
        title: isAppointment
          ? "Yêu cầu lịch hẹn mới"
          : "Khách hàng gửi yêu cầu trực tiếp",
        content:
          isAppointment && order.scheduledAt
            ? `Khách hàng muốn đặt lịch ${order.scheduledAt.toLocaleString("vi-VN")}.`
            : `Khách hàng đã chọn bạn cho đơn ${order.orderCode}.`,
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
    const conditions: any[] = [
      { customerId: new Types.ObjectId(customerId), isDeleted: false },
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

    const orders = await Order.find({
      $or: [{ providerId: provider._id }, { _id: { $in: pendingOrderIds } }],
    })
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .populate("customerId", "fullName avatar phone")
      .populate("serviceId", "name image serviceType")
      .populate("addressId")
      .lean();

    return attachQuotationFinalAmounts(orders) as Promise<IOrder[]>;
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

    const items = await attachQuotationFinalAmounts(data);

    return {
      items: items as IOrder[],
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
  async getOrderById(
    orderId: string,
    userId: string,
  ) {
    const order = await Order.findOne({ _id: orderId, isDeleted: false })
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

    if (!isCustomer && !isAssignedProvider) {
      throw new AppError("Bạn không có quyền xem đơn hàng này.", 403);
    }

    const matchingSearch = order.matchingStartedAt && !order.preferredProviderId
      ? order.matchingSearch : null;
    const matchingExpiresAt = order.matchingStartedAt
      ? matchingSearch?.expiresAt ?? new Date(order.matchingStartedAt.getTime()
        + (order.preferredProviderId ? DIRECT_PROVIDER_RESPONSE_TIMEOUT_MS
          : (await getMaxMatchingDurationSeconds()) * 1000))
      : null;

    return { ...order, matchingSearch, matchingExpiresAt };
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
   * Provider bắt đầu thực hiện đơn đã nhận.
   */
  async startOrder(orderId: string, providerUserId: string): Promise<IOrder> {
    const identity = await getProviderByUserId(providerUserId);
    const policy = await getBookingPolicy();
    const session = await mongoose.startSession();
    try {
      const result = await session.withTransaction(async () => {
        const provider = await lockProviderSchedule(identity._id as Types.ObjectId, session);
        const order = await Order.findOne({ _id: orderId, providerId: provider._id, status: "accepted", isDeleted: false }).session(session);
        if (!order) throw new AppError("Đơn không thuộc về bạn hoặc không ở trạng thái đã nhận.", 409);
        if (["scheduled", "recurring"].includes(order.orderType)) {
          if (order.bookingStatus !== "confirmed") throw new AppError("Lịch hẹn chưa được thanh toán và xác nhận.", 409);
        }
        if (!order.inspectionRequired && order.paymentMethod !== "cash" && order.paymentStatus !== "paid") throw new AppError("Đơn chưa được thanh toán thành công.", 409);
        let duration = order.schedule?.durationMinutes ?? calculateDuration(order.serviceId.toString(), order.inspectionRequired, order.selectedOptionsSnapshot, policy);
        if (order.inspectionRequired) {
          if (!order.depositPaidAt) throw new AppError("Tiền cọc chưa được thanh toán.", 409);
          const quotation = await RepairQuotation.findOne({ _id: order.currentQuotationId, orderId: order._id, providerId: provider._id, $or: [{ status: "saved" }, { status: "approved", customerConfirmed: true }], isDeleted: false }).session(session);
          if (!quotation) throw new AppError("Vui lòng lưu báo giá sửa chữa trước khi bắt đầu.", 409);
          if (order.schedule && !quotation.estimatedDurationMinutes) throw new AppError("Vui lòng bổ sung thời lượng sửa chữa vào báo giá.", 409);
          duration = quotation.estimatedDurationMinutes ?? duration;
        }
        if (await Order.exists({ providerId: provider._id, _id: { $ne: order._id }, status: "in_progress", isDeleted: false }).session(session)) throw new AppError("Bạn đang thực hiện một đơn khác.", 409);
        const now = new Date();
        order.schedule = { durationMinutes: duration, bufferMinutes: order.schedule?.bufferMinutes ?? policy.bufferMinutes, travelMinutes: order.schedule?.travelMinutes ?? policy.travelMinutes, expectedStartAt: now, expectedEndAt: new Date(now.getTime() + duration * 60000) };
        await assertProviderSchedule(provider._id as Types.ObjectId, [order], session, policy);
        order.status = "in_progress";
        provider.availabilityStatus = "busy";
        await provider.save({ session });
        await order.save({ session });
        return order;
      });
      if (!result) throw new AppError("Không thể bắt đầu đơn.", 409);
      return result;
    } finally { await session.endSession(); }
  },

  /**
   * Provider marks an in-progress order as completed.
   */
  async completeOrder(
    orderId: string,
    providerUserId: string,
    completionEvidenceImages: string[],
    completionNote?: string,
    expectedQuotation?: { quotationId: string; revision: number },
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

    if (order.inspectionRequired && !order.depositPaidAt) {
      throw new AppError(
        "Không thể hoàn thành đơn khi tiền cọc chưa được thanh toán thành công.",
        400,
      );
    }
    if (
      !order.inspectionRequired &&
      order.paymentMethod !== "cash" &&
      order.paymentStatus !== "paid"
    ) {
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
          !transactionalOrder.depositPaidAt
        ) {
          throw new AppError(
            "Không thể hoàn thành đơn khi tiền cọc chưa được thanh toán thành công.",
            400,
          );
        }
        if (transactionalOrder.inspectionRequired) {
          const quotation = await RepairQuotation.findOne({
            _id: transactionalOrder.currentQuotationId,
            orderId: transactionalOrder._id,
            providerId: transactionalProvider._id,
            $or: [{ status: "saved" }, { status: "approved", customerConfirmed: true }],
            isDeleted: false,
          }).session(session);
          if (!quotation) {
            throw new AppError(
              "Vui lòng lưu báo giá sửa chữa trước khi hoàn thành đơn.",
              409,
            );
          }
          if (expectedQuotation && (quotation.id !== expectedQuotation.quotationId || (quotation.revision ?? 0) !== expectedQuotation.revision)) {
            throw new AppError("Báo giá đã thay đổi. Vui lòng tải lại và kiểm tra số tiền trước khi hoàn thành đơn.", 409);
          }
        }
        if (
          !transactionalOrder.inspectionRequired &&
          transactionalOrder.paymentMethod !== "cash" &&
          transactionalOrder.paymentStatus !== "paid"
        ) {
          throw new AppError(
            "Không thể hoàn thành đơn khi thanh toán điện tử chưa được xác nhận.",
            400,
          );
        }

        const totalAmount = transactionalOrder.inspectionRequired && transactionalOrder.pricing.baseAmount === undefined
          ? transactionalOrder.depositAmount
          : transactionalOrder.pricing.totalPaidAmount;
        const commissionRate = transactionalOrder.inspectionRequired
          ? 0
          : Math.max(transactionalOrder.pricing.platformCommissionRate, 0);
        const { platformCommissionAmount } = calculateBookingSettlement(totalAmount, commissionRate, transactionalOrder.inspectionRequired);
        transactionalOrder.pricing.platformCommissionAmount =
          platformCommissionAmount;
        transactionalOrder.pricing.totalPaidAmount = totalAmount;
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
          await markOrderVoucherAsUsed(transactionalOrder, session);
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
        await earnOrderRewards(transactionalOrder, session);
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
    confirmedExpectation?: { paidAmount: number; refundAmount: number; cancellationFee: number },
  ): Promise<IOrder> {
    if (role === "provider") {
      const order = await Order.findById(orderId).select("status orderType currentQuotationId inspectionRequired");
      if (
        order?.status === "accepted" &&
        !order.currentQuotationId &&
        !order.inspectionRequired &&
        !isQuotationDeclinedReason(reason) &&
        ["normal", "urgent"].includes(order.orderType)
      ) {
        return requestProviderReassignment(orderId, userId, reason);
      }
    }

    return cancelOrderWithSettlement({
      orderId,
      actorId: userId,
      role,
      reason,
      confirmedExpectation,
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
