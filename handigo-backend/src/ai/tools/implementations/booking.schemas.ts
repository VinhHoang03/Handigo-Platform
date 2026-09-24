import { z } from "zod";
import { createOrderSchema, cancelOrderSchema, orderIdParamSchema } from "../../../validations/order.validator";

export const idSchema = createOrderSchema.shape.serviceId;
export const priceSchema = z.object({
  serviceId: idSchema,
  selectedOptions: createOrderSchema.shape.selectedOptions,
}).strict();
export const bookingSchema = priceSchema.extend({
  addressId: createOrderSchema.shape.addressId,
  orderType: z.enum(["normal", "scheduled"]),
  scheduledAt: createOrderSchema.shape.scheduledAt,
  problemDescription: createOrderSchema.shape.problemDescription,
  paymentMethod: createOrderSchema.shape.paymentMethod,
}).strict().superRefine((value, ctx) => {
  if (value.orderType === "scheduled" && (!value.scheduledAt || Date.parse(value.scheduledAt) <= Date.now())) {
    ctx.addIssue({ code: "custom", path: ["scheduledAt"], message: "Vui lòng chọn giờ hẹn trong tương lai." });
  }
  if (value.orderType === "normal" && value.scheduledAt) {
    ctx.addIssue({ code: "custom", path: ["orderType"], message: "Có giờ hẹn thì phải chọn loại scheduled." });
  }
});
export const availabilitySchema = z.object({
  serviceId: idSchema, addressId: idSchema,
  times: z.array(z.string().datetime({ offset: true })).min(1).max(8),
}).strict();
export const cancelSchema = orderIdParamSchema.extend({ reason: cancelOrderSchema.shape.reason }).strict();
export type BookingArguments = z.infer<typeof bookingSchema>;
