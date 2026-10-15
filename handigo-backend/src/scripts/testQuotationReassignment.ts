import assert from "node:assert/strict";
import { mock } from "node:test";
import mongoose, { Types } from "mongoose";
import { Order } from "../models/order.model";
import { Provider } from "../models/provider.model";
import { OrderAssignment } from "../models/orderAssignment.model";

// Cô lập thanh toán, điều phối và socket; không đọc bí mật hoặc kết nối database.
const stub = (path: string, exports: object) => {
  require.cache[require.resolve(path)] = { exports } as NodeModule;
};
const dispatched: string[] = [];
const notifications: any[] = [];
const events: any[] = [];
let failDispatch = false;
stub("../services/dispatch.service", { DispatchService: { dispatchReadyOrder: async (id: string) => {
  dispatched.push(id); if (failDispatch) throw new Error("Lỗi điều phối kiểm thử.");
} } });
stub("../services/orderCancellation.service", {
  cancelOrderWithSettlement: () => assert.fail("Không hủy hoặc hoàn tiền khi đang tìm thợ thay thế."),
  cancelSystemOrderWithSettlement: () => assert.fail("Không hủy khi còn vòng tìm kiếm."),
});
stub("../services/notification.service", { createNotificationRecord: async (input: any) => { notifications.push(input); } });
stub("../sockets/socketServer", { emitToUser: (...args: any[]) => { events.push(args); } });
stub("../utils/logger", { createLogger: () => ({ error() {} }) });
const { requestProviderReassignment } = require("../services/orderReassignment.service") as typeof import("../services/orderReassignment.service");

async function scenario(orderType: "normal" | "urgent" | "scheduled" | "recurring", inspectionRequired: boolean) {
  const provider = new Provider({ userId: new Types.ObjectId(), verified: true });
  const previousProvider = new Types.ObjectId();
  const order = new Order({ customerId: new Types.ObjectId(), providerId: provider._id,
    serviceId: new Types.ObjectId(), status: "accepted", orderType, inspectionRequired,
    paymentStatus: "partially_paid", depositPaidAt: new Date(), depositAmount: 40000,
    preferredProviderId: provider._id, matchingStartedAt: new Date(0),
    matchingSearch: { initialRadiusKm: 5, expandedRadiusKm: 10, expandsAt: new Date(0), expiresAt: new Date(0) },
    reassignment: { status: "matched", requestedByProviderId: previousProvider, previousProviderIds: [previousProvider],
      reason: "Thợ trước không thể tiếp tục", requestedAt: new Date(0), expiresAt: new Date(0) },
  });
  let wins = true;
  let assignmentCancelled = 0;
  let providerReleased = 0;
  const session = { withTransaction: async (fn: () => Promise<void>) => fn(), endSession: async () => {} };
  const query = (value: unknown): any => ({ then: (resolve: any) => Promise.resolve(value).then(resolve),
    session: () => query(value), select: () => query(value) });
  mock.method(mongoose, "startSession", async () => session as never);
  mock.method(Provider, "findOne", () => query(provider));
  mock.method(Order, "findById", () => query(order));
  mock.method(Order, "findOneAndUpdate", (filter: any, update: any, options: any) => {
    assert.equal(String(filter.providerId), provider.id);
    assert.equal(filter.status, "accepted");
    assert.equal(filter.currentQuotationId, null);
    assert.equal(options.session, session);
    assert.equal(options.runValidators, true);
    if (!wins) return query(null);
    order.set(update.$set); return query(order);
  });
  mock.method(OrderAssignment, "updateOne", async (filter: any, update: any, options: any) => {
    assert.equal(filter.status, "accepted"); assert.equal(update.$set.status, "cancelled");
    assert.equal(options.session, session); assignmentCancelled++; return {} as never;
  });
  mock.method(Provider, "updateOne", async (_filter: any, update: any) => {
    assert.equal(update.$set.availabilityStatus, "online"); providerReleased++; return {} as never;
  });
  try {
    const beforeDispatch = dispatched.length;
    await assert.rejects(requestProviderReassignment(order.id, new Types.ObjectId().toString(), ""), /lý do/);
    const owner = order.providerId;
    order.providerId = new Types.ObjectId();
    await assert.rejects(requestProviderReassignment(order.id, provider.userId.toString(), "Không tiếp tục được"), /quyền/);
    order.providerId = owner;
    order.currentQuotationId = new Types.ObjectId();
    await assert.rejects(requestProviderReassignment(order.id, provider.userId.toString(), "Không tiếp tục được"), /phát sinh báo giá/);
    order.currentQuotationId = undefined;
    wins = false;
    await assert.rejects(requestProviderReassignment(order.id, provider.userId.toString(), "Không tiếp tục được"), /vừa được xử lý/);
    assert.equal(dispatched.length, beforeDispatch);
    assert.equal(assignmentCancelled, 0);
    wins = true;
    const result = await requestProviderReassignment(order.id, provider.userId.toString(), "Không thể thực hiện");
    assert.equal(result.status, "created");
    assert.equal(result.providerId, null);
    assert.equal(result.preferredProviderId, null);
    assert.equal(result.matchingStartedAt, null);
    assert.equal(result.matchingSearch, null);
    assert.equal(result.readyForMatching, inspectionRequired);
    assert.equal(result.reassignment?.status, inspectionRequired ? "matching" : "awaiting_customer");
    assert.deepEqual(result.reassignment?.previousProviderIds.map(String), [String(previousProvider), provider.id]);
    assert.equal(result.paymentStatus, "partially_paid");
    assert.equal(result.depositAmount, 40000);
    assert.equal(result.cancellation, null);
    assert.equal(assignmentCancelled, 1);
    assert.equal(providerReleased, 1);
    assert.equal(dispatched.length, beforeDispatch + Number(inspectionRequired));
    if (inspectionRequired) {
      assert.ok(result.reassignment?.respondedAt);
      assert.equal(notifications[notifications.length - 1].data.action, "order_reassignment_matching");
      assert.ok(events.some((event) => event[0] === String(order.customerId) && event[1] === "order:updated"));
    }
  } finally { mock.restoreAll(); }
}

async function run() {
  for (const type of ["normal", "urgent", "scheduled", "recurring"] as const) await scenario(type, true);
  await scenario("normal", false);
  failDispatch = true;
  await scenario("scheduled", true);
  console.log("Đạt: tự điều phối trước báo giá, giữ cọc, loại toàn bộ thợ đã hủy, lịch hẹn/định kỳ, phân quyền và khôi phục khi điều phối lỗi.");
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
