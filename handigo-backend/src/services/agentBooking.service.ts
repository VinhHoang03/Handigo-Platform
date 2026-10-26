import { AppError } from "../utils/appError";
import { ActionPreconditionError } from "../utils/actionPreconditionError";
import { createHash } from "node:crypto";
import { Order } from "../models/order.model";
import { getEarliestScheduledAt, isWithinAppointmentHours } from "../utils/bookingPolicy";
import { getServiceById, listServices } from "./service.service";
import { getOptionsByServiceId } from "./serviceOption.service";
import { buildServicePricingSnapshot, previewServiceBooking } from "./servicePricing.service";
import { getUserAddresses, ensureAddressCoordinates } from "./address.service";
import { Address } from "../models/address.model";
import { Provider } from "../models/provider.model";
import User from "../models/user.model";
import { Types } from "mongoose";
import { getAvailableVouchers, resolveVoucherForAmount } from "./voucher.service";
import { resolveAutomaticPromotion } from "./promotion.service";
import { MatchingService } from "./matching.service";
import { OrderService, type CreateOrderPayload } from "./order.service";
import { safelyTrackAgentBooking } from "./agentOrderProgress.service";
import type { IOrder } from "../models/order.model";
import { AGENT_AREA_LOCATION_NOTE, AGENT_AREA_PLACE_PREFIX } from "./agentAddressResolver.service";
import { draftAddressDocument, type DraftBookingAddress } from "./agentAddress.service";
import { bookingAddressLabel } from "../ai/agent/booking-draft";

function bookingView(order: Pick<IOrder, "_id" | "orderCode" | "status" | "bookingStatus" | "paymentStatus"
  | "orderType" | "paymentMethod" | "inspectionRequired" | "scheduledAt" | "depositAmount" | "pricing" | "voucherSnapshot" | "preferredProviderId">) {
  return {
    orderId: String(order._id), orderCode: order.orderCode, status: order.status,
    bookingStatus: order.bookingStatus, paymentStatus: order.paymentStatus,
    orderType: order.orderType, paymentMethod: order.paymentMethod, inspectionRequired: order.inspectionRequired,
    scheduledAt: order.scheduledAt, amount: order.pricing.totalPaidAmount ?? (order.inspectionRequired ? order.depositAmount : order.pricing.bookingAmount),
    voucherCode: order.voucherSnapshot?.code, preferredProviderId: order.preferredProviderId ? String(order.preferredProviderId) : undefined,
  };
}

type PriceArguments = Pick<CreateOrderPayload, "serviceId" | "selectedOptions" | "uniformQuantity">;
type BookingArguments = PriceArguments & Pick<CreateOrderPayload, "addressId" | "paymentMethod" | "problemDescription" | "customerAttachments" | "voucherCode" | "preferredProviderId"> & {
  orderType: "normal" | "scheduled";
  saveAddressToBook?: boolean;
  scheduledAt?: string;
};
type AvailabilityArguments = PriceArguments & { addressId: string; times: string[]; preferredProviderId?: string };

const bookingOrderId = (userId: string, sessionId: string, actionId: string) => new Types.ObjectId(
  createHash("sha256").update(JSON.stringify([userId, sessionId, actionId])).digest("hex").slice(0, 24),
);

async function activeService(id: string) {
  const service = await getServiceById(id);
  const category = service.categoryId as unknown as { isActive?: boolean } | null;
  if (!service.isActive || !category?.isActive) throw new AppError("Dịch vụ hoặc danh mục đã ngừng hoạt động.", 400);
  return service;
}

async function ownedAddress(userId: string, addressId: string, draft?: DraftBookingAddress) {
  const temporary = draftAddressDocument(userId, addressId, draft);
  if (temporary) {
    await temporary.validate();
    if (!Number.isFinite(temporary.latitude) || !Number.isFinite(temporary.longitude)) {
      throw new AppError("Địa chỉ mới đang ở bản nháp. Chưa thể xác định vị trí để tìm thợ; vui lòng thử lại hoặc chọn địa chỉ khác.", 422);
    }
    return temporary;
  }
  const address = await Address.findOne({ _id: addressId, userId, isDeleted: { $ne: true } });
  if (!address) throw new AppError("Địa chỉ không thuộc tài khoản của bạn.", 404);
  return ensureAddressCoordinates(address);
}

