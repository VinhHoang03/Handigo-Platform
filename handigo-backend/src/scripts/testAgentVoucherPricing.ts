import assert from "node:assert/strict";
import { mock } from "node:test";
import { z } from "zod";
import { Types } from "mongoose";
import { Service } from "../models/service.model";
import { Category } from "../models/category.model";
import { ServiceOption } from "../models/serviceOption.model";
import { Address } from "../models/address.model";
import { Order } from "../models/order.model";
import { Voucher } from "../models/voucher.model";
import { Promotion } from "../models/promotion.model";
import { VoucherUsage } from "../models/voucherUsage.model";
import { Violation } from "../models/violation.model";
import { DEFAULT_BOOKING_POLICY } from "../validations/bookingPolicy.validator";
import { createAgentPaymentService, paymentExpectationSchema } from "../services/agentPayment.service";
import { AgentService } from "../ai/agent/agent.service";
import { AgentLoop } from "../ai/agent/agent-loop.service";
import { ToolRegistry } from "../ai/tools/tool-registry";
import { newSession } from "../ai/agent/agent-state";
import { bookingSchema } from "../ai/tools/implementations/booking.schemas";

// Giữ logic tính giá/voucher thật; chỉ giả lập database và dịch vụ ngoài.
const stub = (path: string, exports: object) => {
  require.cache[require.resolve(path)] = { exports } as NodeModule;
};
stub("../services/systemConfig.service", { getBookingPolicy: async () => DEFAULT_BOOKING_POLICY,
  getNumberConfigValue: async (_key: string, fallback: number) => fallback });
stub("../services/order.service", { OrderService: {} });
stub("../services/agentOrderProgress.service", {});
stub("../services/matching.service", {});
stub("../services/serviceOption.service", {});
stub("../services/address.service", { ensureAddressCoordinates: async (value: unknown) => value });

