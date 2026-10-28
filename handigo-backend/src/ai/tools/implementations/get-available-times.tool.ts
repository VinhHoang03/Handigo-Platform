import type { z } from "zod";
import { AgentBookingService } from "../../../services/agentBooking.service";
import type { AgentTool } from "../tool.interface";
import { availabilitySchema } from "./booking.schemas";
export const getAvailableTimesTool: AgentTool<z.infer<typeof availabilitySchema>> = {
  name: "get_available_times", description: "Kiểm tra tối đa 8 thời điểm dự kiến hợp lệ tại địa chỉ đang đặt, không sớm hơn phút hiện tại. Gửi selectedOptions hoặc uniformQuantity để kiểm tra đúng thời lượng. Nếu khách đã chọn thợ, kiểm tra riêng preferredProviderId; backend tự lấy từ bản nháp khi cùng dịch vụ. hasCandidate khi đó chỉ nói về thợ được chọn; không suy từ thợ khác. Giữ điều kiện trực tuyến hiện có, không giữ chỗ.",
  inputSchema: availabilitySchema, mutates: false, requiresConfirmation: false, roles: ["CUSTOMER"],
  execute: (context, args) => {
    const draft = context.session?.bookingDraft?.values;
    const pricing = args.selectedOptions !== undefined || args.uniformQuantity !== undefined || draft?.serviceId !== args.serviceId
      ? {} : { selectedOptions: draft.selectedOptions, uniformQuantity: draft.uniformQuantity };
    const preferredProviderId = args.preferredProviderId ?? (draft?.serviceId === args.serviceId ? draft.preferredProviderId : undefined);
    return AgentBookingService.availableTimes(context.user.id, { ...pricing, ...args, preferredProviderId }, context.session?.bookingDraft?.draftAddress);
  },
};
