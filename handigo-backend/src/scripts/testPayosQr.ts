import assert from "node:assert/strict";
import { mock } from "node:test";
import QRCode from "qrcode";
import { Payment } from "../models/payment.model";
import { Order } from "../models/order.model";
import { getPayosPaymentQr } from "../services/payosQr.service";

// Không kết nối database hoặc cổng thanh toán; ảnh PNG được tạo bởi thư viện thật.
async function run() {
  const user = { id: "507f1f77bcf86cd799439011", role: "CUSTOMER" as const };
  const qrCode = "000201010212-PAYOS-KIEM-THU";
  const payment = { orderId: "507f1f77bcf86cd799439012", method: "payos", status: "pending",
    gatewayResponse: { paymentLink: { qrCode, checkoutUrl: "https://pay.payos.vn/web/khong-dung-de-tao-qr" } } };
  let visible = true;
  const order = { status: "created" };
  mock.method(Payment, "findOne", (filter: Record<string, unknown>) => {
    assert.equal(filter.customerId, user.id);
    assert.equal(filter.isDeleted, false);
    return { lean: async () => visible ? payment : null };
  });
  mock.method(Order, "findOne", (filter: Record<string, unknown>) => {
    assert.equal(filter.customerId, user.id);
    assert.equal(filter._id, payment.orderId);
    assert.equal(filter.isDeleted, false);
    return { select: () => ({ lean: async () => order }) };
  });
  const encode = QRCode.toBuffer;
  let encoded = "";
  mock.method(QRCode, "toBuffer", (text: string, options: QRCode.QRCodeToBufferOptions) => {
    encoded = text;
    return encode(text, options);
  });
  const image = await getPayosPaymentQr("507f1f77bcf86cd799439013", user);
  assert.equal(encoded, qrCode, "QR chứa đúng chuỗi PayOS, không chứa link checkout.");
  assert.equal(image.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "Trả ảnh PNG thật.");
  assert.equal(image.readUInt32BE(16), 360);
  for (const status of ["paid", "failed", "refunded"]) {
    payment.status = status;
    await assert.rejects(getPayosPaymentQr("507f1f77bcf86cd799439013", user), /không còn cho phép/);
  }
  payment.status = "pending";
  payment.method = "wallet";
  await assert.rejects(getPayosPaymentQr("507f1f77bcf86cd799439013", user), /không còn cho phép/);
  payment.method = "payos";
  order.status = "cancelled";
  await assert.rejects(getPayosPaymentQr("507f1f77bcf86cd799439013", user), /không còn cho phép/);
  order.status = "created";
  payment.gatewayResponse.paymentLink.qrCode = "";
  await assert.rejects(getPayosPaymentQr("507f1f77bcf86cd799439013", user), /chưa có dữ liệu QR/);
  visible = false;
  await assert.rejects(getPayosPaymentQr("507f1f77bcf86cd799439013", user), /Không tìm thấy giao dịch/);
  await assert.rejects(getPayosPaymentQr("507f1f77bcf86cd799439013", { ...user, role: "PROVIDER" }), /chỉ dành cho khách hàng/);
  mock.restoreAll();
  console.log("Đã kiểm tra ảnh QR PayOS, dữ liệu gốc, quyền sở hữu và chặn giao dịch đã kết thúc.");
}
run().catch((error: unknown) => { mock.restoreAll(); console.error("Kiểm thử ảnh QR PayOS thất bại.", error); process.exitCode = 1; });