export const AgentBookingService = {
  async search(search: string) {
    // Tách query thành các token để tìm từng từ riêng ($and), giúp khớp được
    // "sửa điều hòa" với "Sửa chữa điều hòa" dù không liền nhau.
    const { Service } = await import("../models/service.model");
    const { ServiceOption } = await import("../models/serviceOption.model");

    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const tokens = search.trim().split(/\s+/).filter(Boolean).map(escape);

    const tokenFilter = tokens.length <= 1
      ? { $or: [{ name: { $regex: tokens[0] ?? "", $options: "i" } }, { slug: { $regex: tokens[0] ?? "", $options: "i" } }] }
      : { $and: tokens.map((t) => ({ $or: [{ name: { $regex: t, $options: "i" } }, { slug: { $regex: t, $options: "i" } }] })) };

    const queryDocs = async (extraFilter: object) => {
      const docs = await Service.find({ isDeleted: false, isActive: true, ...extraFilter })
        .populate("categoryId", "name slug isActive")
        .sort({ createdAt: -1 })
        .limit(10);
      return docs.filter((d) => (d.categoryId as unknown as { isActive?: boolean } | null)?.isActive);
    };

    let docs = await queryDocs(tokenFilter);

    // Fallback sang tìm phrase nguyên nếu multi-token không ra kết quả
    if (!docs.length && tokens.length > 1) {
      const phraseEscaped = escape(search.trim());
      docs = await queryDocs({ $or: [{ name: { $regex: phraseEscaped, $options: "i" } }, { slug: { $regex: phraseEscaped, $options: "i" } }] });
    }

    if (!docs.length) return [];

    const minPrices = await ServiceOption.aggregate<{ _id: import("mongoose").Types.ObjectId; minOptionPrice: number }>([
      { $match: { serviceId: { $in: docs.map((d) => d._id) }, price: { $gt: 0 }, isActive: true, isDeleted: false } },
      { $group: { _id: "$serviceId", minOptionPrice: { $min: "$price" } } },
    ]);
    const priceMap = new Map(minPrices.map((p) => [p._id.toString(), p.minOptionPrice]));

    return docs.map((d) => ({ id: String(d._id), name: d.name, serviceType: d.serviceType, minOptionPrice: priceMap.get(String(d._id)) ?? null }));
  },
  async service(serviceId: string) {
    const service = await activeService(serviceId);
    const options = await getOptionsByServiceId(serviceId);
    return {
      id: String(service._id), name: service.name, slug: service.slug, serviceType: service.serviceType,
      fixedPrice: service.fixedPrice,
      optionGroups: service.optionGroups,
      requiresOptionSelection: service.requiresOptionSelection, options: options.map((option) => ({
        _id: String(option._id), name: option.name, description: option.description,
        groupId: option.groupId,
        price: option.price, optionType: option.optionType, selectionGroup: option.selectionGroup,
        selectionMode: option.selectionMode, allowsQuantity: option.allowsQuantity, isRequired: option.isRequired,
      }))
    };
  },
  async addresses(userId: string) {
    return (await getUserAddresses(userId)).sort((a, b) => Number(b.isDefault) - Number(a.isDefault)).slice(0, 30).map((item) => ({
      id: String(item._id), fullAddress: item.fullAddress, ward: item.ward, province: item.province, isDefault: item.isDefault,
      recipientName: item.recipientName, recipientPhone: item.recipientPhone,
      note: item.note,
    }));
  },
  async price(args: PriceArguments) {
    const service = await activeService(args.serviceId);
    const snapshot = await previewServiceBooking({ serviceId: args.serviceId,
      selectedOptions: args.selectedOptions, uniformQuantity: args.uniformQuantity });
    return {
      serviceName: service.name, serviceType: service.serviceType, amount: snapshot.discountedAmount,
      promotionName: snapshot.promotionSnapshot?.name,
      depositAmount: snapshot.depositAmount, currency: "VND", options: snapshot.selectedOptionsSnapshot
    };
  },
  async vouchers(userId: string, args: PriceArguments) {
    const service = await activeService(args.serviceId);
    const snapshot = await buildServicePricingSnapshot(service, [], args.selectedOptions, args.uniformQuantity);
    const promotion = await resolveAutomaticPromotion(service._id, snapshot.baseAmount, true);
    const promotionDiscountAmount = promotion?.discountAmount ?? 0;
    const vouchers = await getAvailableVouchers({ id: userId, role: "CUSTOMER" }, {}, {
      amountBeforeVoucher: Math.max(snapshot.baseAmount - promotionDiscountAmount, 0), inspectionRequired: service.serviceType === "variable_price",
    });
    return vouchers.map((voucher) => ({ code: voucher.code!, name: voucher.name,
      discountAmount: voucher.discountAmount ?? 0,
      finalAmount: Math.max(snapshot.bookingAmount - promotionDiscountAmount - (voucher.discountAmount ?? 0), 0),
      minOrderAmount: voucher.minOrderAmount, endAt: voucher.endAt.toISOString(), neverExpires: voucher.neverExpires ?? false,
    })).filter((voucher) => voucher.discountAmount > 0 && voucher.finalAmount >= 0)
      .sort((a, b) => b.discountAmount - a.discountAmount);
  },
  async voucherFeedback(userId: string, args: PriceArguments & { voucherCode?: string }) {
    const service = await activeService(args.serviceId);
    const snapshot = await buildServicePricingSnapshot(service, [], args.selectedOptions, args.uniformQuantity);
    const promotion = await resolveAutomaticPromotion(service._id, snapshot.baseAmount, true);
    const amount = Math.max(snapshot.baseAmount - (promotion?.discountAmount ?? 0), 0);
    const inspection = service.serviceType === "variable_price";
    if (amount === 0) return "Khoản cần thanh toán hiện là 0đ nên không cần áp thêm mã giảm giá.";
    if (args.voucherCode) {
      try { await resolveVoucherForAmount(args.voucherCode, amount, undefined, userId, inspection); }
      catch (error) {
        if (error instanceof AppError && error.statusCode < 500) return `${error.message} Bạn có thể chọn mã khác hoặc không dùng mã.`;
        throw error;
      }
      return "Mã giảm giá này hiện không khả dụng hoặc đang được giữ cho đơn khác. Bạn có thể chọn mã khác hoặc không dùng mã.";
    }
    // Danh sách này chỉ gồm mã công khai và mã của đúng khách còn hiệu lực/còn lượt; không đọc ví mã của người khác.
    const available = await getAvailableVouchers({ id: userId, role: "CUSTOMER" }, {});
    if (!available.length) return "Bạn chưa có mã giảm giá còn hiệu lực và còn lượt. Bạn có thể đặt với giá đang hiển thị.";
    const matching = available.filter((voucher) => !voucher.applicableOrderType
      || voucher.applicableOrderType === (inspection ? "variable_price" : "fixed_price"));
    if (!matching.length) return inspection
      ? "Các mã hiện có chỉ dành cho đơn giá cố định, không dùng cho cọc sửa chữa. Bạn có thể tiếp tục không dùng mã."
      : "Các mã hiện có chỉ giảm phí cọc cho đơn báo giá, không áp dụng cho dịch vụ giá cố định này. Bạn có thể tiếp tục không dùng mã.";
    const minimum = Math.min(...matching.map((voucher) => voucher.minOrderAmount ?? 0));
    if (amount < minimum) return `Đơn chưa đạt mức tối thiểu ${minimum.toLocaleString("vi-VN")}đ để dùng mã. Bạn có thể tiếp tục không dùng mã.`;
    return "Hiện chưa có mã giảm giá phù hợp với số tiền cần thanh toán của đơn này. Bạn có thể tiếp tục không dùng mã.";
  },
  async providers(userId: string, args: BookingArguments & { providerQuery?: string }, draft?: DraftBookingAddress) {
    const service = await activeService(args.serviceId);
    const address = await ownedAddress(userId, args.addressId, draft);
    const snapshot = await buildServicePricingSnapshot(service, [], args.selectedOptions, args.uniformQuantity);
    const startsAt = args.scheduledAt ? new Date(args.scheduledAt)
      : new Date(Date.now() + snapshot.schedule.travelMinutes * 60000);
    const matching = { serviceId: args.serviceId, latitude: address.latitude, longitude: address.longitude,
      province: address.province, ward: address.ward, requireOnline: true,
      scheduledDates: args.scheduledAt ? [startsAt] : [],
      scheduleIntervals: [{ start: startsAt.getTime(), end: startsAt.getTime() + snapshot.schedule.durationMinutes * 60000, ...snapshot.schedule }],
    };
    const candidates = await MatchingService.findNearestProviders({ ...matching, limit: 10 });
    const names = await User.find({ _id: { $in: candidates.map((item) => item.userId) } }).select("fullName").lean();
    const available = candidates.map((item) => ({ id: String(item.providerId),
      name: names.find((user) => String(user._id) === String(item.userId))?.fullName || "Chuyên gia Handigo",
      averageRating: item.averageRating, totalCompletedOrders: item.totalCompletedOrders,
      distanceMeters: item.distanceMeters >= 0 ? item.distanceMeters : undefined,
    }));
    const requested = [];
    if (args.preferredProviderId || args.providerQuery) {
      const escaped = args.providerQuery?.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const users = escaped ? await User.find({ fullName: { $regex: escaped, $options: "i" }, isDeleted: false })
        .select("_id fullName").limit(20).lean() : [];
      const profiles = await Provider.find({ verified: true, isDeleted: false,
        ...(args.preferredProviderId ? { _id: args.preferredProviderId } : { userId: { $in: users.map((user) => user._id) } }),
      }).select("userId availabilityStatus serviceIds").populate<{ userId: { fullName: string } }>("userId", "fullName").limit(10).lean();
      for (const profile of profiles) {
        const supportsService = profile.serviceIds.some((id) => String(id) === args.serviceId);
        const online = profile.availabilityStatus === "online";
        const eligible = supportsService && online
          ? await MatchingService.findNearestProviders({ ...matching, onlyProviderId: new Types.ObjectId(String(profile._id)), limit: 1 }) : [];
        requested.push({ id: String(profile._id), name: profile.userId?.fullName || "Chuyên gia Handigo",
          eligible: eligible.length > 0, reason: !online ? "Chuyên gia đang ngoại tuyến hoặc bận."
            : !supportsService ? "Chuyên gia không cung cấp dịch vụ này."
              : !eligible.length ? "Chuyên gia hiện không phù hợp khu vực hoặc lịch thực hiện, hoặc chưa đủ điều kiện nhận đơn."
                : "Chuyên gia đang trực tuyến và phù hợp tại thời điểm kiểm tra.",
        });
      }
    }
    return { available, requested, note: "Chưa giữ chỗ; hệ thống kiểm tra lại khi xác nhận. Không tự đổi sang thợ khác khi khách chưa chọn." };
  },
  async availableTimes(userId: string, args: AvailabilityArguments, draft?: DraftBookingAddress) {
    const service = await activeService(args.serviceId);
    const snapshot = await buildServicePricingSnapshot(service, [], args.selectedOptions, args.uniformQuantity, "scheduled");
    const address = await ownedAddress(userId, args.addressId, draft);
    if (!Number.isFinite(address.latitude) || !Number.isFinite(address.longitude)) {
      throw new AppError("Địa chỉ chưa có tọa độ. Vui lòng cập nhật vị trí trong sổ địa chỉ trước khi kiểm tra lịch.", 400);
    }
    const times = [];
    for (const time of args.times) {
      if (Date.parse(time) < getEarliestScheduledAt().getTime() || !isWithinAppointmentHours(new Date(time))) {
        throw new AppError("Vui lòng chọn giờ hẹn hợp lệ và không sớm hơn phút hiện tại.", 400);
      }
      const candidates = await MatchingService.findNearestProviders({
        serviceId: args.serviceId, latitude: address.latitude, longitude: address.longitude,
        province: address.province, ward: address.ward, scheduledDates: [new Date(time)], requireOnline: true, limit: 1,
        ...(args.preferredProviderId ? { onlyProviderId: new Types.ObjectId(args.preferredProviderId) } : {}),
        scheduleIntervals: [{ start: Date.parse(time), end: Date.parse(time) + snapshot.schedule.durationMinutes * 60000, ...snapshot.schedule }],
      });
      times.push({ time, hasCandidate: candidates.length > 0 });
    }
    return { times, ...(args.preferredProviderId ? { preferredProviderId: args.preferredProviderId } : {}),
      note: `${args.preferredProviderId ? "Kết quả dành riêng cho thợ đã chọn, vẫn áp dụng điều kiện trực tuyến hiện có. " : "Kết quả tìm thợ phù hợp bất kỳ. "}Kết quả tham khảo tại thời điểm kiểm tra, chưa giữ chỗ. Lịch cần kỹ thuật viên chấp nhận sau khi tạo đơn.` };
  },
  async preview(userId: string, args: BookingArguments, draft?: DraftBookingAddress) {
    const address = await ownedAddress(userId, args.addressId, draft);
    const service = await activeService(args.serviceId);
    const snapshot = await previewServiceBooking(args, userId);
    const discountAmount = snapshot.voucherDiscountAmount;
    const price = { serviceName: service.name, serviceType: service.serviceType,
      amount: snapshot.discountedAmount + discountAmount,
      options: snapshot.selectedOptionsSnapshot, currency: "VND", promotionName: snapshot.promotionSnapshot?.name };
    let providerName: string | undefined;
    if (args.preferredProviderId) {
      const result = await this.providers(userId, args, draft);
      const chosen = result.requested.find((item) => item.id === args.preferredProviderId && item.eligible);
      if (!chosen) throw new AppError("Chuyên gia đã chọn không còn trực tuyến hoặc phù hợp. Hãy chọn lại chuyên gia.", 409);
      providerName = chosen.name;
    }
    const paymentOnConfirmation = true;
    const quantityPrice = price.options.length === 1 && price.options[0].optionId === null
      ? price.options[0] : undefined;
    const paymentNote = snapshot.discountedAmount === 0
      ? "Sau xác nhận, hệ thống ghi nhận khoản thanh toán 0đ; không cần chuyển khoản hoặc trừ tiền ví."
      : args.paymentMethod === "bank"
      ? "Vui lòng kiểm tra thông tin của bạn và xác nhận để thanh toán dịch vụ. Sau xác nhận, hệ thống tạo đơn và liên kết PayOS để bạn chuyển khoản."
      : args.paymentMethod === "wallet"
        ? "Vui lòng kiểm tra thông tin của bạn và xác nhận để thanh toán dịch vụ. Sau xác nhận, hệ thống tạo đơn và trừ số tiền hiển thị ở trên từ ví Handigo."
        : "Vui lòng kiểm tra thông tin của bạn và xác nhận để tạo đơn dịch vụ. Bạn thanh toán tiền mặt trực tiếp cho nhà cung cấp sau khi sử dụng dịch vụ.";
    return {
      title: "Tạo đơn dịch vụ", service: price.serviceName,
      ...(quantityPrice ? { unitPrice: quantityPrice.price, quantity: quantityPrice.quantity }
        : { options: price.options.map((option) => `${option.name} × ${option.quantity}: ${option.subtotal.toLocaleString("vi-VN")} đ`) }),
      address: bookingAddressLabel(address),
      ...(draft?.id === args.addressId ? { recipientName: address.recipientName, recipientPhone: address.recipientPhone, addressNote: address.note } : {}),
      addressVersion: address.updatedAt.toISOString(),
      addressStorage: draft?.id === args.addressId
        ? args.saveAddressToBook === false ? "Chỉ dùng cho đơn này, không lưu vào sổ địa chỉ" : "Lưu vào sổ địa chỉ khi đặt đơn thành công"
        : "Dùng địa chỉ đã lưu; không tạo thêm địa chỉ",
      schedule: args.scheduledAt ?? "Đặt ngay", orderType: args.orderType,
      paymentMethod: args.paymentMethod, originalAmount: price.amount, discountAmount,
      voucherCode: args.voucherCode, providerName,
      amount: Math.max(price.amount - discountAmount, 0), currency: price.currency,
      description: args.problemDescription ?? "", customerAttachments: args.customerAttachments ?? [], serviceType: price.serviceType, paymentOnConfirmation,
      note: [paymentNote, draft?.id === args.addressId ? args.saveAddressToBook === false ? "Địa chỉ mới chỉ dùng cho đơn này, không lưu vào sổ địa chỉ." : "Địa chỉ mới chỉ được lưu vào sổ địa chỉ khi đặt đơn thành công." : "",
        address.placeId?.startsWith(AGENT_AREA_PLACE_PREFIX) ? AGENT_AREA_LOCATION_NOTE : "",
        price.promotionName ? `Đã áp dụng ưu đãi tự động: ${price.promotionName}.` : "", price.serviceType === "variable_price" ? "Số tiền trên là tiền cọc. Giá sửa chữa sẽ được báo sau khảo sát." : "",
        quantityPrice ? "Tổng tiền được tính theo đơn giá và số lượng." : ""].filter(Boolean).join(" ")
    };
  },
  async create(userId: string, args: BookingArguments, confirmedExpectation: { amount: number; addressVersion: string; discountAmount?: number }, sessionId?: string, actionId?: string, draft?: DraftBookingAddress) {
    const orderId = sessionId && actionId ? bookingOrderId(userId, sessionId, actionId) : undefined;
    const existing = orderId ? await Order.findOne({ _id: orderId, customerId: userId }) : null;
    if (existing) return bookingView(existing);
    let order: IOrder;
    try {
      order = await OrderService.createOrder({ ...args, customerId: userId, confirmedExpectation }, orderId,
        draftAddressDocument(userId, args.addressId, draft), args.saveAddressToBook !== false);
    } catch (error) {
      // Lỗi nghiệp vụ của createOrder xảy ra trước ghi hoặc sau khi transaction đã rollback.
      if (error instanceof AppError && error.statusCode < 500) throw new ActionPreconditionError(error.message);
      throw error;
    }
    if (sessionId) await safelyTrackAgentBooking(userId, sessionId, String(order._id));
    return bookingView(order);
  },
  async reconcileBooking(userId: string, sessionId: string, actionId: string) {
    const order = await Order.findOne({ _id: bookingOrderId(userId, sessionId, actionId), customerId: userId });
    return order ? bookingView(order) : null;
  },
  async getBooking(userId: string, orderId: string) {
    const order = await OrderService.getOrderById(orderId, userId);
    return bookingView(order);
  },
  async bookings(userId: string, search?: string) {
    const result = await OrderService.getOrdersByCustomer(userId, 1, 10, { search });
    return result.items.map((order) => ({
      orderId: String(order._id), orderCode: order.orderCode,
      status: order.status, scheduledAt: order.scheduledAt, paymentStatus: order.paymentStatus
    }));
  },
  async previewCancel(userId: string, orderId: string, reason: string) {
    const result = await OrderService.previewCancellation(orderId, userId, "customer");
    if (!result.canCancel) throw new AppError("Đơn không thể hủy ở trạng thái hiện tại.", 409);
    const order = await this.getBooking(userId, orderId);
    return {
      title: "Hủy đơn dịch vụ", orderCode: order.orderCode, orderId, reason,
      paidAmount: result.paidAmount, refundAmount: result.refundAmount,
      cancellationFee: result.cancellationFee, currency: "VND", policyVersion: result.policyVersion
    };
  },
  async cancel(userId: string, orderId: string, reason: string,
    confirmedExpectation: { paidAmount: number; refundAmount: number; cancellationFee: number }) {
    await OrderService.cancelOrder(orderId, userId, "customer", reason, confirmedExpectation);
    return this.getBooking(userId, orderId);
  },
};
