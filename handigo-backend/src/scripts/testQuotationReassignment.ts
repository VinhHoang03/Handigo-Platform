import assert from "node:assert/strict";
import { mock } from "node:test";
import mongoose, { Types } from "mongoose";
import { Order } from "../models/order.model";
import { Provider } from "../models/provider.model";
import { OrderAssignment } from "../models/orderAssignment.model";
import { Address } from "../models/address.model";
import { DEFAULT_BOOKING_POLICY } from "../validations/bookingPolicy.validator";

// Cô lập thanh toán, điều phối và socket; không đọc bí mật hoặc kết nối database.
const stub = (path: string, exports: object) => {
  require.cache[require.resolve(path)] = { exports } as NodeModule;
};
const dispatched: string[] = [];
const notifications: any[] = [];
const events: any[] = [];
let failDispatch = false;
stub("../services/dispatch.service", { getMaxMatchingDurationSeconds: async () => 240, DispatchService: { dispatchReadyOrder: async (id: string) => {
  dispatched.push(id); if (failDispatch) throw new Error("Lỗi điều phối kiểm thử.");
} } });
stub("../services/orderCancellation.service", {
  cancelOrderWithSettlement: () => assert.fail("Không hủy hoặc hoàn tiền khi đang tìm thợ thay thế."),
  cancelSystemOrderWithSettlement: () => assert.fail("Không hủy khi còn vòng tìm kiếm."),
});
stub("../services/notification.service", { createNotificationRecord: async (input: any) => { notifications.push(input); } });
stub("../sockets/socketServer", { emitToUser: (...args: any[]) => { events.push(args); } });
stub("../utils/logger", { createLogger: () => ({ error() {} }) });
stub("../services/providerWalletEligibility.service", { assertProviderWalletEligible: async () => {} });
for (const name of ["wallet", "address", "matching", "voucher", "systemConfig", "servicePricing", "providerSchedule", "reward", "promotion"]) {
  stub(`../services/${name}.service`, {});
}
stub("../services/systemConfig.service", { getBookingPolicy: async () => DEFAULT_BOOKING_POLICY });
stub("../services/providerSchedule.service", {
  lockProviderSchedule: async (_id: Types.ObjectId) => ({ _id }),
  assertProviderSchedule: async () => {},
});
const { requestProviderReassignment } = require("../services/orderReassignment.service") as typeof import("../services/orderReassignment.service");
const { OrderService } = require("../services/order.service") as typeof import("../services/order.service");
const { AssignmentService } = require("../services/assignment.service") as typeof import("../services/assignment.service");

async function scenario(orderType: "normal" | "scheduled", inspectionRequired: boolean) {
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
    const result = await OrderService.cancelOrder(order.id, provider.userId.toString(), "provider", "Không thể thực hiện");
    assert.equal(result.status, "created");
    assert.equal(result.providerId, null);
    assert.equal(result.preferredProviderId, null);
    assert.equal(result.matchingStartedAt, null);
    assert.equal(result.matchingSearch, null);
    assert.equal(result.readyForMatching, true);
    assert.equal(result.reassignment?.status, "matching");
    assert.equal(result.reassignment?.automatic, true);
    assert.deepEqual(result.reassignment?.previousProviderIds.map(String), [String(previousProvider), provider.id]);
    assert.equal(result.paymentStatus, "partially_paid");
    assert.equal(result.depositAmount, 40000);
    assert.equal(result.cancellation, null);
    assert.equal(assignmentCancelled, 1);
    assert.equal(providerReleased, 1);
    assert.equal(dispatched.length, beforeDispatch + 1);
    assert.ok(result.reassignment?.respondedAt);
    assert.equal(notifications[notifications.length - 1].data.action, "order_reassignment_matching");
    assert.ok(events.some((event) => event[0] === String(order.customerId) && event[1] === "order:updated"));
    if (inspectionRequired) {
      assert.doesNotMatch(notifications[notifications.length - 1].content, /voucher/);
    }
    await OrderService.cancelOrder(order.id, provider.userId.toString(), "provider", "Không thể thực hiện");
    assert.equal(dispatched.length, beforeDispatch + 1, "Gửi lại thao tác hủy không khởi động vòng tìm thợ thứ hai.");
    assert.equal(assignmentCancelled, 1);
    assert.equal(providerReleased, 1);
  } finally { mock.restoreAll(); }
}

async function run() {
  for (const type of ["normal", "scheduled"] as const) await scenario(type, true);
  await scenario("normal", false);
  await acceptReplacement();
  failDispatch = true;
  await scenario("scheduled", true);
  console.log("Đạt: tự điều phối trước báo giá, giữ cọc, loại toàn bộ thợ đã hủy, lịch hẹn, phân quyền và khôi phục khi điều phối lỗi.");
}

async function acceptReplacement() {
  const provider = new Provider({ userId: new Types.ObjectId(), verified: true, availabilityStatus: "online" });
  const order = new Order({ customerId: new Types.ObjectId(), serviceId: new Types.ObjectId(),
    addressId: new Types.ObjectId(), orderType: "scheduled",
    status: "created", scheduledAt: new Date(Date.now() + 86400000), inspectionRequired: true,
    bookingStatus: "not_required", paymentMethod: "wallet",
    paymentStatus: "partially_paid", depositAmount: 40000,
    readyForMatching: true, reassignment: { automatic: true, status: "matching" },
  });
  const assignment = new OrderAssignment({ orderId: order._id, providerId: provider._id,
    assignmentType: "appointment", responseDeadline: new Date(Date.now() + 60000) });
  const query = (value: unknown): any => ({ then: (resolve: any) => Promise.resolve(value).then(resolve),
    select: () => query(value), lean: () => query(value), session: () => query(value) });
  mock.method(mongoose, "startSession", async () => ({
    withTransaction: async (fn: () => Promise<unknown>) => fn(), endSession: async () => {},
  }) as never);
  mock.method(Order, "findOne", () => query(order));
  mock.method(order, "save", async () => order);
  mock.method(Provider, "findOne", () => query(provider));
  mock.method(Address, "findById", () => query({ ward: "Phường kiểm thử", province: "Tỉnh kiểm thử" }));
  mock.method(OrderAssignment, "findOne", () => query(assignment));
  mock.method(OrderAssignment, "findOneAndUpdate", (_filter: any, update: any) => {
    assignment.set(update.$set); return query(assignment);
  });
  mock.method(OrderAssignment, "find", () => query([]));
  mock.method(Order, "findById", () => ({ select: (fields: string) => {
    const raw = order.toObject();
    const projected = Object.fromEntries(["_id", ...fields.split(" ")]
      .filter((field) => field in raw).map((field) => [field, (raw as any)[field]]));
    return query(projected);
  } }) as any);
  mock.method(Order, "exists", () => query(null));
  mock.method(Order, "findOneAndUpdate", (_filter: any, update: any) => {
    for (const [field, value] of Object.entries(update.$set)) order.set(field, value);
    return query(order);
  });
  mock.method(Order, "updateMany", async () => assert.fail("Chỉ nhận buổi đang tìm thợ thay thế, không đổi các buổi khác."));
  try {
    const result = await AssignmentService.acceptAssignment(assignment.id, provider.userId.toString());
    assert.equal(result.order.status, "accepted");
    assert.equal(String(result.order.providerId), provider.id);
    assert.equal(result.order.reassignment?.status, "matched");
    assert.equal(result.order.bookingStatus, "confirmed");
    assert.equal(result.order.paymentStatus, "partially_paid");
    assert.equal(result.order.readyForMatching, false);
  } finally { mock.restoreAll(); }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
