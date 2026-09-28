import assert from "node:assert/strict";
import mongoose, { Types } from "mongoose";
import { buildMatchingSearch, getMatchingSearchStage } from "../utils/matchingSearch";

// Cô lập cơ sở dữ liệu, thanh toán và socket; không đọc cấu hình môi trường.
function mockModule(path: string, exports: unknown) {
  const id = require.resolve(path);
  require.cache[id] = { id, filename: id, loaded: true, exports } as NodeModule;
}

async function main() {
  const started = new Date("2026-09-18T00:00:00Z");
  const search = buildMatchingSearch(started, 5, 10, 3, 3);
  assert.equal(getMatchingSearchStage(search, started.getTime() + 179_999).radiusKm, 5);
  assert.equal(getMatchingSearchStage(search, started.getTime() + 180_000).radiusKm, 10);
  assert.equal(getMatchingSearchStage(search, started.getTime() + 359_999).expired, false);
  assert.equal(getMatchingSearchStage(search, started.getTime() + 360_000).expired, true);
  const custom = buildMatchingSearch(started, 2, 8, 1, 4);
  assert.equal(getMatchingSearchStage(custom, started.getTime() + 60_000).radiusKm, 8);
  assert.equal(custom.expiresAt.getTime() - started.getTime(), 300_000);

  const userId = new Types.ObjectId();
  const providerId = new Types.ObjectId();
  const orderId = new Types.ObjectId();
  let geoFilter: any;
  let providerFilter: any;
  let order: any;
  let pending = false;
  let cancellations = 0;
  const config: Record<string, number> = {};
  mockModule("../services/systemConfig.service", {
    getNumberConfigValue: async (key: string, fallback: number) => config[key] ?? fallback,
  });
  mockModule("../services/providerWalletEligibility.service", {
    getEligibleProviderUserIds: async () => [userId],
  });
  mockModule("../models/location.model", { Location: {
    find: (filter: unknown) => {
      geoFilter = filter;
      return { lean: async () => [{ userId, coordinates: { coordinates: [106.7, 10.77] } }] };
    },
  } });
  mockModule("../models/provider.model", { Provider: {
    find: (filter: unknown) => {
      providerFilter = filter;
      return { lean: async () => [{ _id: providerId, userId, workingAreas: [], serviceArea: [],
        averageRating: 5, totalCompletedOrders: 10 }] };
    },
  } });
  mockModule("../models/order.model", { Order: {
    findById: () => ({ select: async () => order }),
    updateOne: async (_filter: unknown, update: any) => {
      if (update.$set?.matchingSearch) order.matchingSearch = update.$set.matchingSearch;
    },
    distinct: async () => [],
  } });
  mockModule("../models/orderAssignment.model", { OrderAssignment: {
    exists: async () => pending,
  } });
  mockModule("../models/address.model", { Address: {} });
  mockModule("../utils/logger", { createLogger: () => ({ info() {}, warn() {}, error() {}, debug() {} }) });
  const { MatchingService } = require("../services/matching.service") as typeof import("../services/matching.service");
  const ctx = { latitude: 10.77, longitude: 106.7, serviceId: new Types.ObjectId().toString(),
    province: "Tỉnh khác", ward: "Phường khác" };
  const candidates = await MatchingService.findNearestProviders({ ...ctx, maxDistanceMeters: 5000 });
  assert.equal(candidates.length, 1, "Thợ trong bán kính không bị loại vì khu vực đăng ký");
  assert.equal(geoFilter.coordinates.$nearSphere.$maxDistance, 5000);
  assert.equal(providerFilter.availabilityStatus, "online");
  assert.equal(providerFilter.verified, true);
  assert.equal(candidates[0]!.distanceMeters, 0);
  assert.deepEqual(await MatchingService.findNearestProviders({ ...ctx, latitude: undefined }), []);
  await MatchingService.findNearestProviders({ ...ctx, maxDistanceMeters: 10000, excludeProviderIds: [providerId] });
  assert.equal(geoFilter.coordinates.$nearSphere.$maxDistance, 10000);
  assert.deepEqual(providerFilter._id.$nin, [providerId]);

  mockModule("../sockets/socketServer", { emitToUser() {} });
  mockModule("../services/assignmentRealtime.service", {});
  mockModule("../services/notification.service", {});
  mockModule("../services/payment.service", {});
  mockModule("../services/orderCancellation.service", {
    cancelSystemOrderWithSettlement: async (_id: string, _reason: string, type: string) => {
      assert.equal(type, "provider_unavailable");
      cancellations++;
    },
  });
  let requestedRadius: number | undefined;
  let searches = 0;
  MatchingService.findNearestProviders = async (options) => {
    searches++;
    requestedRadius = options.maxDistanceMeters;
    return [];
  };
  const { DispatchService } = require("../services/dispatch.service") as typeof import("../services/dispatch.service");
  const now = Date.now();
  order = { _id: orderId, status: "created", readyForMatching: true,
    matchingStartedAt: new Date(now), matchingSearch: buildMatchingSearch(new Date(now), 5, 10, 3, 3) };
  await DispatchService.dispatchOrder(orderId.toString(), ctx, Array.from({ length: 10 }, () => new Types.ObjectId()));
  assert.equal(requestedRadius, 5000);
  assert.equal(cancellations, 0, "Không hủy sớm vì hết lượt mời hoặc chưa có ứng viên");
  order.matchingSearch = buildMatchingSearch(new Date(now - 181_000), 5, 10, 3, 3);
  config.MAX_PROVIDER_RADIUS_KM = 20;
  await DispatchService.dispatchOrder(orderId.toString(), ctx);
  assert.equal(requestedRadius, 10000, "Đơn đang tìm giữ cấu hình dù admin thay đổi");
  pending = true;
  const before = searches;
  await DispatchService.dispatchOrder(orderId.toString(), ctx);
  assert.equal(searches, before, "Không phát nhóm mới khi còn đề nghị đang chờ");
  pending = false;
  order.matchingSearch = buildMatchingSearch(new Date(now - 361_000), 5, 10, 3, 3);
  await DispatchService.dispatchOrder(orderId.toString(), ctx);
  assert.equal(cancellations, 1);
  order.status = "accepted";
  await DispatchService.dispatchOrder(orderId.toString(), ctx);
  assert.equal(cancellations, 1, "Không hủy đơn đã có thợ nhận");
  order.status = "created";
  order.matchingStartedAt = new Date();
  order.matchingSearch = null;
  await DispatchService.dispatchOrder(orderId.toString(), ctx);
  assert.equal(order.matchingSearch.expandedRadiusKm, 20, "Khôi phục đơn thiếu cấu hình đã lưu");

  // Bản đồ chỉ trả dữ liệu cho chủ đơn và dùng đúng phạm vi đang điều phối.
  const { Order } = require("../models/order.model");
  const { Address } = require("../models/address.model");
  const { OrderAssignment } = require("../models/orderAssignment.model");
  const { getMatchingMapProviders } = require("../services/dispatch.service");
  order.serviceId = new Types.ObjectId();
  order.matchingSearch = buildMatchingSearch(new Date(), 5, 10, 3, 3);
  Order.findOne = async (filter: any) => filter.customerId === userId.toString() ? order : null;
  Order.findById = () => ({ select: () => Object.assign(Promise.resolve(order), { lean: async () => order }) });
  Address.findById = () => ({ select: async () => ctx });
  OrderAssignment.find = () => ({ select: () => ({ lean: async () => [{ providerId }] }) });
  MatchingService.findNearestProviders = async (options) => {
    assert.deepEqual(options.excludeProviderIds, [providerId]);
    assert.equal(options.requireOnline, true);
    requestedRadius = options.maxDistanceMeters;
    return [{ providerId, userId, distanceMeters: 100, latitude: 10.77, longitude: 106.7, averageRating: 5, totalCompletedOrders: 10 }];
  };
  await assert.rejects(getMatchingMapProviders(orderId.toString(), "other-customer"), /Không tìm thấy/);
  const mapResult = await getMatchingMapProviders(orderId.toString(), userId.toString());
  assert.equal(requestedRadius, 5000);
  assert.equal(mapResult.providers[0].latitude, 10.77);
  assert.equal(mapResult.providers[0].userId, undefined);
  order.matchingSearch = buildMatchingSearch(new Date(Date.now() - 181000), 5, 10, 3, 3);
  await getMatchingMapProviders(orderId.toString(), userId.toString());
  assert.equal(requestedRadius, 10000);
  order.status = "accepted";
  assert.deepEqual((await getMatchingMapProviders(orderId.toString(), userId.toString())).providers, []);
  order.status = "created";
  order.matchingSearch = buildMatchingSearch(new Date(Date.now() - 361000), 5, 10, 3, 3);
  assert.deepEqual((await getMatchingMapProviders(orderId.toString(), userId.toString())).providers, []);

  // Kiểm tra API cấu hình từ chối bán kính/thời gian sai và tài khoản không phải admin.
  delete require.cache[require.resolve("../services/systemConfig.service")];
  mockModule("../models/auditLog.model", { AuditLog: { create: async () => ({}) } });
  const originalCollection = mongoose.connection.collection;
  const saved = new Map<string, any>();
  Object.defineProperty(mongoose.connection, "collection", { configurable: true, value: () => ({
    createIndex: async () => "key_1",
    findOne: async ({ key }: { key: string }) => saved.get(key) ?? null,
    insertOne: async (doc: any) => {
      saved.set(doc.key, doc);
      return { insertedId: new Types.ObjectId() };
    },
  }) });
  try {
    const { createConfig } = require("../services/systemConfig.service") as typeof import("../services/systemConfig.service");
    const admin = { id: userId.toString(), role: "ADMIN" as const };
    const input = { key: "INITIAL_PROVIDER_RADIUS_KM", value: 5, type: "NUMBER" as const, isPublic: false };
    await assert.rejects(createConfig({ ...admin, role: "CUSTOMER" }, input));
    await assert.rejects(createConfig(admin, { ...input, value: 0 }));
    await assert.rejects(createConfig(admin, { ...input, value: 10 }));
    await assert.rejects(createConfig(admin, { ...input, value: "5", type: "STRING" }));
    await assert.rejects(createConfig(admin, { ...input, key: "MATCHING_EXPAND_AFTER_MINUTES", value: -3 }));
    await createConfig(admin, input);
    await createConfig(admin, { ...input, key: "MAX_PROVIDER_RADIUS_KM", value: 12 });
    assert.equal(saved.get("MAX_PROVIDER_RADIUS_KM").value, 12);
  } finally {
    Object.defineProperty(mongoose.connection, "collection", { configurable: true, value: originalCollection });
  }
  console.log("Đã kiểm tra tìm thợ theo bán kính, mở rộng, cấu hình, khôi phục và hủy khi hết hạn.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
