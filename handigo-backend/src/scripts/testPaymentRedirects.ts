import assert from "node:assert/strict";
import { buildOrderPaymentRedirects, buildPaymentReturnRelay } from "../utils/paymentRedirect";

const orderId = "507f1f77bcf86cd799439011";
for (const frontend of ["https://localhost:5173", "https://localhost:5173/payment/success", "https://localhost:5173/customer/bookings/result?orderId=cu"]) {
  assert.deepEqual(buildOrderPaymentRedirects(orderId, frontend), {
    returnUrl: `https://localhost:5173/customer/bookings/result?orderId=${orderId}&payos=success`,
    cancelUrl: `https://localhost:5173/customer/bookings/result?orderId=${orderId}&payos=cancel`,
  }, "Các kết quả phải về trang kết quả đặt đơn với đúng mã đơn.");
}
assert.equal(new URL(buildOrderPaymentRedirects(orderId, "https://ung-dung.example.com").returnUrl).origin, "https://ung-dung.example.com");
assert.throws(() => buildOrderPaymentRedirects(orderId, "javascript:alert(1)"));
assert.throws(() => buildOrderPaymentRedirects(orderId, "khong-phai-url"));
const configured = buildOrderPaymentRedirects(orderId, "https://localhost:5173", {
  returnUrl: "http://localhost:5000/payment/success?campaign=thu", cancelUrl: "http://localhost:5000/payment/cancel",
});
assert.equal(new URL(configured.returnUrl).origin, "http://localhost:5000");
assert.equal(new URL(configured.returnUrl).pathname, "/payment/success");
assert.equal(new URL(configured.returnUrl).searchParams.get("orderId"), orderId);
assert.equal(new URL(configured.returnUrl).searchParams.get("campaign"), "thu");
const relay = new URL(buildPaymentReturnRelay("success", "https://app.example.com", { orderId, status: "PAID", next: "https://khac.example.com" }));
assert.equal(relay.href, `https://app.example.com/customer/bookings/result?orderId=${orderId}&status=PAID&payos=success`);
assert.equal(relay.searchParams.has("next"), false);
const cancelledRelay = new URL(buildPaymentReturnRelay('cancel', 'https://app.example.com', { orderId, status: 'CANCELLED' }));
assert.equal(cancelledRelay.pathname, relay.pathname);
assert.equal(cancelledRelay.searchParams.get('payos'), 'cancel');
const sharedPage = 'https://app.example.com/customer/bookings/result';
const shared = buildOrderPaymentRedirects(orderId, 'https://app.example.com', { returnUrl: sharedPage, cancelUrl: sharedPage });
assert.equal(new URL(shared.returnUrl).pathname, new URL(shared.cancelUrl).pathname);
assert.equal(new URL(shared.returnUrl).searchParams.get('orderId'), orderId);
assert.equal(new URL(shared.cancelUrl).searchParams.get('payos'), 'cancel');
const production = buildOrderPaymentRedirects(orderId, "https://app.example.com", {
  returnUrl: "https://app.example.com/payment/success", cancelUrl: "https://app.example.com/payment/cancel",
});
assert.equal(new URL(production.cancelUrl).pathname, "/payment/cancel");
assert.equal(new URL(production.cancelUrl).searchParams.get("orderId"), orderId);
const partial = buildOrderPaymentRedirects(orderId, "https://app.example.com", { returnUrl: "https://api.example.com/payment/success" });
assert.equal(new URL(partial.cancelUrl).origin, "https://app.example.com", "Chỉ cấu hình một biến không được làm đổi origin mặc định của biến còn lại.");
console.log("Đạt: URL thành công/hủy đúng route, đúng mã đơn, đúng HTTPS/domain và chuẩn hóa đường dẫn cũ.");
