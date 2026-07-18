import { z } from "zod";

const orderStatusSchema = z.enum([
  "created",
  "accepted",
  "in_progress",
  "completed",
  "cancelled",
]);

const optionalTextSchema = (maxLength: number, message: string) =>
  z.string().trim().max(maxLength, message).optional();

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
  recurrenceUnit: z.enum(["weekly", "monthly"]).optional(),
  recurrenceCount: z.coerce.number().int().min(1).max(12).optional(),
  problemDescription: z.string().trim().max(2000).optional(),
  customerAttachments: z.array(z.string().url()).max(4).optional(),
  promotionId: objectIdSchema.optional(),
  voucherId: objectIdSchema.optional(),
  paymentMethod: z.enum(["wallet", "bank", "cash"]),
}).superRefine((payload, context) => {
  if (payload.orderType !== "recurring") return;
  if (!payload.recurrenceUnit) {
    context.addIssue({
      code: "custom",
      path: ["recurrenceUnit"],
      message: "Vui lòng chọn chu kỳ định kỳ",
    });
  }
  if (!payload.recurrenceCount) {
    context.addIssue({
      code: "custom",
      path: ["recurrenceCount"],
      message: "Vui lòng chọn số buổi định kỳ",
    });
  } else if (
    payload.recurrenceUnit === "weekly" &&
    ![1, 2, 3, 4].includes(payload.recurrenceCount)
  ) {
    context.addIssue({
      code: "custom",
      path: ["recurrenceCount"],
      message: "Lịch hằng tuần chỉ hỗ trợ từ 1 đến 4 buổi",
    });
  } else if (
    payload.recurrenceUnit === "monthly" &&
    ![4, 8, 12].includes(payload.recurrenceCount)
  ) {
    context.addIssue({
      code: "custom",
      path: ["recurrenceCount"],
      message: "Lịch hằng tháng phải gồm 4, 8 hoặc 12 buổi",
    });
  }
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

export const quotationIdParamSchema = z.object({
  quotationId: objectIdSchema,
});

export const orderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z
    .union([orderStatusSchema, z.literal("all"), z.literal("Tất cả")])
    .optional(),
  search: z
    .string()
    .trim()
    .max(100, "Từ khóa tìm kiếm không được vượt quá 100 ký tự")
    .optional(),
});

export const recentOrderQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5),
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

const quotationItemSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Tên hạng mục báo giá là bắt buộc")
    .max(200),
  description: optionalTextSchema(
    2000,
    "Mô tả hạng mục không được vượt quá 2000 ký tự",
  ),
  itemType: z.enum(["labor", "material", "replacement_part", "other"]),
  quantity: z.coerce.number().int().min(1).max(1000),
  unitPrice: z.coerce
    .number()
    .finite()
    .nonnegative("Đơn giá không được âm"),
  note: optionalTextSchema(
    1000,
    "Ghi chú hạng mục không được vượt quá 1000 ký tự",
  ),
});

export const createRepairQuotationSchema = z
  .object({
    inspectionNote: optionalTextSchema(
      2000,
      "Ghi chú khảo sát không được vượt quá 2000 ký tự",
    ),
    recommendation: optionalTextSchema(
      2000,
      "Đề xuất xử lý không được vượt quá 2000 ký tự",
    ),
    attachments: z
      .array(z.string().trim().url("Tệp đính kèm không hợp lệ"))
      .max(10)
      .optional(),
    items: z
      .array(quotationItemSchema)
      .min(1, "Báo giá phải có ít nhất một hạng mục")
      .max(100, "Báo giá không được vượt quá 100 hạng mục"),
    discountAmount: z.coerce
      .number()
      .finite()
      .nonnegative("Số tiền giảm giá không được âm")
      .optional(),
  })
  .superRefine((payload, context) => {
    const subtotal = payload.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    if ((payload.discountAmount ?? 0) > subtotal) {
      context.addIssue({
        code: "custom",
        path: ["discountAmount"],
        message: "Số tiền giảm giá không được lớn hơn tạm tính",
      });
    }
  });

export const rejectRepairQuotationSchema = z.object({
  rejectionReason: optionalTextSchema(
    500,
    "Lý do từ chối không được vượt quá 500 ký tự",
  ),
});

export const completeOrderSchema = z.object({
  completionEvidenceImages: z
    .array(z.string().trim().url("Ảnh nghiệm thu phải là đường dẫn hợp lệ"))
    .min(1, "Vui lòng cung cấp ít nhất một ảnh nghiệm thu")
    .max(5, "Chỉ được cung cấp tối đa 5 ảnh nghiệm thu"),
  completionNote: optionalTextSchema(
    1000,
    "Ghi chú hoàn thành không được vượt quá 1000 ký tự",
  ),
});

export const rejectAssignmentSchema = z.object({
  rejectReason: z
    .string()
    .trim()
    .max(500, "Lý do từ chối không được vượt quá 500 ký tự")
    .optional(),
});

export const selectAppointmentProviderSchema = z.object({
  providerId: objectIdSchema,
});
