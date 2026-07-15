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

export const cancelOrderSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Lý do hủy phải có ít nhất 3 ký tự")
    .max(500, "Lý do hủy không được vượt quá 500 ký tự"),
});

export const orderIdParamSchema = z.object({
  orderId: objectIdSchema,
});

const latitudeSchema = z.coerce.number().min(-90).max(90);
const longitudeSchema = z.coerce.number().min(-180).max(180);

export const trackingRouteQuerySchema = z
  .object({
    originLatitude: latitudeSchema.optional(),
    originLongitude: longitudeSchema.optional(),
    destinationLatitude: latitudeSchema.optional(),
    destinationLongitude: longitudeSchema.optional(),
  })
  .superRefine((query, context) => {
    const values = [
      query.originLatitude,
      query.originLongitude,
      query.destinationLatitude,
      query.destinationLongitude,
    ];
    const providedCount = values.filter((value) => value !== undefined).length;
    if (providedCount > 0 && providedCount < values.length) {
      context.addIssue({
        code: "custom",
        message: "Phải cung cấp đầy đủ tọa độ điểm đi và điểm đến.",
      });
    }
  });

export type TrackingRouteQuery = z.infer<typeof trackingRouteQuerySchema>;

export const assignmentIdParamSchema = z.object({
  assignmentId: objectIdSchema,
});

export const rejectAssignmentSchema = z.object({
  rejectReason: z
    .string()
    .trim()
    .max(500, "Lý do từ chối không được vượt quá 500 ký tự")
    .optional(),
});
