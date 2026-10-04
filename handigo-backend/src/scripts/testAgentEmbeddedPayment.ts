import assert from "node:assert/strict";
import { Types } from "mongoose";
import { createAgentPaymentService, agentPaymentResultSchema } from "../services/agentPayment.service";
import type { Order } from "../models/order.model";
import type { Payment } from "../models/payment.model";
import { sessionView } from "../ai/agent/agent.service";
import { newSession } from "../ai/agent/agent-state";

// Kiểm thử dữ liệu nhúng bằng dependency giả lập, không gọi PayOS hoặc đọc cấu hình bí mật.
async function run() {
  const user = { id: new Types.ObjectId().toString(), role: "CUSTOMER" as const };
  const orderId = new Types.ObjectId().toString();
  const paymentId = new Types.ObjectId().toString();
  const checkoutUrl = "https://pay.payos.vn/web/1234567890abcdef1234567890abcdef";
  const order = { _id: orderId, orderCode: "ORD-NHUNG", status: "created", inspectionRequired: false,
    paymentStatus: "unpaid", orderType: "normal" } as unknown as InstanceType<typeof Order>;
  const payment = { _id: paymentId, orderId, status: "pending", method: "payos", amount: 150000,
    paymentType: "full", gatewayResponse: { paymentLink: { checkoutUrl } } } as unknown as InstanceType<typeof Payment>;
  let owned = true;
  let reconciliations = 0;
  const service = createAgentPaymentService({
    order: async () => owned ? order : null,
    payments: async () => [payment],
    reconcile: async () => { reconciliations++; return {} as never; },
    preview: async () => { throw new Error("Không tạo thanh toán trong luồng đọc trạng thái"); },
    create: async () => { throw new Error("Không tạo thêm giao dịch để nhúng"); },
  });
  const pending = await service.status(user, orderId, false);
  assert.equal(pending.checkoutUrl, checkoutUrl);
  assert.equal(pending.paymentId, paymentId);
  assert.ok(agentPaymentResultSchema.safeParse(pending).success);
  assert.equal(reconciliations, 0);
  const session = newSession("phien-qr", user.id);
  session.conversation.push({ id: "giao-dich", role: "tool", tool: "create_payment",
    content: JSON.stringify(pending), createdAt: new Date().toISOString() });
  session.conversation.push({ id: "tin-moi", role: "user", content: "Tôi muốn quét mã thanh toán",
    createdAt: new Date().toISOString() });
  assert.equal(sessionView(session).payment?.paymentId, paymentId, "Không làm mất QR đang chờ khi khách gửi thêm tin nhắn.");
  session.conversation.push({ id: "da-tra", role: "tool", tool: "get_payment_status",
    content: JSON.stringify({ ...pending, status: "paid", checkoutUrl: undefined }), createdAt: new Date().toISOString() });
  session.conversation.push({ id: "tin-sau", role: "user", content: "Cảm ơn", createdAt: new Date().toISOString() });
  assert.equal(sessionView(session).payment, null, "Không khôi phục QR cũ sau khi có kết quả thanh toán mới.");
  await service.status(user, orderId);
  assert.equal(reconciliations, 1, "Chỉ đối soát qua backend khi cần xác minh.");
  payment.status = "paid";
  const paid = await service.status(user, orderId);
  assert.equal(paid.status, "paid");
  assert.equal(paid.checkoutUrl, undefined, "Giao dịch hoàn tất không còn URL để nhúng QR.");
  payment.paymentType = "inspection_deposit";
  assert.equal((await service.status(user, orderId)).status, "deposit_paid");
  payment.status = "failed";
  assert.equal((await service.status(user, orderId)).checkoutUrl, undefined);
  payment.status = "refunded";
  assert.equal((await service.status(user, orderId)).status, "refunded");
  owned = false;
  await assert.rejects(service.status(user, orderId), /Không tìm thấy đơn hàng của bạn/);
  await assert.rejects(service.status({ ...user, role: "PROVIDER" }, orderId), /chỉ dành cho khách hàng/);
  console.log("Đã kiểm tra dữ liệu nhúng PayOS, xác minh backend, ẩn QR khi kết thúc và quyền sở hữu.");
}

void run().catch((error: unknown) => {
  console.error("Kiểm thử thanh toán nhúng trong trợ lý thất bại.", error);
  process.exitCode = 1;
});