async function run() {
  const user = { id: new Types.ObjectId().toString(), role: "CUSTOMER" as const };
  const service = new Service({ name: "Dịch vụ kiểm thử", serviceType: "fixed_price", fixedPrice: 200000,
    isActive: true, requiresOptionSelection: false });
  const address = { _id: new Types.ObjectId(), userId: user.id,
    fullAddress: "Đường Nguyễn Tạo, Phường Ngũ Hành Sơn, Thành phố Đà Nẵng",
    ward: "Phường Ngũ Hành Sơn", province: "Thành phố Đà Nẵng", updatedAt: new Date(), placeId: undefined as string | undefined };
  const voucher = new Voucher({ code: "GIAM30", name: "Giảm 30.000đ", discountType: "AMOUNT", discountValue: 30000,
    startAt: new Date(Date.now() - 1000), endAt: new Date(Date.now() + 100000), createdAt: new Date() });
  const automatic = new Promotion({ name: "Ưu đãi tự động", applicationMode: "automatic", discountType: "AMOUNT",
    discountValue: 20000, allowVoucher: true, startAt: voucher.startAt, endAt: voucher.endAt });
  let promotionEnabled = false;
  let listVouchers = true;
  let customerUsage = 0;
  stub("../services/service.service", { getServiceById: async () => ({ ...service.toObject(), categoryId: { isActive: true } }) });
  const query = <T>(value: T): any => Object.assign(Promise.resolve(value), {
    session: () => query(value), select: () => query(value), lean: () => query(value), sort: () => query(value),
  });
  mock.method(Service, "findOne", () => query(service));
  mock.method(Violation, "find", () => query([]));
  mock.method(Category, "exists", async () => ({ _id: new Types.ObjectId() }));
  mock.method(ServiceOption, "find", () => query([]));
  mock.method(Address, "findOne", (filter: any) => { assert.equal(filter.userId, user.id); return query(address); });
  mock.method(Voucher, "findOne", (filter: any) => query(filter.code && filter.code !== voucher.code ? null : voucher));
  mock.method(Promotion, "findOne", () => query(null));
  mock.method(Voucher, "find", (filter: any) => {
    assert.equal(String(filter.$and[0].$or[1].ownerId), user.id, "Chỉ tra mã công khai và của khách hiện tại.");
    return query(listVouchers ? [voucher] : []);
  });
  mock.method(Promotion, "find", (filter: any) => query(!filter.$and && promotionEnabled && (!filter.allowVoucher || automatic.allowVoucher) ? [automatic] : []));
  mock.method(Order, "find", () => query([]));
  mock.method(VoucherUsage, "aggregate", () => query(customerUsage ? [{ _id: voucher._id, count: customerUsage }] : []));
  mock.method(VoucherUsage, "countDocuments", () => query(customerUsage));
  try {
    const { AgentBookingService } = require("../services/agentBooking.service") as typeof import("../services/agentBooking.service");
    const args = { serviceId: String(service._id), addressId: String(address._id), orderType: "normal" as const,
      paymentMethod: "bank" as const, voucherCode: voucher.code };
    const publicPreview = await AgentBookingService.preview(user.id, args);
    assert.equal(publicPreview.address, address.fullAddress, "Bản xác nhận không ghép lặp phường/thành phố đã có trong địa chỉ đầy đủ.");
    const fullAddress = address.fullAddress;
    address.fullAddress = "134 trần đại nghĩa phường ngũ hành sơn đà nẵng";
    assert.equal((await AgentBookingService.preview(user.id, args)).address,
      "134 trần đại nghĩa, Phường Ngũ Hành Sơn, Thành phố Đà Nẵng", "Địa chỉ đã lưu cũng phải được chuẩn hóa khi lên form.");
    address.fullAddress = "Đường Nguyễn Tạo";
    assert.equal((await AgentBookingService.preview(user.id, args)).address, fullAddress, "Địa chỉ chỉ có tên đường vẫn được bổ sung phường và thành phố.");
    address.fullAddress = fullAddress;
    assert.equal(publicPreview.originalAmount, 200000);
    assert.equal(publicPreview.discountAmount, 30000);
    assert.equal(publicPreview.amount, 170000, "Voucher chỉ được trừ một lần.");
    assert.equal(publicPreview.note, "Sau khi xác nhận đặt dịch vụ, bạn tiếp tục thanh toán trực tuyến.");
    assert.equal((await AgentBookingService.preview(user.id, { ...args, paymentMethod: "wallet" })).note,
      "Sau khi xác nhận đặt dịch vụ, số tiền trên sẽ được trừ từ ví Handigo.");
    assert.equal((await AgentBookingService.preview(user.id, { ...args, paymentMethod: "cash" })).note,
      "Thanh toán tiền mặt cho thợ sau khi sử dụng dịch vụ.");
    address.placeId = "agent-area:48:101";
    const approximate = await AgentBookingService.preview(user.id, args);
    assert(approximate.note.includes("Thợ sẽ liên hệ bạn để xác nhận vị trí cụ thể trước khi đến."));
    assert(!approximate.note.includes("sổ địa chỉ"), "Thông tin lưu địa chỉ đã có trường riêng.");
    address.placeId = undefined;
    voucher.ownerId = new Types.ObjectId(user.id); voucher.applicableOrderType = "fixed_price";
    assert.equal((await AgentBookingService.preview(user.id, args)).amount, 170000, "Mã riêng của đúng khách phải dùng được.");
    voucher.ownerId = new Types.ObjectId();
    await assert.rejects(AgentBookingService.preview(user.id, args), /không thuộc tài khoản/);
    voucher.ownerId = new Types.ObjectId(user.id);
    voucher.discountType = "PERCENT"; voucher.discountValue = 10;
    promotionEnabled = true;
    const stacked = await AgentBookingService.preview(user.id, args);
    assert(stacked.note.includes("Đã áp dụng ưu đãi: Ưu đãi tự động."));
    assert.equal(stacked.originalAmount, 180000);
    assert.equal(stacked.discountAmount, 18000);
    assert.equal(stacked.amount, 162000, "Tính phần trăm trên giá sau ưu đãi tự động.");
    assert.equal((await AgentBookingService.vouchers(user.id, args))[0].finalAmount, stacked.amount);
    assert.equal((await AgentBookingService.vouchers(user.id, args))[0].discountType, "PERCENT");
    assert.equal((await AgentBookingService.vouchers(user.id, args))[0].discountValue, 10);
    automatic.allowVoucher = false;
    assert.equal((await AgentBookingService.preview(user.id, args)).amount, 180000, "Không ghép voucher với ưu đãi không cho kết hợp.");
    assert.equal((await AgentBookingService.vouchers(user.id, args))[0].finalAmount, 180000);
    promotionEnabled = false;
    service.serviceType = "variable_price"; service.depositAmount = 40000;
    voucher.applicableOrderType = "variable_price"; voucher.discountValue = 100; voucher.maxDiscountAmount = 30000;
    const capped = await AgentBookingService.preview(user.id, args);
    assert.equal(capped.discountAmount, 30000); assert.equal(capped.amount, 10000);
    assert(capped.note.includes("tiền cọc"));
    assert(!capped.note.includes("số lượng"));
    service.depositAmount = 20000;
    const free = await AgentBookingService.preview(user.id, args);
    assert.equal(free.amount, 0); assert.equal(free.discountAmount, 20000);
    assert.ok(free.note.includes("không cần chuyển khoản"));
    assert.equal((await AgentBookingService.vouchers(user.id, args))[0].finalAmount, 0, "Mã miễn cọc vẫn được gợi ý.");
    voucher.applicableOrderType = "fixed_price";
    await assert.rejects(AgentBookingService.preview(user.id, args), /chỉ áp dụng cho đơn giá cố định/);
    const { voucherCode: _code, ...withoutCode } = args;
    assert.equal((await AgentBookingService.vouchers(user.id, args)).length, 0);
    assert.match(await AgentBookingService.voucherFeedback(user.id, withoutCode), /chỉ dành cho đơn giá cố định/);
    assert.match(await AgentBookingService.voucherFeedback(user.id, args), /chỉ áp dụng cho đơn giá cố định/);
    // Mã riêng cũ chưa có loại đơn vẫn tuân theo quy tắc chỉ dành cho đơn giá cố định.
    voucher.applicableOrderType = null;
    assert.equal((await AgentBookingService.vouchers(user.id, args)).length, 0);
    assert.match(await AgentBookingService.voucherFeedback(user.id, withoutCode), /chỉ dành cho đơn giá cố định/);
    voucher.applicableOrderType = "variable_price";
    service.serviceType = "fixed_price";
    assert.equal((await AgentBookingService.vouchers(user.id, args)).length, 0);
    assert.match(await AgentBookingService.voucherFeedback(user.id, withoutCode), /chỉ giảm phí cọc cho đơn báo giá/);
    assert.match(await AgentBookingService.voucherFeedback(user.id, args), /chỉ áp dụng/);
    service.serviceType = "variable_price";
    voucher.minOrderAmount = 100000;
    assert.equal((await AgentBookingService.vouchers(user.id, args)).length, 0);
    assert.match(await AgentBookingService.voucherFeedback(user.id, withoutCode), /tối thiểu 100\.000đ/);
    assert.match(await AgentBookingService.voucherFeedback(user.id, args), /chưa đạt mức tối thiểu/);
    voucher.minOrderAmount = null;
    const expires = voucher.endAt;
    voucher.endAt = new Date(Date.now() - 1000);
    assert.equal((await AgentBookingService.vouchers(user.id, args)).length, 0);
    assert.match(await AgentBookingService.voucherFeedback(user.id, withoutCode), /chưa có mã giảm giá còn hiệu lực/);
    assert.match(await AgentBookingService.voucherFeedback(user.id, args), /hết hạn/);
    voucher.endAt = expires;
    customerUsage = 1;
    assert.equal((await AgentBookingService.vouchers(user.id, args)).length, 0);
    assert.match(await AgentBookingService.voucherFeedback(user.id, args), /dùng hết lượt/);
    customerUsage = 0;
    listVouchers = false;
    assert.match(await AgentBookingService.voucherFeedback(user.id, withoutCode), /chưa có mã giảm giá còn hiệu lực/);
    assert.match(await AgentBookingService.voucherFeedback(user.id, { ...args, voucherCode: "KHONGTONTAI" }), /không tồn tại/);
    listVouchers = true;
    voucher.ownerId = null; voucher.applicableOrderType = null;
    assert.equal((await AgentBookingService.vouchers(user.id, args)).length, 1, "Mã công khai không giới hạn loại đơn dùng được cho đơn báo giá.");
    service.serviceType = "fixed_price";
    assert.equal((await AgentBookingService.vouchers(user.id, args)).length, 1, "Mã không giới hạn loại đơn dùng được cho đơn giá cố định.");
    service.serviceType = "variable_price"; voucher.ownerId = new Types.ObjectId(user.id);
    voucher.applicableOrderType = "variable_price";
    assert.equal(paymentExpectationSchema.safeParse({ amount: -1, paymentType: "inspection_deposit" }).success, false);

    // Xác nhận đặt đơn 0đ phải tiếp tục thanh toán ngay, không hỏi lại hay khóa phiên UNKNOWN.
    const orderId = new Types.ObjectId().toString();
    const order = { _id: orderId, orderCode: "DON-MIEN-COC", orderType: "normal", bookingStatus: "not_required",
      paymentMethod: "bank", status: "created", paymentStatus: "unpaid" } as unknown as InstanceType<typeof Order>;
    let payment: any = null;
    let createdPayments = 0;
    const paymentService = createAgentPaymentService({
      order: async () => order, payments: async () => payment ? [payment] : [], reconcile: async () => ({ payment: null, order }),
      preview: async () => ({ amount: 0, paymentType: "inspection_deposit", paymentMethod: "bank" }) as never,
      create: async (_user, _input, expected) => {
        assert.equal(expected.amount, 0); createdPayments++;
        payment = { _id: new Types.ObjectId(), amount: 0, paymentType: "inspection_deposit", method: "payos", status: "paid" };
        return { payment } as never;
      },
    });
    const registry = new ToolRegistry().register({
      name: "create_booking", description: "Đặt đơn kiểm thử", roles: ["CUSTOMER"], inputSchema: bookingSchema,
      mutates: true, requiresConfirmation: true,
      preview: async (context, values) => ({ ...await AgentBookingService.preview(context.user.id, values), policyVersion: "a".repeat(64) }),
      execute: async () => ({ orderId, orderCode: order.orderCode, orderType: "normal", bookingStatus: "not_required", paymentMethod: "bank" }),
    }).register({
      name: "create_payment", description: "Thanh toán kiểm thử", roles: ["CUSTOMER"],
      inputSchema: z.object({ orderId: z.string(), method: z.enum(["PAYOS", "WALLET", "CASH"]) }),
      mutates: true, requiresConfirmation: true,
      preview: (context, values) => paymentService.preview(context.user, values),
      execute: (context, values) => paymentService.pay(context.user, values, context.confirmedPreview),
      reply: (result) => ({ state: "WAITING_USER_INPUT", message: (result as { message: string }).message }),
    });
    const loop = new AgentLoop({ generate: async () => { throw new Error("Không gọi LLM khi tự tiếp tục thanh toán đã xác nhận."); } }, registry,
      { maxIterations: 1, systemPrompt: "Kiểm thử", timeoutMs: 5000 });
    const session = newSession("phien-mien-coc", user.id);
    session.pendingAction = await loop.confirmation.prepare(registry.get("create_booking", { user, sessionId: session.id, signal: AbortSignal.timeout(10000) }),
      { user, sessionId: session.id, signal: AbortSignal.timeout(10000) }, args);
    const agent = new AgentService({ acquire: async () => ({ session, lockId: "khoa" }), save: async () => {}, release: async () => {} }, loop);
    const request = { requestId: "xac-nhan-mien-coc", confirmation: { actionId: session.pendingAction.id, decision: "CONFIRM" as const,
      policyConsent: { accepted: true as const, version: "a".repeat(64) } } };
    await agent.send(user, session.id, request);
    assert.equal(createdPayments, 1); assert.equal(session.pendingAction, null);
    assert.equal(Boolean(session.requiresReconciliation), false);
    assert.ok(session.actions.some((action) => action.tool === "create_payment" && action.status === "SUCCEEDED"));
    await agent.send(user, session.id, request); assert.equal(createdPayments, 1, "Thử lại request không tạo thêm thanh toán.");
    console.log("Đạt: giá agent không trừ voucher hai lần, quyền sở hữu/loại đơn, ghép ưu đãi, giới hạn 30k, miễn cọc và tự tiếp tục thanh toán 0đ.");
  } finally { mock.restoreAll(); }
}
run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
