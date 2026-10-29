import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import mongoose, { Types } from 'mongoose';
import User from '../models/user.model';
import { Provider } from '../models/provider.model';
import { ProviderApplication } from '../models/providerApplication.model';
import { Service } from '../models/service.model';
import { ServiceOption } from '../models/serviceOption.model';
import { Address } from '../models/address.model';
import { Order } from '../models/order.model';
import { OrderAssignment } from '../models/orderAssignment.model';
import { OrderStatus } from '../models/orderStatus.model';
import { Payment } from '../models/payment.model';
import { Wallet } from '../models/wallet.model';
import { WalletTransaction } from '../models/walletTransaction.model';
import { RewardAccount, RewardTransaction } from '../models/reward.model';
import { orderActorContext } from '../utils/orderActorContext';
import { calculateBookingSettlement } from '../utils/bookingPolicy';
import { getProviderResponseTimeoutSeconds } from '../utils/matchingSearch';

export const BATCH = 'chart-history-2026-06-09-v1';
const CUSTOMER = '666600000000000000000001';
const ADMIN = '666600000000000000000003';
const EMAIL = `${BATCH}@example.invalid`;
const DESCRIPTION = `Dữ liệu thử nghiệm biểu đồ tháng 6–9/2026. Mã lô: ${BATCH}.`;
const vnDate = (month: number, day: number, hour: number) => new Date(`2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00+07:00`);
const plusMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);
const stableId = (key: string, date: Date) => new Types.ObjectId(Math.floor(date.getTime() / 1000).toString(16).padStart(8, '0') + createHash('sha256').update(`${BATCH}:${key}`).digest('hex').slice(0, 16));

export function historySpecifications() {
  return [
    { month: 6, completed: 8, cancelled: 1 }, { month: 7, completed: 13, cancelled: 2 },
    { month: 8, completed: 10, cancelled: 1 }, { month: 9, completed: 17, cancelled: 3 },
  ].flatMap(({ month, completed, cancelled }) => Array.from({ length: completed + cancelled }, (_, index) => {
    const day = month === 6 ? 25 + Math.floor(index / 2) : month === 7 ? 21 + Math.floor(index / 2) : 2 + Math.floor(index * 26 / (completed + cancelled));
    return {
      month, code: `DEMO-HIST-2026${String(month).padStart(2, '0')}-${String(index + 1).padStart(3, '0')}`,
      createdAt: vnDate(month, day, index % 2 ? 14 : 8),
      completed: index < completed,
      kind: month === 6 ? 0 : index % 3,
      quantity: 1 + (index + month) % 4,
      optionIndex: index % 3,
    };
  }));
}

