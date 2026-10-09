import "dotenv/config";
import mongoose, { Types } from "mongoose";
import User from "../models/user.model";
import { Provider } from "../models/provider.model";
import { Address } from "../models/address.model";
import { Order, OrderStatusValue } from "../models/order.model";
import { OrderAssignment } from "../models/orderAssignment.model";
import { Payment } from "../models/payment.model";
import { Service, IService } from "../models/service.model";
import { ServiceOption } from "../models/serviceOption.model";
import { Wallet } from "../models/wallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { buildServicePricingSnapshot } from "../services/servicePricing.service";
import { getNumberConfigValue } from "../services/systemConfig.service";
import { calculateBookingSettlement } from "../utils/bookingPolicy";

// Chỉ dùng cho dữ liệu xem thử; mặc định kiểm tra kế hoạch, --apply mới ghi.
mongoose.set("autoIndex", false);
mongoose.set("autoCreate", false);
const marker = "HDG-UI-PROVIDER";
const argument = (name: string) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
};

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("Chưa cấu hình kết nối MongoDB của backend.");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const providerName = argument("--provider-name") ?? "Nguyễn Văn Thứ";
  const users = await User.find({ fullName: providerName, role: "PROVIDER",
    status: "active", isDeleted: false }).select("_id fullName providerOnboardingStatus");
  if (users.length !== 1 || users[0].providerOnboardingStatus !== "APPROVED") {
    throw new Error("Cần đúng một tài khoản thợ đã duyệt có tên được chỉ định.");
  }
  const user = users[0];
  const provider = await Provider.findOne({ userId: user._id, isDeleted: false });
  if (!provider) throw new Error("Không tìm thấy hồ sơ thợ hợp lệ.");

  const customerId = argument("--customer-id");
  if (customerId && !Types.ObjectId.isValid(customerId)) {
    throw new Error("ID khách hàng không hợp lệ.");
  }
  const previous = await Order.findOne({ providerId: provider._id, isDeleted: false })
    .sort({ createdAt: -1 }).select("customerId");
  const customer = await User.findOne({
    ...(customerId ? { _id: customerId } : previous
      ? { _id: previous.customerId } : { email: /(?:ui|test|demo)/i }),
    role: "CUSTOMER", status: "active", isDeleted: false,
  }).select("_id fullName");
  if (!customer) throw new Error("Chưa tìm thấy khách hàng dùng thử. Chỉ định --customer-id <ID>.");
  const address = await Address.findOne({ userId: customer._id, isDeleted: false })
    .sort({ isDefault: -1 }).select("_id");
  if (!address) throw new Error("Khách hàng cần có địa chỉ còn hiệu lực trước khi seed.");

  const services = await Service.find({ _id: { $in: provider.serviceIds },
    isDeleted: false, isActive: true, serviceType: "fixed_price" }).sort({ name: 1 });
  const usable: Array<{ service: IService; pricing: Awaited<ReturnType<typeof buildServicePricingSnapshot>> }> = [];
  for (const service of services) {
    try {
      const options = await ServiceOption.find({ serviceId: service._id, isActive: true, isDeleted: false })
        .sort({ sortOrder: 1, price: 1 });
      const groups = new Map<string, string>();
      for (const option of options) {
        const group = option.groupId?.toString() ?? option.selectionGroup?.trim().toLowerCase() ?? option.id;
        if (!groups.has(group)) groups.set(group, option.id);
      }
      let pricing: Awaited<ReturnType<typeof buildServicePricingSnapshot>>;
      try { pricing = await buildServicePricingSnapshot(service, [], undefined, 1, "scheduled"); }
      catch { pricing = await buildServicePricingSnapshot(service, [...groups.values()], undefined, undefined, "scheduled"); }
      if (pricing.bookingAmount > 0) usable.push({ service, pricing });
    } catch {
      // Dịch vụ cần lựa chọn riêng phải được đặt bằng luồng booking bình thường.
    }
  }
  if (!usable.length) throw new Error("Thợ cần có dịch vụ giá cố định với giá và tùy chọn hợp lệ.");
  const commissionRate = Math.max(await getNumberConfigValue("PLATFORM_FEE_PERCENT", 15), 0) / 100;
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  const day = new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00+07:00`);
  const slots: Array<{ status: OrderStatusValue; hours: number }> = [
    { status: "completed", hours: -16 }, { status: "completed", hours: -14 },
    { status: "in_progress", hours: 13 }, { status: "accepted", hours: 16 },
    { status: "accepted", hours: 34 },
  ];
  const plans = slots.map((slot, index) => ({ ...slot, ...usable[index % usable.length],
    orderCode: `${marker}-${provider.id}-${index + 1}`,
    scheduledAt: new Date(day.getTime() + slot.hours * 3600000),
  }));
  console.log(JSON.stringify({ thongBao: "Kế hoạch dữ liệu xem thử", tho: user.fullName,
    khachHang: customer.fullName, donHang: plans.map((plan) => ({
      ma: plan.orderCode, dichVu: plan.service.name, trangThai: plan.status,
      soTien: plan.pricing.bookingAmount, lichHen: plan.scheduledAt.toISOString(),
    })) }, null, 2));
  if (!process.argv.includes("--apply")) {
    console.log("Chưa ghi database. Thêm --apply để tạo dữ liệu xem thử và thu nhập mô phỏng.");
    return;
  }

  // Tái sử dụng settlement hiện có; không gọi cổng thanh toán hoặc gửi thông báo.
  const { recordCompletedOrderSettlement } = await import("../services/wallet.service");
  const session = await mongoose.startSession();
  let created = 0;
  try {
    await session.withTransaction(async () => {
      created = 0;
      for (const plan of plans) {
        if (await Order.exists({ orderCode: plan.orderCode }).session(session)) continue;
        const completed = plan.status === "completed";
        const settlement = calculateBookingSettlement(plan.pricing.bookingAmount, commissionRate, false);
        const [order] = await Order.create([{
          orderCode: plan.orderCode, customerId: customer._id, providerId: provider._id,
          preferredProviderId: provider._id, serviceId: plan.service._id, addressId: address._id,
          orderType: "scheduled", scheduledAt: plan.scheduledAt, bookingStatus: "confirmed",
          selectedOptionIds: plan.pricing.optionIds, selectedOptionsSnapshot: plan.pricing.selectedOptionsSnapshot,
          schedule: plan.pricing.schedule,
          status: plan.status, paymentMethod: "bank", paymentStatus: "paid",
          inspectionRequired: false, readyForMatching: false,
          problemDescription: `[${marker}] Đơn xem thử tổng quan thợ, dựa trên dịch vụ và giá hiện có.`,
          completionNote: completed ? `[${marker}] Hoàn tất mô phỏng để kiểm tra hiệu suất.` : null,
          confirmation: { providerConfirmedAt: completed ? new Date() : null },
          pricing: { baseAmount: plan.pricing.baseAmount, immediateFee: 0,
            bookingAmount: plan.pricing.bookingAmount, platformCommissionRate: commissionRate,
            ...settlement, totalPaidAmount: plan.pricing.bookingAmount,
            promotionDiscountAmount: 0, voucherDiscountAmount: 0 },
        }], { session });
        await Payment.create([{
          orderId: order._id, customerId: customer._id, amount: plan.pricing.bookingAmount,
          method: "bank", paymentType: "full", status: "paid", paidAt: new Date(),
          gatewayResponse: { duLieuXemThu: marker },
        }], { session });
        await OrderAssignment.create([{
          orderId: order._id, providerId: provider._id, assignmentType: "appointment",
          status: "accepted", assignedAt: new Date(), responseDeadline: new Date(), respondedAt: new Date(),
        }], { session });
        if (completed) {
          await recordCompletedOrderSettlement(order, provider, session);
          await WalletTransaction.updateMany({ relatedOrderId: order._id }, {
            $set: { "metadata.duLieuXemThu": marker, description: `[${marker}] Quyết toán mô phỏng đơn xem thử.` },
          }, { session, runValidators: true });
          await Provider.updateOne({ _id: provider._id }, { $inc: { totalCompletedOrders: 1 } },
            { session, runValidators: true });
        }
        created++;
      }
    });
  } finally { await session.endSession(); }
  const wallet = await Wallet.findOne({ userId: user._id, isDeleted: false }).select("balance pendingBalance");
  console.log(JSON.stringify({ thongBao: "Đã seed và kiểm tra dữ liệu tổng quan", soDonMoi: created,
    soDonXemThu: await Order.countDocuments({ orderCode: { $in: plans.map((plan) => plan.orderCode) } }),
    soDuVi: wallet?.balance ?? 0, soDuCho: wallet?.pendingBalance ?? 0 }, null, 2));
}

main().catch(() => {
  // Không in lỗi driver vì có thể chứa thông tin kết nối.
  console.error("Seed chưa hoàn tất. Kiểm tra cấu hình, tên thợ đã duyệt, khách hàng có địa chỉ, dịch vụ và MongoDB hỗ trợ transaction.");
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
