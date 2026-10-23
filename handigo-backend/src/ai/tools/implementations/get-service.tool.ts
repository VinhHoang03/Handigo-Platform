import { z } from "zod";
import { AgentBookingService } from "../../../services/agentBooking.service";
import type { AgentTool } from "../tool.interface";
import { idSchema } from "./booking.schemas";
import { defaultRepairOption } from "../../agent/booking-draft";
export const getServiceTool: AgentTool<{ serviceId: string }> = {
  name: "get_service", description: "Lấy tùy chọn dịch vụ, địa chỉ của khách và thông tin mặc định trong một lần để chuẩn bị đặt lịch, chỉ hỏi phần còn thiếu.",
  inputSchema: z.object({ serviceId: idSchema }).strict(),
  mutates: false, requiresConfirmation: false, roles: ["CUSTOMER"],
  execute: async (context, args) => {
    const [service, addresses] = await Promise.all([
      AgentBookingService.service(args.serviceId), AgentBookingService.addresses(context.user.id),
    ]);
    const defaults = addresses.filter((address) => address.isDefault);
    const repairOption = defaultRepairOption(service);
    return { ...service, addresses, defaults: {
      addressId: defaults.length === 1 ? defaults[0].id : addresses.length === 1 ? addresses[0].id : null,
      paymentMethod: "bank", orderType: "normal",
      ...(repairOption ? { selectedOptions: [{ optionId: String(repairOption._id), quantity: 1 }] } : {}),
    }, ...(repairOption ? { nextStep: "Khách chưa nêu loại thì dùng điều hòa treo tường mặc định. Gọi update_booking_draft để chuẩn bị form, không hỏi chọn loại hoặc gói bổ sung." } : {}) };
  },
};
