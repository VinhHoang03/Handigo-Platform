import assert from "node:assert/strict";
import { mock } from "node:test";
import mongoose, { Types } from "mongoose";
import { Address, type IAddress } from "../models/address.model";
import { Order, type IOrder } from "../models/order.model";
import { Service } from "../models/service.model";
import { Category } from "../models/category.model";
import User from "../models/user.model";
import { OrderStatus } from "../models/orderStatus.model";
import * as pricing from "../services/servicePricing.service";
import * as promotions from "../services/promotion.service";
import * as config from "../services/systemConfig.service";
import * as tracking from "../services/agentOrderProgress.service";
import { draftAddressDocument, type DraftBookingAddress } from "../services/agentAddress.service";
import { AppError } from "../utils/appError";

// Chạy service tạo đơn thật với collection và transaction giả; không ghi database hoặc gọi cổng tiền.
async function run() {
  require.cache[require.resolve("../configs/payos.config")] = { exports: { payos: {}, payoutPayos: {} } } as NodeModule;
  const { AgentBookingService } = await import("../services/agentBooking.service");
  const { MatchingService } = await import("../services/matching.service");
  const userId = new Types.ObjectId().toString();
  const serviceId = new Types.ObjectId().toString();
  const draft: DraftBookingAddress = { id: new Types.ObjectId().toString(), userId, preparedAt: new Date().toISOString(),
    payload: { fullAddress: "Đại học FPT", province: "Thành phố Đà Nẵng", ward: "Phường Ngũ Hành Sơn",
      provinceCode: 48, wardCode: 101, recipientName: "Nguyễn An", recipientPhone: "0912345678",
      latitude: 16.01, longitude: 108.21, isDefault: false } };
  const args = { serviceId, addressId: draft.id, orderType: "normal" as const, paymentMethod: "cash" as const };
  const expectation = { amount: 200000, addressVersion: draft.preparedAt, discountAmount: 0 };
  let addresses: IAddress[] = [];
  let orders: IOrder[] = [];
  let transactionCount = 0;
  let addressWrites = 0;
  let failInsert = false;
  const query = (value: unknown) => {
    const result = { then: (resolve: (value: unknown) => unknown) => Promise.resolve(value).then(resolve),
      select: () => result, sort: () => result, session: () => result, lean: () => result };
    return result as never;
  };
  const transaction = { endSession: async () => {}, withTransaction: async (work: () => Promise<unknown>) => {
    transactionCount++;
    const beforeAddresses = [...addresses], beforeOrders = [...orders];
    try { return await work(); }
    catch (error) { addresses = beforeAddresses; orders = beforeOrders; throw error; }
  } };
  mock.method(mongoose, "startSession", async () => transaction as never);
  mock.method(User, "updateOne", async (_filter: unknown, _update: unknown, options: { session: unknown }) => {
    assert.equal(options.session, transaction); return { matchedCount: 1 } as never;
  });
  mock.method(Address, "find", () => query(addresses));
  mock.method(Address, "findOne", (filter: { _id?: unknown; userId?: unknown }) => query(addresses.find((item) =>
    String(item._id) === String(filter._id) && String(item.userId) === String(filter.userId)) ?? null));
  mock.method(Address, "create", async (documents: Record<string, unknown>[], options: { session: unknown }) => {
    assert.equal(options.session, transaction);
    addressWrites++;
    const created = new Address(documents[0]); await created.validate();
    addresses.push(created); return [created] as never;
  });
  mock.method(Order, "findOne", (filter: { _id?: unknown; customerId?: unknown }) => query(orders.find((item) =>
    String(item._id) === String(filter._id) && String(item.customerId) === String(filter.customerId)) ?? null));
  mock.method(Order, "insertMany", async (documents: Record<string, unknown>[], options: { session: unknown }) => {
    assert.equal(options.session, transaction);
    assert.equal(addresses.length, 1, "Chỉ lưu địa chỉ trong transaction tạo đơn.");
    if (failInsert) throw new AppError("Lỗi ghi đơn giả lập", 409);
    const created = documents.map((document) => new Order(document));
    orders.push(...created); return created as never;
  });
  mock.method(OrderStatus, "updateOne", async () => ({ matchedCount: 1 }) as never);
  mock.method(Service, "findOne", async () => ({ _id: new Types.ObjectId(serviceId), categoryId: new Types.ObjectId(), serviceType: "fixed_price" }) as never);
  mock.method(Category, "exists", async () => ({ _id: new Types.ObjectId() }));
  mock.method(pricing, "buildServicePricingSnapshot", async () => ({ baseAmount: 200000, bookingAmount: 200000,
    depositAmount: 0, optionIds: [], selectedOptionsSnapshot: [], schedule: { travelMinutes: 30, durationMinutes: 60, bufferMinutes: 15 } }) as never);
  mock.method(promotions, "resolveAutomaticPromotion", async () => null);
  mock.method(config, "getNumberConfigValue", async () => 15);
  mock.method(tracking, "safelyTrackAgentBooking", async () => {});
  mock.method(MatchingService, "findNearestProviders", async (input: { latitude?: number; longitude?: number }) => {
    assert.equal(input.latitude, draft.payload.latitude); assert.equal(input.longitude, draft.payload.longitude);
    return [{ providerId: new Types.ObjectId(), userId: new Types.ObjectId(), distanceMeters: 100, averageRating: 5, totalCompletedOrders: 10 }];
  });

  assert.equal(addresses.length, 0);
  await assert.rejects(() => AgentBookingService.create(userId, args, { ...expectation, amount: 1 }, undefined, undefined, draft));
  assert.equal(transactionCount, 0); assert.equal(addressWrites, 0, "Lỗi kiểm tra trước ghi không lưu địa chỉ.");
  failInsert = true;
  await assert.rejects(() => AgentBookingService.create(userId, args, expectation, undefined, undefined, draft), /Lỗi ghi đơn/);
  assert.equal(addressWrites, 1); assert.equal(addresses.length, 0, "Ghi đơn lỗi phải rollback địa chỉ mới.");
  assert.equal(orders.length, 0);
  failInsert = false;
  const created = await AgentBookingService.create(userId, args, expectation, "phien-dia-chi-tam", "xac-nhan", draft);
  assert.equal(addresses.length, 1); assert.equal(orders.length, 1);
  assert.equal(String(orders[0].addressId), String(addresses[0]._id));
  assert.equal(orders[0].addressSnapshot?.fullAddress, draft.payload.fullAddress);
  const writesAfterBooking = addressWrites;
  const repeated = await AgentBookingService.create(userId, args, expectation, "phien-dia-chi-tam", "xac-nhan", draft);
  assert.equal(repeated.orderId, created.orderId); assert.equal(addressWrites, writesAfterBooking);
  assert.equal(orders.length, 1, "Thử lại cùng xác nhận không tạo lại đơn hoặc địa chỉ.");
  const concurrent = { ...draft, id: new Types.ObjectId().toString() };
  await AgentBookingService.create(userId, { ...args, addressId: concurrent.id }, expectation, undefined, undefined, concurrent);
  assert.equal(addressWrites, writesAfterBooking, "Tái sử dụng địa chỉ được lưu đồng thời trước khi xác nhận.");
  assert.equal(String(orders[1].addressId), String(addresses[0]._id));
  assert.throws(() => draftAddressDocument(new Types.ObjectId().toString(), draft.id, draft), /không thuộc phiên/);
  console.log("Đạt địa chỉ tạm: kiểm tra trước ghi, lưu cùng transaction đơn hàng, rollback khi lỗi, chống ghi lặp, tái sử dụng địa chỉ trùng và kiểm tra chủ sở hữu.");
}
run().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => mock.restoreAll());
