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
  execute: (context, args) => AgentBookingService.providers(context.user.id, args, context.session?.bookingDraft?.draftAddress),
};
export const saveBookingAddressTool: AgentTool<AgentAddressArguments> = {
  name: "save_booking_address", description: "Giữ tạm địa chỉ mới theo lệnh khách cho bản nháp đang đặt, chỉ lưu địa chỉ cùng đơn khi xác nhận đặt thành công, không hiện form xác nhận lưu riêng; backend kiểm tra lại bản nháp rồi gửi form xác nhận đơn hàng. Sửa địa chỉ đã lưu hoặc chỉ quản lý sổ địa chỉ vẫn cần xác nhận. Ưu tiên addressText là nguyên địa chỉ khách nhập, kể cả tên trường/tòa nhà hoặc chỉ phường/xã và tỉnh/thành phố. Backend tự nhận diện và xác thực khu vực; KHÔNG bắt buộc số nhà/tên đường hoặc tìm được tọa độ mới được lưu. Hãy gọi tool trước khi kết luận địa chỉ thiếu; chỉ hỏi khu vực khi chưa xác định duy nhất. Có thể gửi fullAddress/ward/province khi đã rõ. Không bịa tọa độ/mã hành chính. addressId chỉ khi khách muốn sửa địa chỉ hiện có; useForBooking mặc định true, false nếu chỉ quản lý sổ địa chỉ. Tên/điện thoại lấy từ hồ sơ nếu đủ. Preview ghi rõ vị trí tham chiếu hoặc chưa có tọa độ; khi đặt đơn cần tra lại/chọn ghim trước khi tìm thợ. Không tự thay địa chỉ bằng mục đã lưu.",
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
