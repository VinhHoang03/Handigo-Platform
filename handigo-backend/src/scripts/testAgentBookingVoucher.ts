import assert from "node:assert/strict";
import Module from "node:module";
import { mock } from "node:test";
import mongoose, { Types } from "mongoose";
import { Order } from "../models/order.model";
import { Service } from "../models/service.model";
import { Category } from "../models/category.model";
import { Address } from "../models/address.model";
import { Promotion } from "../models/promotion.model";
import { Voucher } from "../models/voucher.model";
import { VoucherUsage } from "../models/voucherUsage.model";
import { OrderStatus } from "../models/orderStatus.model";
import { Provider } from "../models/provider.model";
import User from "../models/user.model";
import * as pricing from "../services/servicePricing.service";
import * as addresses from "../services/address.service";
import * as config from "../services/systemConfig.service";
import * as services from "../services/service.service";

// Cô lập cổng thanh toán trước khi tải service; không đọc cấu hình bí mật hoặc gọi mạng.
async function run() {
  const gatewayPath = require.resolve("../configs/payos.config");
  const originalGateway = require.cache[gatewayPath];
  const gateway = new Module(gatewayPath);
  gateway.exports = { payos: {}, payoutPayos: {} };
  require.cache[gatewayPath] = gateway;
  try {
    const { OrderService } = await import("../services/order.service");
    const { MatchingService } = await import("../services/matching.service");
    const { getAvailableVouchers, resolveVoucherForAmount } = await import("../services/voucher.service");
    const userId = new Types.ObjectId().toString();
    const serviceId = new Types.ObjectId().toString();
    const addressId = new Types.ObjectId().toString();
    const providerId = new Types.ObjectId();
    const addressVersion = "2026-01-01T00:00:00.000Z";
    const address = new Address({ _id: addressId, userId, latitude: 21, longitude: 105,
      fullAddress: "12 Nguyễn Trãi", ward: "Phường A", province: "Hà Nội", updatedAt: new Date(addressVersion) });
    const promotion = new Voucher({ _id: new Types.ObjectId(), code: "CANHAN30", name: "Mã cá nhân",
      ownerId: userId, discountType: "AMOUNT", discountValue: 30000, minOrderAmount: 100000,
      usageLimit: 1, usedCount: 0, isActive: true, status: "ACTIVE", isDeleted: false,
      startAt: new Date(Date.now() - 100000), endAt: new Date(Date.now() + 100000), reservedOrderId: null });
    let created: InstanceType<typeof Order>[] = [];
    let previousReservedOrder = false;
    let online = true;
    let reservations = 0;
    mock.method(Service, "findOne", async () => ({ _id: new Types.ObjectId(serviceId), categoryId: new Types.ObjectId(), serviceType: "fixed_price" }));
    mock.method(Category, "exists", async () => ({ _id: new Types.ObjectId() }));
    mock.method(Address, "findOne", async (query: { userId: string }) => { assert.equal(query.userId, userId); return address; });
    mock.method(addresses, "ensureAddressCoordinates", async () => address);
    mock.method(pricing, "buildServicePricingSnapshot", async () => ({ bookingAmount: 200000, baseAmount: 200000,
      depositAmount: 0, optionIds: [], selectedOptionsSnapshot: [], schedule: { durationMinutes: 60, travelMinutes: 30, bufferMinutes: 10 } }));
    mock.method(pricing, "previewServiceBooking", async (payload: Parameters<typeof pricing.previewServiceBooking>[0], owner?: string) => {
      const snapshot = await pricing.buildServicePricingSnapshot({} as never, [], payload.selectedOptions, payload.uniformQuantity);
      const resolved = payload.voucherCode ? await resolveVoucherForAmount(payload.voucherCode, snapshot.baseAmount, undefined, owner, false) : null;
      return { ...snapshot, promotionDiscountAmount: 0, promotionSnapshot: null,
        voucherDiscountAmount: resolved?.discountAmount ?? 0, discountedAmount: snapshot.bookingAmount - (resolved?.discountAmount ?? 0) } as never;
    });
    mock.method(config, "getNumberConfigValue", async () => 15);
    mock.method(MatchingService, "findNearestProviders", async (args: { onlyProviderId?: Types.ObjectId; scheduleIntervals?: unknown[] }) => {
      assert(args.scheduleIntervals?.length);
      return args.onlyProviderId && !online ? [] : [{ providerId, userId: new Types.ObjectId(), distanceMeters: 0, averageRating: 5, totalCompletedOrders: 10 }];
    });
    const queryPromotion = () => {
      const query = Object.assign(Promise.resolve(promotion), { session: () => query });
      return query;
    };
    mock.method(Voucher, "findOne", queryPromotion);
    mock.method(Promotion, "findOne", () => ({ session: async () => null }));
    const emptyQuery = () => Object.assign(Promise.resolve([]), { sort: emptyQuery, lean: emptyQuery });
    mock.method(Promotion, "find", emptyQuery);
    mock.method(OrderStatus, "updateOne", async () => ({ modifiedCount: 1 }) as never);
    mock.method(VoucherUsage, "exists", () => ({ session: async () => null }));
    mock.method(VoucherUsage, "countDocuments", () => ({ session: async () => 0 }));
    mock.method(VoucherUsage, "findOneAndUpdate", () => ({ session: async () => null }));
    mock.method(VoucherUsage, "create", async () => [] as never);
    mock.method(VoucherUsage, "aggregate", async () => []);
    mock.method(promotion, "save", async () => { reservations++; return promotion; });
    mock.method(Order, "findOne", () => ({ session: async () => previousReservedOrder ? created[0] : null }));
    mock.method(Order, "insertMany", async (documents: ConstructorParameters<typeof Order>[0][], options: { session?: unknown }) => {
      assert(options.session, "Mã cá nhân phải được giữ trong cùng transaction với đơn.");
      const rows = documents.map((document) => new Order(document));
      created.push(...rows); return rows;
    });
    let ended = 0;
    mock.method(mongoose, "startSession", async () => ({
      withTransaction: async (callback: () => Promise<unknown>) => {
        const count = created.length;
        try { return await callback(); }
        catch (error) { created = created.slice(0, count); throw error; }
      }, endSession: async () => { ended++; },
    }));
    const args = { customerId: userId, serviceId, addressId, orderType: "normal" as const, paymentMethod: "bank" as const,
      voucherCode: "CANHAN30", preferredProviderId: providerId.toString(),
      confirmedExpectation: { amount: 170000, discountAmount: 30000, addressVersion } };
    const order = await OrderService.createOrder(args);
    assert.equal(order.pricing.bookingAmount, 200000);
    assert.equal(order.pricing.totalPaidAmount, 170000);
    assert.equal(order.pricing.voucherDiscountAmount, 30000);
    assert.equal(String(order.preferredProviderId), String(providerId));
    assert.equal(String(promotion.reservedOrderId), String(order._id));
    assert.equal(reservations, 1);
    assert.equal(ended, 1);
    previousReservedOrder = true;
    await assert.rejects(() => OrderService.createOrder(args), /hết lượt|Thông tin hoặc chi phí đã thay đổi/);
    assert.equal(created.length, 1, "Không lưu thêm đơn khi mã đã giữ cho đơn khác.");
    assert.equal(reservations, 1);
    promotion.reservedCount = 0;
    // Web xác nhận tổng sau giảm; giá gốc không đổi vẫn phải chặn mức giảm mới.
    for (const discount of [10000, 40000]) {
      promotion.discountValue = discount;
      await assert.rejects(() => OrderService.createOrder({ ...args, confirmedExpectation: undefined,
        expectedBookingAmount: 200000, expectedFinalAmount: 170000 }), /Tổng tiền sau giảm giá đã thay đổi/);
      assert.equal(created.length, 1, "Không tạo đơn khi tổng sau giảm khác giá khách đã xem.");
      assert.equal(reservations, 1, "Không giữ thêm lượt voucher khi giá xác nhận đã cũ.");
    }
    promotion.discountValue = 40000;
    await assert.rejects(() => OrderService.createOrder(args), /Thông tin hoặc chi phí đã thay đổi/);
    assert.equal(created.length, 1);
    promotion.discountValue = 30000;
    promotion.ownerId = new Types.ObjectId();
    await assert.rejects(() => OrderService.createOrder(args), /không thuộc tài khoản/);
    promotion.ownerId = new Types.ObjectId(userId);
    online = false;
    await assert.rejects(() => OrderService.createOrder(args), /không còn trực tuyến hoặc phù hợp/);
    online = true;
    address.updatedAt = new Date("2026-01-02T00:00:00.000Z");
    await assert.rejects(() => OrderService.createOrder(args), /Thông tin hoặc chi phí đã thay đổi/);
    assert.equal(created.length, 1);

    // Lọc mã của bản nháp theo tài khoản, đơn tối thiểu, hạn và mã đã giữ.
    mock.method(Voucher, "find", (filter: { $and: Array<{ $or: Array<{ ownerId: unknown }> }> }) => {
      assert.equal(String(filter.$and[0].$or[1].ownerId), userId);
      return Promise.resolve([promotion]);
    });
    mock.method(Order, "find", () => ({ select: () => ({ lean: async () => previousReservedOrder
      ? [{ _id: order._id, voucherSnapshot: { voucherId: promotion._id } }] : [] }) }));
    const user = { id: userId, role: "CUSTOMER" as const };
    assert.equal((await getAvailableVouchers(user, {}, { amountBeforeVoucher: 200000, inspectionRequired: false })).length, 0);
    previousReservedOrder = false; promotion.reservedOrderId = null;
    assert.equal((await getAvailableVouchers(user, {}, { amountBeforeVoucher: 200000, inspectionRequired: false }))[0].discountAmount, 30000);
    assert.equal((await getAvailableVouchers(user, {}, { amountBeforeVoucher: 50000, inspectionRequired: false })).length, 0);
    assert.equal((await getAvailableVouchers(user, {}, { amountBeforeVoucher: 200000, inspectionRequired: true })).length, 0);
    promotion.usedCount = 1;
    assert.equal((await getAvailableVouchers(user, {}, { amountBeforeVoucher: 200000, inspectionRequired: false })).length, 0);
    promotion.usedCount = 0; promotion.endAt = new Date(Date.now() - 1);
    assert.equal((await getAvailableVouchers(user, {}, { amountBeforeVoucher: 200000, inspectionRequired: false })).length, 0);

    // Bản xác nhận của agent và kết quả tạo đơn phải dùng cùng giá sau giảm.
    promotion.endAt = new Date(Date.now() + 100000);
    address.updatedAt = new Date(addressVersion);
    mock.method(services, "getServiceById", async () => ({ _id: new Types.ObjectId(serviceId),
      name: "Vệ sinh điều hòa", serviceType: "fixed_price", fixedPrice: 200000, isActive: true, categoryId: { isActive: true } }));
    mock.method(User, "find", () => ({ select: () => ({ lean: async () => [{ _id: new Types.ObjectId(), fullName: "Nguyễn Hùng" }] }) }));
    mock.method(Provider, "find", () => ({ select: () => ({ populate: () => ({ limit: () => ({ lean: async () => [{
      _id: providerId, userId: { fullName: "Nguyễn Hùng" }, serviceIds: [new Types.ObjectId(serviceId)], availabilityStatus: "online",
    }] }) }) }) }));
    const { AgentBookingService } = await import("../services/agentBooking.service");
    const preview = await AgentBookingService.preview(userId, args);
    assert.equal(preview.originalAmount, 200000);
    assert.equal(preview.amount, 170000);
    assert.equal(preview.discountAmount, 30000);
    assert.equal(preview.providerName, "Nguyễn Hùng");
    const result = await AgentBookingService.create(userId, args, preview);
    assert.equal(result.amount, 170000);
    assert.equal(result.voucherCode, "CANHAN30");
    online = false;
    await assert.rejects(() => AgentBookingService.preview(userId, { ...args, voucherCode: undefined }), /không còn trực tuyến hoặc phù hợp/);
    console.log("Đã kiểm tra giá sau voucher, quyền sở hữu, giữ mã cá nhân, rollback và kiểm tra lại thợ/địa chỉ trước tạo đơn.");
  } finally {
    mock.restoreAll();
    if (originalGateway) require.cache[gatewayPath] = originalGateway;
    else delete require.cache[gatewayPath];
  }
}
run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
