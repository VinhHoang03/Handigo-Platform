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
  expectedBookingAmount: z.number().int().min(0).optional(),
  expectedFinalAmount: z.number().int().min(0).optional(),
  serviceId: objectIdSchema,
  uniformQuantity: z.coerce.number()
    .int("Số lượng máy phải là số nguyên")
    .min(1, "Số lượng máy tối thiểu là 1")
    .max(99, "Số lượng máy tối đa là 99")
    .optional(),
  servicePackageId: objectIdSchema.optional(),
  selectedOptionIds: z.array(objectIdSchema).max(50).optional(),
  selectedOptions: z.array(z.object({
    optionId: objectIdSchema,
    quantity: z.coerce.number().int().min(1).max(99),
  })).max(50).optional(),
  addressId: objectIdSchema,
  preferredProviderId: objectIdSchema.optional(),
  orderType: z
    .enum(["normal", "scheduled"])
    .optional(),
  scheduledAt: z
    .string()
    .datetime({ offset: true, message: "Thời gian thực hiện không hợp lệ" })
    .optional(),
  problemDescription: z.string().trim().max(2000).optional(),
  customerAttachments: z.array(z.string().url()).max(4).optional(),
  promotionId: objectIdSchema.optional(),
  voucherId: objectIdSchema.optional(),
  voucherCode: z.string().trim().min(1).max(50).optional(),
  paymentMethod: z.enum(["wallet", "bank", "cash"]),
}).strict();

const cancellationAmountSchema = z.number({ error: "Số tiền xác nhận phải là số hợp lệ." })
  .finite("Số tiền xác nhận phải là số hữu hạn.")
  .nonnegative("Số tiền xác nhận không được âm.");

const cancellationExpectationSchema = z.object({
  paidAmount: cancellationAmountSchema,
  refundAmount: cancellationAmountSchema,
  cancellationFee: cancellationAmountSchema,
  providerCompensation: cancellationAmountSchema.optional(),
});

export const cancelOrderSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Lý do hủy phải có ít nhất 3 ký tự")
    .max(500, "Lý do hủy không được vượt quá 500 ký tự"),
  confirmedExpectation: cancellationExpectationSchema.optional(),
});

export const previewBookingSchema = z.object({
  voucherCode: createOrderSchema.shape.voucherCode,
  serviceId: createOrderSchema.shape.serviceId,
  uniformQuantity: createOrderSchema.shape.uniformQuantity,
  selectedOptionIds: createOrderSchema.shape.selectedOptionIds,
  selectedOptions: createOrderSchema.shape.selectedOptions,
  orderType: createOrderSchema.shape.orderType,
}).strict();

export const reassignmentResponseSchema = z.object({
  decision: z.enum(["accept", "decline"], {
    message: "Quyết định tìm kỹ thuật viên thay thế không hợp lệ",
  }),
});

export const orderIdParamSchema = z.object({
  orderId: objectIdSchema,
});

export const updateExpectedEndSchema = z.object({ expectedEndAt: z.string().datetime({ offset: true }) });

export const customerNoShowSchema = z.object({
  description: z.string().trim().min(10, "Vui lòng mô tả việc liên hệ khách ít nhất 10 ký tự.").max(2000, "Mô tả không được vượt quá 2.000 ký tự."),
  arrivalEvidenceIds: z.array(objectIdSchema, { error: "Vui lòng tải ảnh đã đến nơi trước khi gửi báo cáo." }).min(1, "Vui lòng gửi ít nhất một ảnh đã đến nơi.").max(4, "Mỗi loại tối đa 4 ảnh, tổng cộng không quá 5 ảnh."),
  contactEvidenceIds: z.array(objectIdSchema, { error: "Vui lòng tải ảnh liên hệ khách trước khi gửi báo cáo." }).min(1, "Vui lòng gửi ít nhất một ảnh liên hệ khách.").max(4, "Mỗi loại tối đa 4 ảnh, tổng cộng không quá 5 ảnh."),
  contactedCustomer: z.literal(true, { error: "Vui lòng xác nhận đã gọi hoặc nhắn tin cho khách." }),
}).superRefine((value, context) => {
  const ids = [...value.arrivalEvidenceIds, ...value.contactEvidenceIds];
  if (ids.length > 5 || new Set(ids).size !== ids.length) context.addIssue({ code: "custom", message: "Chọn từ 2 đến 5 ảnh khác nhau, đủ cả ảnh đã đến nơi và ảnh liên hệ khách." });
});

export const customerNoShowEvidenceSchema = z.object({ kind: z.enum(["arrival", "contact"], { error: "Loại ảnh bằng chứng không hợp lệ." }) });

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
    estimatedDurationMinutes: z.number().int().min(1).max(1440).optional(),
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

export const updateRepairQuotationSchema = createRepairQuotationSchema.safeExtend({
  quotationId: objectIdSchema,
  expectedRevision: z.number().int().nonnegative(),
});

export const confirmQuotationPaymentSchema = z.object({
  quotationId: objectIdSchema,
  expectedRevision: z.number({ error: "Phiên bản báo giá phải là số." })
    .int("Phiên bản báo giá phải là số nguyên.")
    .nonnegative("Phiên bản báo giá không được âm."),
});

export const rejectRepairQuotationSchema = z.object({
  rejectionReason: optionalTextSchema(
    500,
    "Lý do từ chối không được vượt quá 500 ký tự",
  ),
});

export const completeOrderSchema = z.object({
  expectedQuotationId: objectIdSchema.optional(),
  expectedQuotationRevision: z.number().int().nonnegative().optional(),
  completionEvidenceImages: z
    .array(z.string().trim().url("Ảnh nghiệm thu phải là đường dẫn hợp lệ"))
    .min(1, "Vui lòng cung cấp ít nhất một ảnh nghiệm thu")
    .max(5, "Chỉ được cung cấp tối đa 5 ảnh nghiệm thu"),
  completionNote: optionalTextSchema(
    1000,
    "Ghi chú hoàn thành không được vượt quá 1000 ký tự",
  ),
}).superRefine((payload, context) => {
  if ((payload.expectedQuotationId !== undefined) !== (payload.expectedQuotationRevision !== undefined)) {
    context.addIssue({ code: "custom", path: ["expectedQuotationRevision"], message: "Vui lòng cung cấp cả mã và phiên bản báo giá khi kiểm tra trước khi hoàn thành." });
  }
});

export const rejectAssignmentSchema = z.object({
  rejectReason: z
    .string()
    .trim()
    .max(500, "Lý do từ chối không được vượt quá 500 ký tự")
    .optional(),
});

export const cancellationPreviewQuerySchema = z.object({
  scope: z.enum(["single"]).optional().default("single"),
});

export const selectAppointmentProviderSchema = z.object({
  providerId: objectIdSchema,
});
