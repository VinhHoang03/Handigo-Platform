import { z } from "zod";
import { createOrderSchema, cancelOrderSchema, orderIdParamSchema } from "../../../validations/order.validator";
import { getEarliestScheduledAt, isWithinAppointmentHours } from "../../../utils/bookingPolicy";
import { bookingAttachmentsSchema } from "../../agent/booking-attachments";

export const idSchema = createOrderSchema.shape.serviceId;
export const priceSchema = z.object({
  serviceId: idSchema,
  selectedOptions: createOrderSchema.shape.selectedOptions,
  uniformQuantity: z.number().int().min(1).max(99).optional(),
}).strict();
export const bookingSchema = priceSchema.extend({
  addressId: createOrderSchema.shape.addressId,
  saveAddressToBook: z.boolean().optional(),
  orderType: z.enum(["normal", "scheduled"]),
  scheduledAt: createOrderSchema.shape.scheduledAt,
  problemDescription: createOrderSchema.shape.problemDescription,
  customerAttachments: bookingAttachmentsSchema.optional(),
  paymentMethod: createOrderSchema.shape.paymentMethod,
  voucherCode: createOrderSchema.shape.voucherCode,
  preferredProviderId: createOrderSchema.shape.preferredProviderId,
}).strict().superRefine((value, ctx) => {
  if (value.orderType === "normal" && !isWithinAppointmentHours(new Date())) {
    ctx.addIssue({ code: "custom", path: ["orderType"], message: "Đặt ngay chỉ khả dụng từ 08:00 đến 21:00 theo giờ Việt Nam. Vui lòng chọn Hẹn giờ." });
  }
  if (value.orderType === "scheduled" && (!value.scheduledAt || Date.parse(value.scheduledAt) < getEarliestScheduledAt().getTime())) {
    ctx.addIssue({ code: "custom", path: ["scheduledAt"], message: "Vui lòng chọn giờ hẹn trong tương lai." });
  }
  if (value.orderType === "normal" && value.scheduledAt) {
    ctx.addIssue({ code: "custom", path: ["orderType"], message: "Có giờ hẹn thì phải chọn loại scheduled." });
  }
  if (value.scheduledAt && !isWithinAppointmentHours(new Date(value.scheduledAt))) {
    ctx.addIssue({ code: "custom", path: ["scheduledAt"], message: "Vui lòng chọn giờ hẹn hợp lệ." });
  }
});
export const availabilitySchema = priceSchema.extend({
  addressId: idSchema,
  preferredProviderId: idSchema.optional(),
  times: z.array(z.string().datetime({ offset: true })).min(1).max(8),
}).strict();
export const cancelSchema = orderIdParamSchema.extend({ reason: cancelOrderSchema.shape.reason }).strict();
export type BookingArguments = z.infer<typeof bookingSchema>;
