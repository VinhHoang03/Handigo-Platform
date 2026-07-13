import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "ID không hợp lệ");

export const createOrderSchema = z.object({
  serviceId: objectIdSchema,
  servicePackageId: objectIdSchema.optional(),
  selectedOptionIds: z.array(objectIdSchema).max(50).optional(),
  addressId: objectIdSchema,
  preferredProviderId: objectIdSchema.optional(),
  orderType: z
    .enum(["normal", "urgent", "scheduled", "recurring"])
    .optional(),
  scheduledAt: z
    .string()
    .datetime({ offset: true, message: "Thời gian thực hiện không hợp lệ" })
    .optional(),
  problemDescription: z.string().trim().max(2000).optional(),
  customerAttachments: z.array(z.string().url()).max(4).optional(),
  promotionId: objectIdSchema.optional(),
  voucherId: objectIdSchema.optional(),
  paymentMethod: z.enum(["wallet", "bank", "cash"]),
});
