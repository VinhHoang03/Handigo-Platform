import { AppError } from "../utils/appError";
import { getServiceById, listServices } from "./service.service";
import { getOptionsByServiceId } from "./serviceOption.service";
import { buildServicePricingSnapshot } from "./servicePricing.service";
import { getUserAddresses } from "./address.service";
import { MatchingService } from "./matching.service";
import { OrderService, type CreateOrderPayload } from "./order.service";

type PriceArguments = Pick<CreateOrderPayload, "serviceId" | "selectedOptions">;
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
    const result = await listServices({ search, isActive: "true", limit: "10" });
    return result.items.filter((item) => (item.categoryId as unknown as { isActive?: boolean } | null)?.isActive)
      .map((item) => ({ id: String(item._id), name: item.name, serviceType: item.serviceType, minOptionPrice: item.minOptionPrice }));
  },
  async service(serviceId: string) {
    const service = await activeService(serviceId);
    const options = await getOptionsByServiceId(serviceId);
    return { id: String(service._id), name: service.name, serviceType: service.serviceType,
      requiresOptionSelection: service.requiresOptionSelection, options };
  },
  async addresses(userId: string) {
    return (await getUserAddresses(userId)).slice(0, 30).map((item) => ({
      id: String(item._id), fullAddress: item.fullAddress, ward: item.ward, province: item.province, isDefault: item.isDefault,
    }));
  },
  async price(args: PriceArguments) {
    const service = await activeService(args.serviceId);
    const snapshot = await buildServicePricingSnapshot(service, [], args.selectedOptions);
    return { serviceName: service.name, serviceType: service.serviceType, amount: snapshot.bookingAmount,
      depositAmount: snapshot.depositAmount, currency: "VND", options: snapshot.selectedOptionsSnapshot };
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
    return { title: "Tạo đơn dịch vụ", service: price.serviceName,
      options: price.options.map((option) => `${option.name} × ${option.quantity}: ${option.subtotal.toLocaleString("vi-VN")} đ`),
      address: `${address.fullAddress}, ${address.ward}, ${address.province}`,
      addressVersion: address.updatedAt.toISOString(),
      schedule: args.scheduledAt ?? "Đặt ngay", orderType: args.orderType,
      paymentMethod: args.paymentMethod, amount: price.amount, currency: price.currency,
      description: args.problemDescription ?? "", serviceType: price.serviceType,
      note: price.serviceType === "variable_price" ? "Đây là tiền cọc. Giá sửa chữa sẽ được báo sau khảo sát."
        : "Đơn mới chưa thanh toán; lịch hẹn cần kỹ thuật viên chấp nhận." };
  },
  async create(userId: string, args: BookingArguments, confirmedExpectation: { amount: number; addressVersion: string }) {
    const order = await OrderService.createOrder({ ...args, customerId: userId, confirmedExpectation });
    return this.getBooking(userId, String(order._id));
  },
  async getBooking(userId: string, orderId: string) {
    const order = await OrderService.getOrderById(orderId, userId);
    return { orderId: String(order._id), orderCode: order.orderCode, status: order.status,
      bookingStatus: order.bookingStatus, paymentStatus: order.paymentStatus,
      orderType: order.orderType, paymentMethod: order.paymentMethod, inspectionRequired: order.inspectionRequired,
      scheduledAt: order.scheduledAt, amount: order.inspectionRequired ? order.depositAmount : order.pricing.bookingAmount };
  },
  async bookings(userId: string, search?: string) {
    const result = await OrderService.getOrdersByCustomer(userId, 1, 10, { search });
    return result.items.map((order) => ({ orderId: String(order._id), orderCode: order.orderCode,
      status: order.status, scheduledAt: order.scheduledAt, paymentStatus: order.paymentStatus }));
  },
  async previewCancel(userId: string, orderId: string, reason: string) {
    const result = await OrderService.previewCancellation(orderId, userId, "customer");
    if (!result.canCancel) throw new AppError("Đơn không thể hủy ở trạng thái hiện tại.", 409);
    const order = await this.getBooking(userId, orderId);
    return { title: "Hủy đơn dịch vụ", orderCode: order.orderCode, orderId, reason,
      paidAmount: result.paidAmount, refundAmount: result.refundAmount,
      cancellationFee: result.cancellationFee, currency: "VND", policyVersion: result.policyVersion };
  },
  async cancel(userId: string, orderId: string, reason: string,
    confirmedExpectation: { paidAmount: number; refundAmount: number; cancellationFee: number }) {
    await OrderService.cancelOrder(orderId, userId, "customer", reason, confirmedExpectation);
    return this.getBooking(userId, orderId);
  },
};
