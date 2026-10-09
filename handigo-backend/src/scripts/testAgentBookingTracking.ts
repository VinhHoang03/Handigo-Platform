import assert from "node:assert/strict";
import Module from "node:module";
import { mock } from "node:test";
import mongoose, { Types } from "mongoose";
import { Order } from "../models/order.model";
import { AgentOrderMessage } from "../models/agentOrderProgress.model";
import { SessionService } from "../ai/session/session.service";
import { newSession } from "../ai/agent/agent-state";

// Cô lập service tạo đơn để không tải PayOS hoặc kết nối database trong kiểm thử này.
async function run() {
  const modulePath = require.resolve("../services/order.service");
  const previousModule = require.cache[modulePath];
  const isolatedModule = new Module(modulePath);
  let calls = 0;
  let creationFails = false;
  const userId = new Types.ObjectId().toString();
  const order = new Order({ _id: new Types.ObjectId(), orderCode: "ORD-THANH-CONG", customerId: userId,
    status: "created", bookingStatus: "not_required", paymentStatus: "unpaid", orderType: "normal",
    paymentMethod: "bank", inspectionRequired: false, pricing: { bookingAmount: 150000 } });
  isolatedModule.exports = { OrderService: {
    createOrder: async (payload: { customerId: string }) => {
      assert.equal(payload.customerId, userId);
      calls++;
      if (creationFails) throw new Error("Tạo đơn thất bại giả lập");
      return order;
    },
    getOrderById: async () => { throw new Error("Không được đọc lại đơn sau khi tạo thành công"); },
  } };
  require.cache[modulePath] = isolatedModule;
  try {
    const { AgentBookingService } = await import("../services/agentBooking.service");
    const args = { serviceId: new Types.ObjectId().toString(), addressId: new Types.ObjectId().toString(),
      orderType: "normal" as const, paymentMethod: "bank" as const };
    const expected = { amount: 150000, addressVersion: "kiem-thu" };
    mock.method(Order, "findOne", () => { throw new Error("Theo dõi không khả dụng giả lập"); });
    const result = await AgentBookingService.create(userId, args, expected, "phien-kiem-thu");
    assert.equal(result.orderId, order._id.toString());
    assert.equal(result.amount, 150000);
    assert.equal(result.status, "created");
    assert.equal(calls, 1, "Lỗi theo dõi không tạo thêm đơn và không báo đặt đơn thất bại.");

    let finishTracking: (() => void) | undefined;
    mock.method(Order, "findOne", () => ({ lean: () => new Promise<null>((resolve) => {
      finishTracking = () => resolve(null);
    }) }));
    const timely = await Promise.race([
      AgentBookingService.create(userId, args, expected, "phien-kiem-thu"),
      new Promise<never>((_, reject) => {
        const timer = setTimeout(() => reject(new Error("Theo dõi chậm đã chặn kết quả đặt đơn")), 100);
        timer.unref();
      }),
    ]);
    assert.equal(timely.orderId, order._id.toString(), "Đăng ký theo dõi chậm không chặn trả kết quả.");
    finishTracking?.();
    creationFails = true;
    await assert.rejects(AgentBookingService.create(userId, args, expected, "phien-kiem-thu"), /Tạo đơn thất bại/);

    const session = newSession("phien-kiem-thu", userId);
    session.actions.push({ id: "tao-don", tool: "create_booking", taskVersion: 1, arguments: {}, preview: {},
      createdAt: new Date().toISOString(), expiresAt: new Date().toISOString(), status: "SUCCEEDED", result });
    let saved = false;
    mock.method(mongoose.models.AiAgentSession!, "updateOne", async () => { saved = true; return { matchedCount: 1 }; });
    mock.method(AgentOrderMessage, "find", () => { throw new Error("Lỗi lịch sử thông báo giả lập"); });
    await assert.doesNotReject(new SessionService().save(session, "khoa-kiem-thu"));
    assert.ok(saved);
    assert.equal(session.actions[0].status, "SUCCEEDED", "Lỗi thông báo sau checkpoint không đổi kết quả thành UNKNOWN.");
    console.log("Đã kiểm tra đặt đơn thành công khi theo dõi lỗi/chậm và lưu checkpoint khi lịch sử thông báo lỗi.");
  } finally {
    mock.restoreAll();
    if (previousModule) require.cache[modulePath] = previousModule;
    else delete require.cache[modulePath];
  }
}

void run().catch((error: unknown) => {
  console.error("Kiểm thử đăng ký theo dõi booking thất bại.", error);
  process.exitCode = 1;
});
