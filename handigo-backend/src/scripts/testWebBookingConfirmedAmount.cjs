const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

// Chạy hàm submit của web với API giả lập; không gọi mạng hoặc đọc cấu hình bí mật.
const sourcePath = path.resolve(__dirname, "../../../handigo-web/src/features/booking/components/confirmPaymentSubmit.ts");
const output = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
let currentAmount = 170000;
let paymentCalls = 0;
let errorMessage = "";
const api = {
  createOrder: async (payload) => {
    assert.equal(payload.expectedBookingAmount, 200000);
    assert.equal(payload.expectedFinalAmount, 170000);
    if (currentAmount !== payload.expectedFinalAmount) {
      throw { response: { data: { message: "Tổng tiền sau giảm giá đã thay đổi. Vui lòng kiểm tra và xác nhận lại giá mới." } } };
    }
    return { _id: "don-xac-nhan" };
  },
  getOrderById: async () => ({ _id: "don-xac-nhan", pricing: { bookingAmount: 200000, totalPaidAmount: currentAmount }, voucherSnapshot: { code: "GIAM30" } }),
  createPayment: async (payload) => {
    paymentCalls++;
    assert.equal(payload.expectedAmount, 170000);
    if (payload.method === "PAYOS") {
      assert.equal(payload.returnUrl, `${window.location.origin}/customer/bookings/result?orderId=${payload.orderId}&payos=success`);
      assert.equal(payload.cancelUrl, `${window.location.origin}/customer/bookings/result?orderId=${payload.orderId}&payos=cancel`);
    }
    return { payment: { status: "paid" } };
  },
};
const stubs = {
  "@/features/booking/api/booking.api": { bookingApi: api },
  "@/api/tokenStorage": { tokenStorage: {} },
  "@/utils/airConditionerCleaning": { isAirConditionerCleaning: () => false },
  "./step2Helpers": { getEarliestScheduledAt: () => new Date(0) },
  "./confirmPaymentSubmitTypes": { getConfirmPaymentErrorMessage: (error) => error.response?.data?.message || "Lỗi giả lập." },
};
const loaded = new Module(sourcePath);
loaded.require = (name) => {
  if (!(name in stubs)) throw new Error(`Chưa giả lập module ${name}.`);
  return stubs[name];
};
loaded._compile(output, sourcePath);
global.sessionStorage = { setItem() {}, removeItem() {} };
global.window = { location: { origin: "http://localhost:5173" } };
const noop = () => {};
const params = {
  serviceId: "dich-vu", addressId: "dia-chi", orderType: "normal", service: { serviceType: "fixed_price" },
  selectedOptionIds: [], selectedOptionQuantities: {}, customerAttachments: [], effectivePaymentMethod: "wallet",
  appliedVoucher: { code: "GIAM30", discountValue: 30000 }, voucherCode: "GIAM30", pendingOrderId: "", bookingFingerprint: "thong-tin",
  expectedBookingAmount: 200000, expectedFinalAmount: 170000, isAppointment: false, isOptionSelectionMissing: false,
  showSystemAlert: noop, setPaymentError: (message) => { errorMessage = message; }, setVoucherError: noop,
  setIsSubmitting: noop, setPendingOrderId: noop, reset: noop, navigate: noop,
};
async function run() {
  const originalConsoleError = console.error;
  try {
    console.error = noop;
    for (const amount of [190000, 160000]) {
      currentAmount = amount;
      await loaded.exports.runConfirmPaymentSubmit(params);
      assert.equal(paymentCalls, 0);
      assert.ok(errorMessage.includes("Tổng tiền sau giảm giá đã thay đổi"));
    }
    currentAmount = 190000;
    await loaded.exports.runConfirmPaymentSubmit({ ...params, pendingOrderId: "don-xac-nhan" });
    assert.equal(paymentCalls, 0, "Đơn đang chờ khác tổng hiển thị cũng phải dừng trước thanh toán.");
    assert.ok(errorMessage.includes("đơn đang chờ"));
    currentAmount = 170000;
    await loaded.exports.runConfirmPaymentSubmit({ ...params, pendingOrderId: "don-xac-nhan", expectedVoucherCode: "MOI30" });
    assert.equal(paymentCalls, 0, "Hai mã giảm cùng số tiền vẫn phải kiểm tra đúng mã đã chốt.");
    assert.ok(errorMessage.includes("Voucher của đơn đang chờ đã thay đổi"));
    for (const effectivePaymentMethod of ["wallet", "bank", "cash"]) {
      await loaded.exports.runConfirmPaymentSubmit({ ...params, effectivePaymentMethod });
    }
    assert.equal(paymentCalls, 3, "Cả ví, PayOS và tiền mặt đều gửi số tiền đã xác nhận.");
    await loaded.exports.runConfirmPaymentSubmit({ ...params, pendingOrderId: "don-xac-nhan", expectedVoucherCode: "GIAM30",
      appliedVoucher: null, voucherCode: "" });
    assert.equal(paymentCalls, 4, "Tiếp tục đơn cũ dùng mã đã chốt ngay cả khi mã không còn trong danh sách chọn.");
    console.log("Đạt: submit web gửi tổng sau giảm, chặn giá cũ/đơn đang chờ khác giá và bảo vệ cả ví, PayOS, tiền mặt.");
  } finally { console.error = originalConsoleError; }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
