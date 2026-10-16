import assert from "node:assert/strict";
import Module from "node:module";
import { mock } from "node:test";
import { Types } from "mongoose";
import { Order } from "../models/order.model";
import { Address } from "../models/address.model";
import { OrderAssignment } from "../models/orderAssignment.model";
import User from "../models/user.model";
import { MatchingService, type FindNearestProvidersOptions } from "../services/matching.service";
import * as config from "../services/systemConfig.service";
import * as notifications from "../services/notification.service";
import * as sockets from "../sockets/socketServer";
import { DEFAULT_BOOKING_POLICY } from "../validations/bookingPolicy.validator";
import { orderProviderChoices, publishAgentOrderChange, mergeAgentOrderMessages } from "../services/agentOrderProgress.service";
import { AgentOrderMessage, AgentOrderSubscription } from "../models/agentOrderProgress.model";
import { newSession } from "../ai/agent/agent-state";
import type { ChangeStreamDocument, Document } from "mongodb";

// Không kết nối database, dịch vụ bản đồ hoặc cổng thanh toán thật.
async function run() {
  const gatewayPath = require.resolve("../configs/payos.config");
  const original = require.cache[gatewayPath];
  const gateway = new Module(gatewayPath);
  gateway.exports = { payos: {}, payoutPayos: {} }; require.cache[gatewayPath] = gateway;
  try {
    const { AgentOrderProviderService: agent } = await import("../services/agentOrderProvider.service");
    const reassignment = await import("../services/orderReassignment.service");
    const { OrderService } = await import("../services/order.service");
    const userId = new Types.ObjectId().toString();
    const oldProvider = new Types.ObjectId();
    const providerId = new Types.ObjectId();
    const providerUserId = new Types.ObjectId();
    const order = new Order({ _id: new Types.ObjectId(), customerId: userId, orderCode: "ORD-DOI-THO",
      serviceId: new Types.ObjectId(), addressId: new Types.ObjectId(), status: "created", providerId: null,
      bookingStatus: "rejected", orderType: "normal", paymentStatus: "paid", paymentMethod: "wallet",
      isDeleted: false, createdAt: new Date(), updatedAt: new Date(),
      reassignment: { status: "awaiting_customer", requestedByProviderId: oldProvider,
        previousProviderIds: [oldProvider], reason: "Thợ không thể nhận đơn", requestedAt: new Date(),
        expiresAt: new Date(Date.now() + 900000) } });
    const orderId = String(order._id);
    let online = true;
    let rejected = false;
    let assignmentCalls = 0;
    let wins = true;
    const query = <T>(value: T) => Object.assign(Promise.resolve(value), {
      lean: async () => value, select: () => ({ lean: async () => value }) });
    mock.method(Order, "findOne", (filter: { customerId?: string }) => query(filter.customerId === userId ? order : null));
    mock.method(Address, "findOne", async () => ({ fullAddress: "12 Lê Lợi", province: "Hà Nội", ward: "Phường A", latitude: 21, longitude: 105 }));
    mock.method(OrderAssignment, "find", () => query([{ providerId: oldProvider }]));
    mock.method(OrderAssignment, "exists", async () => rejected);
    mock.method(User, "find", () => query([{ _id: providerUserId, fullName: "Nguyễn Minh" }]));
    mock.method(config, "getBookingPolicy", async () => DEFAULT_BOOKING_POLICY);
    mock.method(config, "getNumberConfigValue", async (_key: string, fallback: number) => fallback);
    mock.method(MatchingService, "findNearestProviders", async (options: FindNearestProvidersOptions) => {
      assert.equal(options.requireOnline, true); assert(options.scheduleIntervals?.length);
      if (options.excludeProviderIds) assert(options.excludeProviderIds.some((id) => String(id) === String(oldProvider)));
      return online ? [{ providerId, userId: providerUserId, distanceMeters: 1000,
        averageRating: 4.8, totalCompletedOrders: 10 }] : [];
    });
    mock.method(Order, "findOneAndUpdate", async (filter: Record<string, unknown>, update: { $set: Record<string, unknown> }, options: { runValidators: boolean }) => {
      assert.equal(filter.customerId, userId); assert.equal(filter.isDeleted, false);
      assert.equal(filter.updatedAt, order.updatedAt); assert.equal(options.runValidators, true);
      assert.equal(filter["reassignment.status"], "awaiting_customer");
      assert(filter["reassignment.expiresAt"]);
      if (!wins) return null;
      for (const [key, value] of Object.entries(update.$set)) order.set(key, value);
      order.updatedAt = new Date(order.updatedAt.getTime() + 1);
      return order;
    });
    mock.method(OrderAssignment, "create", async (input: { providerId: Types.ObjectId; assignmentType: string }) => {
      assert.equal(String(input.providerId), String(providerId)); assert.equal(input.assignmentType, "direct_request");
      assignmentCalls++; return { _id: new Types.ObjectId() } as never;
    });
    mock.method(notifications, "createNotificationRecord", async () => ({} as never));
    mock.method(sockets, "emitToUser", () => {});
    const options = await agent.options(userId, orderId);
    assert.equal(options.canChoose, true); assert.equal(options.canRespond, true);
    assert.equal(options.available[0].name, "Nguyễn Minh");
    const choices = await orderProviderChoices(userId, orderId);
    assert(choices?.[0].options.some((item) => item.includes("Nguyễn Minh")));
    assert(choices?.[0].options.includes("Đồng ý để hệ thống tìm thợ thay thế"));
    const subscription = { userId, sessionId: "phien-doi-tho", orderId: order._id, createdAt: new Date(0) };
    const stored = new Map<string, { _id: string; content: string; createdAt: Date; choiceGroups?: typeof choices }>();
    mock.method(AgentOrderSubscription, "findOne", () => ({ lean: async () => subscription }));
    mock.method(AgentOrderMessage, "updateOne", async (filter: { _id: string }, update: { $setOnInsert: Omit<NonNullable<ReturnType<typeof stored.get>>, "_id"> }) => {
      if (stored.has(filter._id)) return { upsertedCount: 0 };
      stored.set(filter._id, { _id: filter._id, ...update.$setOnInsert }); return { upsertedCount: 1 };
    });
    mock.method(AgentOrderMessage, "find", () => ({ sort: () => ({ lean: async () => [...stored.values()] }) }));
    const event = { _id: { _data: "tho-tu-choi" }, operationType: "update", ns: { coll: Order.collection.collectionName, db: "kiem-thu" },
      fullDocument: order.toObject(), updateDescription: { updatedFields: { bookingStatus: "rejected", reassignment: order.reassignment },
        removedFields: [], truncatedArrays: [] }, wallTime: new Date() } as unknown as ChangeStreamDocument<Document>;
    await publishAgentOrderChange(event); await publishAgentOrderChange(event);
    assert.equal(stored.size, 1, "Phát lại event không tạo trùng yêu cầu chọn thợ.");
    assert([...stored.values()][0].choiceGroups?.[0].options.some((item) => item.includes("Nguyễn Minh")));
    const session = newSession(subscription.sessionId, userId);
    await mergeAgentOrderMessages(session);
    assert(session.conversation[0].choiceGroups?.length, "Lựa chọn vẫn có sau tải lại lịch sử chat.");
    await assert.rejects(() => agent.options(new Types.ObjectId().toString(), orderId), /của bạn/);
    const preview = await agent.previewSelect(userId, orderId, String(providerId));
    assert.equal(assignmentCalls, 0, "Xem trước chưa gửi yêu cầu cho thợ.");
    const confirmed = JSON.parse(JSON.stringify(preview));
    online = false; await assert.rejects(() => agent.select(userId, orderId, String(providerId), confirmed));
    assert.equal(assignmentCalls, 0); online = true;
    await assert.rejects(() => agent.select(userId, orderId, String(oldProvider), confirmed));
    await assert.rejects(() => agent.select(userId, orderId, String(providerId), { ...confirmed, orderVersion: "cũ" }));
    wins = false; await assert.rejects(() => agent.select(userId, orderId, String(providerId), confirmed));
    assert.equal(assignmentCalls, 0); wins = true;
    rejected = true; await assert.rejects(() => agent.select(userId, orderId, String(providerId), confirmed), /từ chối/);
    rejected = false;
    await agent.select(userId, orderId, String(providerId), confirmed);
    assert.equal(assignmentCalls, 1); assert.equal(order.bookingStatus, "awaiting_provider");
    assert.equal(order.readyForMatching, true, "Đơn trực tiếp cần đủ điều kiện để thợ nhận yêu cầu.");
    assert.equal(order.reassignment?.status, "matching", "Không còn chờ phản hồi cũ để monitor hủy nhầm đơn.");
    await assert.rejects(() => agent.select(userId, orderId, String(providerId), confirmed));
    assert.equal(assignmentCalls, 1);
    order.bookingStatus = "rejected"; order.reassignment!.status = "awaiting_customer";
    order.reassignment!.expiresAt = new Date(Date.now() - 1000);
    assert.equal((await agent.options(userId, orderId)).canChoose, false);
    await assert.rejects(() => agent.previewResponse(userId, orderId, "accept"));
    order.reassignment!.expiresAt = new Date(Date.now() + 900000);
    const cancellation = mock.method(OrderService, "previewCancellation", async () => ({ canCancel: true,
      paidAmount: 150000, refundAmount: 150000, cancellationFee: 0 } as never));
    const decline = await agent.previewResponse(userId, orderId, "decline");
    assert.equal(decline.refundAmount, 150000); assert.match(decline.note, /hủy đơn/);
    const respond = mock.method(reassignment, "respondToProviderReassignment", async (_id: string, customer: string,
      decision: "accept" | "decline", version?: string,
      expectation?: { paidAmount: number; refundAmount: number; cancellationFee: number }) => {
      assert.equal(customer, userId); assert.equal(version, order.updatedAt.toISOString());
      if (decision === "decline") assert.equal(expectation?.refundAmount, 150000);
      return order;
    });
    await agent.respond(userId, orderId, "decline", JSON.parse(JSON.stringify(decline)));
    assert.equal(respond.mock.callCount(), 1);
    const accept = await agent.previewResponse(userId, orderId, "accept");
    await agent.respond(userId, orderId, "accept", JSON.parse(JSON.stringify(accept)));
    assert.equal(respond.mock.callCount(), 2);
    await assert.rejects(() => agent.respond(userId, orderId, "accept", JSON.parse(JSON.stringify(decline))));
    assert.equal(respond.mock.callCount(), 2); cancellation.mock.restore();
    console.log("Đạt: danh sách thợ, lựa chọn chủ động trong chat, xác nhận, thợ ngoại tuyến/từ chối, đơn đổi trạng thái, CAS, hết hạn và phản hồi đổi thợ.");
  } finally {
    mock.restoreAll();
    if (original) require.cache[gatewayPath] = original; else delete require.cache[gatewayPath];
  }
}
void run().catch((error: unknown) => { console.error("Kiểm thử đổi thợ trong trợ lý thất bại.", error); process.exitCode = 1; });
