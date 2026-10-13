import { z } from "zod";
import { AgentBookingService } from "../../../services/agentBooking.service";
import { AgentAddressService, agentAddressSchema, type AgentAddressArguments } from "../../../services/agentAddress.service";
import { bookingSchema, priceSchema } from "./booking.schemas";
import type { AgentTool } from "../tool.interface";

export const getBookingVouchersTool: AgentTool<z.infer<typeof priceSchema>> = {
  name: "get_booking_vouchers", description: "Xem voucher của khách và mã công khai dùng được cho giá/gói dịch vụ đang đặt, gồm số tiền giảm và số tiền còn lại. Không áp dụng hoặc giữ mã. Dùng update_booking_draft để chọn voucherCode sau khi khách đồng ý; null để không dùng.",
  inputSchema: priceSchema, roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
  execute: (context, args) => AgentBookingService.vouchers(context.user.id, args),
};
const providerSchema = bookingSchema.extend({ providerQuery: z.string().trim().min(1).max(100).optional() });
export const searchBookingProvidersTool: AgentTool<z.infer<typeof providerSchema>> = {
  name: "search_booking_providers", description: "Tìm chuyên gia đang trực tuyến, đúng dịch vụ, khu vực và không trùng lịch cho bản nháp. providerQuery là tên khách yêu cầu; requested cho biết có phù hợp không và lý do, available là lựa chọn thay thế. Không tự thay thợ; chọn ID bằng update_booking_draft sau khi khách chọn.",
  inputSchema: providerSchema, roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
  execute: (context, args) => AgentBookingService.providers(context.user.id, args),
};
export const saveBookingAddressTool: AgentTool<AgentAddressArguments> = {
  name: "save_booking_address", description: "Thêm địa chỉ mới hoặc sửa địa chỉ đã lưu của khách sau xác nhận. Địa chỉ cần số nhà/đường, phường/xã, tỉnh/thành phố; không tự bịa phần thiếu. addressId chỉ dùng khi khách muốn sửa địa chỉ hiện có. Hệ thống tra tọa độ và tái sử dụng địa chỉ trùng. Tên/số điện thoại mặc định lấy từ hồ sơ; hỏi nếu hồ sơ thiếu. useForBooking mặc định true: sau lưu sẽ dùng địa chỉ cho bản nháp đang đặt; false khi khách chỉ quản lý sổ địa chỉ.",
  inputSchema: agentAddressSchema, roles: ["CUSTOMER"], mutates: true, requiresConfirmation: true,
  preview: (context, args) => AgentAddressService.preview(context.user.id, args),
  execute: async (context, args) => {
    const result = await AgentAddressService.save(context.user.id, args, context.confirmedPreview);
    if (args.useForBooking && context.session?.bookingDraft && ["active", "paused"].includes(context.session.bookingDraft.status)) {
      // Lưu lựa chọn ngay sau ghi địa chỉ để lượt tiếp theo không quay về địa chỉ mặc định.
      context.session.bookingDraft.values.addressId = result.addressId;
      context.session.bookingDraft.sources.addressId = "customer";
      context.session.bookingDraft.addressPreference = undefined;
      context.session.bookingDraft.status = "active";
    }
    return { ...result, nextStep: args.useForBooking
      ? "Địa chỉ đã lưu và được chọn cho bản nháp. Gọi update_booking_draft với mode resume để kiểm tra lại voucher, thợ và hiển thị form đặt đơn. Không lưu lại địa chỉ."
      : "Địa chỉ đã lưu; không thay đổi bản nháp đặt đơn." };
  },
};
