import { AppError } from "../utils/appError";
import { getServiceById, listServices } from "./service.service";
import { getOptionsByServiceId } from "./serviceOption.service";
import { buildServicePricingSnapshot } from "./servicePricing.service";
import { getUserAddresses } from "./address.service";
import { MatchingService } from "./matching.service";
import { OrderService, type CreateOrderPayload } from "./order.service";

type PriceArguments = Pick<CreateOrderPayload, "serviceId" | "selectedOptions" | "uniformQuantity">;
type BookingArguments = PriceArguments & Pick<CreateOrderPayload, "addressId" | "paymentMethod" | "problemDescription"> & {
  orderType: "normal" | "scheduled";
  scheduledAt?: string;
};
interface AvailabilityArguments { serviceId: string; addressId: string; times: string[] }

async function activeService(id: string) {
  const service = await getServiceById(id);
  const category = service.categoryId as unknown as { isActive?: boolean } | null;
  if (!service.isActive || !category?.isActive) throw new AppError("Dịch vụ hoặc danh mục đã ngừng hoạt động.", 400);
  return service;
}

async function ownedAddress(userId: string, addressId: string) {
  const address = (await getUserAddresses(userId)).find((item) => String(item._id) === addressId);
  if (!address) throw new AppError("Địa chỉ không thuộc tài khoản của bạn.", 404);
  return address;
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
      id: String(service._id), name: service.name, serviceType: service.serviceType,
      fixedPrice: service.fixedPrice,
      requiresOptionSelection: service.requiresOptionSelection, options: options.map((option) => ({
        _id: String(option._id), name: option.name, description: option.description,
        price: option.price, optionType: option.optionType, selectionGroup: option.selectionGroup,
        selectionMode: option.selectionMode, allowsQuantity: option.allowsQuantity, isRequired: option.isRequired,
      }))
    };
  },
  async addresses(userId: string) {
    return (await getUserAddresses(userId)).sort((a, b) => Number(b.isDefault) - Number(a.isDefault)).slice(0, 30).map((item) => ({
      id: String(item._id), fullAddress: item.fullAddress, ward: item.ward, province: item.province, isDefault: item.isDefault,
    }));
  },
  async price(args: PriceArguments) {
    const service = await activeService(args.serviceId);
    const snapshot = await buildServicePricingSnapshot(service, [], args.selectedOptions, args.uniformQuantity);
    return {
      serviceName: service.name, serviceType: service.serviceType, amount: snapshot.bookingAmount,
      depositAmount: snapshot.depositAmount, currency: "VND", options: snapshot.selectedOptionsSnapshot
    };
  },
  async availableTimes(userId: string, args: AvailabilityArguments) {
    await activeService(args.serviceId);
    const address = await ownedAddress(userId, args.addressId);
    if (!Number.isFinite(address.latitude) || !Number.isFinite(address.longitude)) {
      throw new AppError("Địa chỉ chưa có tọa độ. Vui lòng cập nhật vị trí trong sổ địa chỉ trước khi kiểm tra lịch.", 400);
    }
    const times = [];
    for (const time of args.times) {
      if (Date.parse(time) <= Date.now()) throw new AppError("Giờ hẹn phải nằm trong tương lai.", 400);
      const candidates = await MatchingService.findNearestProviders({
        serviceId: args.serviceId, latitude: address.latitude, longitude: address.longitude,
        province: address.province, ward: address.ward, scheduledDates: [new Date(time)], requireOnline: false, limit: 1,
      });
      times.push({ time, hasCandidate: candidates.length > 0 });
    }
    return { times, note: "Kết quả tham khảo tại thời điểm kiểm tra, chưa giữ chỗ. Lịch cần kỹ thuật viên chấp nhận sau khi tạo đơn." };
  },
  async preview(userId: string, args: BookingArguments) {
    const address = await ownedAddress(userId, args.addressId);
    const price = await this.price(args);
    const paymentOnConfirmation = true;
    const quantityPrice = price.options.length === 1 && price.options[0].optionId === null
      ? price.options[0] : undefined;
    const paymentNote = args.paymentMethod === "bank"
      ? "Vui lòng kiểm tra thông tin của bạn và xác nhận để thanh toán dịch vụ. Sau xác nhận, hệ thống tạo đơn và liên kết PayOS để bạn chuyển khoản."
      : args.paymentMethod === "wallet"
        ? "Vui lòng kiểm tra thông tin của bạn và xác nhận để thanh toán dịch vụ. Sau xác nhận, hệ thống tạo đơn và trừ số tiền hiển thị ở trên từ ví Handigo."
        : "Vui lòng kiểm tra thông tin của bạn và xác nhận để tạo đơn dịch vụ. Bạn thanh toán tiền mặt trực tiếp cho nhà cung cấp sau khi sử dụng dịch vụ.";
    return {
      title: "Tạo đơn dịch vụ", service: price.serviceName,
      ...(quantityPrice ? { unitPrice: quantityPrice.price, quantity: quantityPrice.quantity }
        : { options: price.options.map((option) => `${option.name} × ${option.quantity}: ${option.subtotal.toLocaleString("vi-VN")} đ`) }),
      address: `${address.fullAddress}, ${address.ward}, ${address.province}`,
      addressVersion: address.updatedAt.toISOString(),
      schedule: args.scheduledAt ?? "Đặt ngay", orderType: args.orderType,
      paymentMethod: args.paymentMethod, amount: price.amount, currency: price.currency,
      description: args.problemDescription ?? "", serviceType: price.serviceType, paymentOnConfirmation,
      note: [paymentNote, price.serviceType === "variable_price" ? "Số tiền trên là tiền cọc. Giá sửa chữa sẽ được báo sau khảo sát." : "",
        quantityPrice ? "Tổng tiền được tính theo đơn giá và số lượng." : ""].filter(Boolean).join(" ")
    };
  },
  async create(userId: string, args: BookingArguments, confirmedExpectation: { amount: number; addressVersion: string }) {
    const order = await OrderService.createOrder({ ...args, customerId: userId, confirmedExpectation });
    return this.getBooking(userId, String(order._id));
  },
  async getBooking(userId: string, orderId: string) {
    const order = await OrderService.getOrderById(orderId, userId);
    return {
      orderId: String(order._id), orderCode: order.orderCode, status: order.status,
      bookingStatus: order.bookingStatus, paymentStatus: order.paymentStatus,
      orderType: order.orderType, paymentMethod: order.paymentMethod, inspectionRequired: order.inspectionRequired,
      scheduledAt: order.scheduledAt, amount: order.inspectionRequired ? order.depositAmount : order.pricing.bookingAmount
    };
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
