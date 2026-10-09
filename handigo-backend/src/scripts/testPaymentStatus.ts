import assert from "node:assert/strict";
import { mock } from "node:test";
import { Types } from "mongoose";
import * as sockets from "../sockets/socketServer";
import { publishPaymentStatus } from "../services/paymentStatus.service";

const payment = { _id: new Types.ObjectId(), orderId: new Types.ObjectId(), customerId: new Types.ObjectId(),
  method: "payos" as const, status: "paid" as const };
const emitted: Array<{ userId: string; event: string; payload: unknown }> = [];
mock.method(sockets, "emitToUser", (userId: string, event: string, payload: unknown) => emitted.push({ userId, event, payload }));
publishPaymentStatus(payment);
assert.deepEqual(emitted, [{ userId: String(payment.customerId), event: "payment:status",
  payload: { paymentId: String(payment._id), orderId: String(payment.orderId), status: "paid" } }]);
publishPaymentStatus({ ...payment, status: "pending" });
publishPaymentStatus({ ...payment, method: "wallet" });
assert.equal(emitted.length, 1, "Chỉ thông báo thay đổi PayOS đã xác minh cho đúng khách.");
mock.method(sockets, "emitToUser", () => { throw new Error("Lỗi socket giả lập"); });
assert.doesNotThrow(() => publishPaymentStatus(payment), "Lỗi thông báo không biến thanh toán đã xác minh thành thất bại.");
mock.restoreAll();
console.log("Đã kiểm tra cập nhật thanh toán realtime, đúng room khách hàng và cách ly lỗi socket.");