async function main() {
  // Chỉ nạp cấu hình để kết nối; tuyệt đối không in URI hoặc thông tin xác thực.
  (await import('dotenv')).config({ quiet: true });
  const apply = process.argv.includes('--apply');
  const expectedDatabase = process.argv.find(value => value.startsWith('--database='))?.slice('--database='.length);
  assert(expectedDatabase, 'Cần chỉ định rõ --database=<tên database>.');
  assert(process.env.NODE_ENV !== 'production', 'Không tạo dữ liệu thử nghiệm trong môi trường production.');
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  assert(uri, 'Chưa cấu hình kết nối MongoDB.');
  const realNow = mongoose.now;
  let clock = vnDate(6, 24, 8);
  mongoose.now = () => new Date(clock);
  const at = (date: Date) => { clock = date; };
  try {
    await mongoose.connect(uri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10_000 });
    assert.equal(mongoose.connection.name, expectedDatabase, 'Tên database không khớp, đã dừng ghi.');
    const { buildServicePricingSnapshot } = await import('../services/servicePricing.service');
    const { getNumberConfigValue } = await import('../services/systemConfig.service');
    const { recordCompletedOrderSettlement } = await import('../services/wallet.service');
    const { earnOrderRewards } = await import('../services/reward.service');
    const { getAdminMonthlyTrend } = await import('../services/adminMonthlyTrend.service');
    const customer = await User.findOne({ _id: CUSTOMER, role: 'CUSTOMER', status: 'active', isDeleted: false }).select('fullName createdAt');
    const admin = await User.findOne({ _id: ADMIN, role: 'ADMIN', status: 'active', isDeleted: false }).select('createdAt');
    assert(customer && admin, 'Không tìm thấy đúng tài khoản khách/quản trị viên thử nghiệm.');
    const address = await Address.findOne({ userId: CUSTOMER, isDeleted: false }).lean();
    assert(address && address.latitude != null && address.longitude != null, 'Khách thử nghiệm chưa có địa chỉ hợp lệ.');
    assert(customer.createdAt < clock && admin.createdAt < clock && address.createdAt < clock, 'Tài khoản/địa chỉ chưa tồn tại tại thời điểm tạo mẫu.');
    const services = await Promise.all(['Vệ Sinh Điều Hòa', 'Vận Chuyển Hàng Hóa', 'Vệ Sinh Nhà Cửa'].map(name => Service.findOne({ name, serviceType: 'fixed_price', isDeleted: false, isActive: true })));
    assert(services.every(Boolean), 'Chưa có đủ dịch vụ giá cố định trong danh mục.');
    const catalog = services.map(service => service!);
    assert(catalog.every(service => service.createdAt < clock), 'Dịch vụ chưa tồn tại vào thời điểm tạo mẫu.');
    const transportOptions = await ServiceOption.find({ serviceId: catalog[1]._id, isDeleted: false, isActive: true }).sort({ price: 1 });
    const cleaningOptions = await ServiceOption.find({ serviceId: catalog[2]._id, isDeleted: false, isActive: true }).sort({ price: 1 });
    assert(transportOptions.length && cleaningOptions.length, 'Dịch vụ chưa có bảng giá hợp lệ.');
    const rate = await getNumberConfigValue('PLATFORM_FEE_PERCENT', 15) / 100;
    const responseTimeout = getProviderResponseTimeoutSeconds(
      await getNumberConfigValue('MATCHING_PROVIDER_TIMEOUT_SECONDS', 60),
      await getNumberConfigValue('MATCHING_EXPAND_AFTER_MINUTES', 1),
    ) * 1000;
    assert(rate >= 0 && rate <= 1, 'Tỷ lệ phí nền tảng không hợp lệ.');
    const specs = historySpecifications();
    const plans: Array<ReturnType<typeof historySpecifications>[number] & {
      service: typeof catalog[number];
      pricing: Awaited<ReturnType<typeof buildServicePricingSnapshot>>;
      settlement: ReturnType<typeof calculateBookingSettlement>;
    }> = [];
    for (const spec of specs) {
      const service = catalog[spec.kind];
      const option = spec.kind === 1 ? transportOptions[0] : spec.kind === 2 ? cleaningOptions[spec.optionIndex % cleaningOptions.length] : null;
      assert(!option || option.createdAt < spec.createdAt, 'Tùy chọn giá chưa tồn tại vào ngày đặt đơn.');
      const pricing = await buildServicePricingSnapshot(service, option ? [String(option._id)] : [], undefined, option ? undefined : spec.quantity, 'normal');
      assert(pricing.bookingAmount > 0, 'Giá trị đơn phải lớn hơn 0.');
      plans.push({ ...spec, service, pricing, settlement: calculateBookingSettlement(pricing.bookingAmount, rate, false) });
    }
    const monthSummary = [6, 7, 8, 9].map(month => {
      const rows = plans.filter(plan => plan.month === month);
      const done = rows.filter(plan => plan.completed);
      return { month: `2026-${String(month).padStart(2, '0')}`, orders: rows.length, completed: done.length,
        cancelled: rows.length - done.length, revenue: done.reduce((sum, row) => sum + row.pricing.bookingAmount, 0), income: done.reduce((sum, row) => sum + row.settlement.platformCommissionAmount, 0) };
    });
    const totalFees = monthSummary.reduce((sum, month) => sum + month.income, 0);
    const funding = totalFees + 200_000;
    const existing = await Order.countDocuments({ orderCode: { $in: specs.map(spec => spec.code) } });
    const existingCodes = new Set((await Order.find({ orderCode: { $in: specs.map(spec => spec.code) } }).select('orderCode').lean()).map(order => order.orderCode));
    const priorUser = await User.findOne({ email: EMAIL }).select('_id');
    if (priorUser) {
      const provider = await Provider.findOne({ userId: priorUser._id, description: DESCRIPTION });
      assert(provider, 'Tài khoản đánh dấu lô không thuộc dữ liệu thử nghiệm này.');
    } else {
      assert.equal(existing, 0, 'Có đơn trùng mã nhưng thiếu tài khoản lô thử nghiệm.');
      assert.equal(await RewardTransaction.countDocuments({ userId: CUSTOMER }), 0, 'Khách đã có sổ điểm; cần đối soát trước khi ghi lịch sử.');
      assert.equal(await RewardAccount.countDocuments({ _id: CUSTOMER }), 0, 'Khách đã có tài khoản điểm; cần đối soát trước khi ghi lịch sử.');
    }
    console.log(JSON.stringify({ batch: BATCH, database: mongoose.connection.name, mode: apply ? 'ghi dữ liệu' : 'xem trước, chưa ghi', existing, months: monthSummary, testWalletFunding: funding }));
    if (!apply) return;
    const reportDirectory = path.resolve('data', BATCH);
    await mkdir(reportDirectory, { recursive: true });
    const range = { fromDate: vnDate(6, 1, 0), toDate: new Date('2026-09-30T23:59:59.999+07:00') };
    const before = await getAdminMonthlyTrend(range);
    await writeFile(path.join(reportDirectory, `before-${Date.now()}.json`), JSON.stringify({ batch: BATCH, database: mongoose.connection.name, createdAt: new Date().toISOString(), months: monthSummary, chart: before }, null, 2));
    const userId = stableId('provider-user', vnDate(6, 24, 8));
    const providerId = stableId('provider', vnDate(6, 24, 10));
    const walletId = stableId('wallet', plusMinutes(vnDate(6, 24, 10), 1));
    if (!priorUser) {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          at(vnDate(6, 24, 8));
          const [user] = await User.create([{ _id: userId, email: EMAIL, fullName: 'Thợ Dữ Liệu Biểu Đồ', passwordHash: null, role: 'CUSTOMER', registrationIntent: 'PROVIDER', providerOnboardingStatus: 'PENDING_REVIEW', providerOnboardingStep: 3, isEmailVerified: true, status: 'active' }], { session });
          at(vnDate(6, 24, 9));
          const [application] = await ProviderApplication.create([{ _id: stableId('application', clock), userId, applicationType: 'initial', description: DESCRIPTION, experienceYears: 3, serviceIds: catalog.map(service => service._id), status: 'pending', submittedAt: clock, reviewHistory: [{ action: 'submitted', status: 'pending', actorId: userId, actorRole: 'CUSTOMER', occurredAt: clock, notes: DESCRIPTION }] }], { session });
          at(vnDate(6, 24, 10));
          application.status = 'approved'; application.reviewedAt = clock; application.reviewedBy = new Types.ObjectId(ADMIN);
          application.reviewHistory.push({ action: 'approved', status: 'approved', actorId: new Types.ObjectId(ADMIN), actorRole: 'ADMIN', occurredAt: clock, notes: DESCRIPTION });
          await application.save({ session });
          user.role = 'PROVIDER'; user.providerOnboardingStatus = 'APPROVED'; user.providerOnboardingStep = null;
          await user.save({ session });
          await Provider.create([{ _id: providerId, userId, description: DESCRIPTION, experienceYears: 3, serviceIds: catalog.map(service => service._id), verified: true, availabilityStatus: 'offline', serviceArea: { province: address.province, ward: address.ward } }], { session });
          at(plusMinutes(vnDate(6, 24, 10), 1));
          await Wallet.create([{ _id: walletId, userId, balance: funding, pendingBalance: 0, currency: 'VND' }], { session });
          await WalletTransaction.create([{ _id: stableId('funding', clock), walletId, userId, type: 'adjustment', direction: 'in', amount: funding, balanceAfter: funding, status: 'success', transactionCode: `${BATCH}-FUNDING`, description: 'Điều chỉnh số dư thử nghiệm để thanh toán phí nền tảng, không phải tiền nạp qua cổng thanh toán.', metadata: { seedBatch: BATCH, synthetic: true, adminId: ADMIN, providerId, affectsWalletBalance: true } }], { session });
        });
      } finally { await session.endSession(); }
    }
    for (const plan of plans) {
      if (await Order.exists({ orderCode: plan.code })) continue;
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          at(plan.createdAt);
          const orderId = stableId(plan.code, clock);
          const acceptedAt = new Date(clock.getTime() + Math.max(1, Math.floor(responseTimeout / 3)));
          const startAt = new Date(Math.max(plusMinutes(clock, plan.pricing.schedule.travelMinutes).getTime(), acceptedAt.getTime() + 60_000));
          const endAt = plusMinutes(startAt, plan.pricing.schedule.durationMinutes);
          const [order] = await orderActorContext.run({ id: CUSTOMER, role: 'customer' }, () => Order.create([{
            _id: orderId, orderCode: plan.code, customerId: new Types.ObjectId(CUSTOMER), preferredProviderId: providerId,
            serviceId: plan.service._id, selectedOptionIds: plan.pricing.optionIds, selectedOptionsSnapshot: plan.pricing.selectedOptionsSnapshot,
            addressId: address._id, addressSnapshot: { fullAddress: address.fullAddress, province: address.province, ward: address.ward, latitude: address.latitude, longitude: address.longitude },
            orderType: 'normal', bookingStatus: 'not_required', status: 'created', readyForMatching: true, matchingStartedAt: clock,
            paymentMethod: 'cash', paymentStatus: 'unpaid', inspectionRequired: false, depositAmount: 0,
            problemDescription: `${DESCRIPTION} Đơn mô phỏng, không phải giao dịch dịch vụ thực tế.`,
            schedule: { ...plan.pricing.schedule, expectedStartAt: startAt, expectedEndAt: endAt },
            pricing: { baseAmount: plan.pricing.baseAmount, bookingAmount: plan.pricing.bookingAmount, platformCommissionRate: rate, ...plan.settlement, promotionDiscountAmount: 0, voucherDiscountAmount: 0, totalPaidAmount: plan.pricing.bookingAmount },
          }], { session }));
          const [payment] = await Payment.create([{ _id: stableId(`${plan.code}:payment`, clock), orderId, customerId: new Types.ObjectId(CUSTOMER), method: 'cash', paymentType: 'full', amount: plan.pricing.bookingAmount, status: 'pending', transactionCode: `${plan.code}-CASH`, metadata: { seedBatch: BATCH, synthetic: true } }], { session });
          const [assignment] = await OrderAssignment.create([{ _id: stableId(`${plan.code}:assignment`, clock), orderId, providerId, assignmentType: 'direct_request', status: 'pending', assignedAt: clock, responseDeadline: new Date(clock.getTime() + responseTimeout) }], { session });
          if (!plan.completed) {
            at(new Date(plan.createdAt.getTime() + Math.max(1, Math.floor(responseTimeout / 4))));
            order.status = 'cancelled'; order.readyForMatching = false;
            order.cancellation = { cancelledBy: new Types.ObjectId(CUSTOMER), cancelledByRole: 'customer', reason: 'Hủy đơn thử nghiệm trước khi thợ nhận, chưa thanh toán.', cancelledAt: clock };
            await orderActorContext.run({ id: CUSTOMER, role: 'customer' }, () => order.save({ session }));
            assignment.status = 'cancelled'; assignment.respondedAt = clock; await assignment.save({ session });
            payment.status = 'failed'; payment.failedAt = clock; payment.failureReason = 'Đơn thử nghiệm đã hủy trước thanh toán.'; await payment.save({ session });
            return;
          }
          at(acceptedAt);
          assignment.status = 'accepted'; assignment.respondedAt = clock; await assignment.save({ session });
          order.providerId = providerId; order.status = 'accepted'; order.readyForMatching = false;
          await orderActorContext.run({ id: String(userId), role: 'provider' }, () => order.save({ session }));
          at(startAt);
          order.status = 'in_progress'; order.arrival = { providerId, arrivedAt: clock, latitude: address.latitude!, longitude: address.longitude! };
          await orderActorContext.run({ id: String(userId), role: 'provider' }, () => order.save({ session }));
          at(endAt);
          payment.status = 'paid'; payment.paidAt = clock; await payment.save({ session });
          order.paymentStatus = 'paid';
          const provider = await Provider.findById(providerId).session(session);
          assert(provider, 'Thiếu hồ sơ thợ thử nghiệm.');
          const settled = await recordCompletedOrderSettlement(order, provider, session);
          for (const transaction of [settled.earningTransaction, settled.platformFeeTransaction]) {
            if (!transaction) continue;
            transaction.metadata = { ...transaction.metadata, seedBatch: BATCH, synthetic: true };
            transaction.transactionCode = `${plan.code}-${transaction.type}`;
            await transaction.save({ session });
          }
          order.status = 'completed'; order.confirmation.providerConfirmedAt = clock;
          // Ảnh SVG chỉ rõ dữ liệu mô phỏng, không dùng ảnh giả làm bằng chứng dịch vụ thực tế.
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="360"><rect width="720" height="360" fill="#f3f1ff"/><text x="40" y="140" font-size="28">DỮ LIỆU THỬ NGHIỆM HANDIGO</text><text x="40" y="200" font-size="20">${plan.code}</text><text x="40" y="250" font-size="18">Ảnh minh họa, không phải nghiệm thu dịch vụ thực tế</text></svg>`;
          order.completionEvidenceImages = [`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`];
          order.completionNote = DESCRIPTION;
          await orderActorContext.run({ id: String(userId), role: 'provider' }, () => order.save({ session }));
          provider.totalCompletedOrders += 1; await provider.save({ session });
          await earnOrderRewards(order, session);
        });
      } finally { await session.endSession(); }
      console.log(JSON.stringify({ saved: plan.code, status: plan.completed ? 'completed' : 'cancelled' }));
    }
    at(new Date());
    const orders = await Order.find({ orderCode: { $in: specs.map(spec => spec.code) } }).lean();
    assert.equal(orders.length, specs.length);
    const wallet = await Wallet.findById(walletId).lean();
    assert(wallet);
    const ledger = await WalletTransaction.find({ walletId, isDeleted: false }).sort({ createdAt: 1, _id: 1 }).lean();
    let balance = 0;
    for (const entry of ledger) {
      if (entry.metadata?.affectsWalletBalance !== false) balance += entry.direction === 'in' ? entry.amount : -entry.amount;
      assert.equal(entry.balanceAfter, balance, `Số dư sau giao dịch không khớp: ${entry.transactionCode}`);
    }
    assert.equal(wallet.balance, balance);
    assert.equal(balance, funding - totalFees);
    for (const order of orders) {
      const history = await OrderStatus.find({ orderId: order._id, isDeleted: false }).sort({ statusVersion: 1 }).lean();
      const expected = order.status === 'completed' ? ['created', 'accepted', 'in_progress', 'completed'] : ['created', 'cancelled'];
      assert.deepEqual(history.map(row => row.status), expected);
      assert(history.every((row, index) => index === 0 || row.createdAt >= history[index - 1].createdAt));
      const payment = await Payment.findOne({ orderId: order._id, isDeleted: false }).lean();
      assert(payment && payment.amount === order.pricing.totalPaidAmount);
      const assignment = await OrderAssignment.findOne({ orderId: order._id }).lean();
      assert(assignment?.respondedAt && assignment.respondedAt < assignment.responseDeadline);
      const entries = ledger.filter(row => String(row.relatedOrderId) === String(order._id));
      if (order.status === 'completed') {
        assert.equal(payment.status, 'paid'); assert.equal(entries.length, 2);
        assert.equal(order.pricing.platformCommissionAmount + order.pricing.providerEarningAmount, payment.amount);
        assert(entries.every(entry => entry.status === 'success' && entry.createdAt.getTime() === order.confirmation.providerConfirmedAt?.getTime()));
        assert(await RewardTransaction.exists({ _id: `earn:${order._id}` }));
      } else { assert.equal(payment.status, 'failed'); assert.equal(entries.length, 0); }
    }
    const provider = await Provider.findById(providerId).lean();
    assert.equal(provider?.totalCompletedOrders, orders.filter(order => order.status === 'completed').length);
    const after = await getAdminMonthlyTrend(range);
    for (const month of monthSummary) {
      const previous = before.points.find(point => point.month === month.month);
      const current = after.points.find(point => point.month === month.month);
      assert(previous && current);
      const inserted = plans.filter(plan => plan.completed && !existingCodes.has(plan.code) && plan.month === Number(month.month.slice(5)));
      assert.equal(current.orders - previous.orders, inserted.length);
      assert.equal(current.completedRevenue - previous.completedRevenue, inserted.reduce((sum, plan) => sum + plan.pricing.bookingAmount, 0));
      assert.equal(current.platformRevenue - previous.platformRevenue, inserted.reduce((sum, plan) => sum + plan.settlement.platformCommissionAmount, 0));
    }
    const report = { batch: BATCH, database: mongoose.connection.name, months: monthSummary, orders: orders.map(order => ({ id: order._id, code: order.orderCode, status: order.status })), providerId, walletId, funding, finalWalletBalance: balance, ledgerEntries: ledger.length, checksPassed: true, chart: after };
    await writeFile(path.join(reportDirectory, 'result.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ batch: BATCH, checksPassed: true, months: monthSummary, finalWalletBalance: balance, ledgerEntries: ledger.length, chart: after.points, report: path.join(reportDirectory, 'result.json') }));
  } finally {
    mongoose.now = realNow;
    await mongoose.disconnect();
  }
}

if (require.main === module) void main().catch(error => {
  // Không in lỗi driver nguyên bản vì có thể chứa địa chỉ kết nối.
  console.error(error instanceof assert.AssertionError ? error.message : `Không thể tạo dữ liệu thử nghiệm (${error?.code || error?.name || 'lỗi không xác định'}).`);
  process.exitCode = 1;
});
