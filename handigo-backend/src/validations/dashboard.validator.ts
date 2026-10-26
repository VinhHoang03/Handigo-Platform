import { z } from "zod";

const dateStringSchema = z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Ngày không hợp lệ",
});

const toStartOfDay = (value: string) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const toEndOfDay = (value: string) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

export const dashboardQuerySchema = z
  .object({
    fromDate: dateStringSchema.optional().transform((value) => (value ? toStartOfDay(value) : undefined)),
    toDate: dateStringSchema.optional().transform((value) => (value ? toEndOfDay(value) : undefined)),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    topLimit: z.coerce.number().int().min(1).max(50).default(10),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .superRefine((query, ctx) => {
    if (query.fromDate && query.toDate && query.fromDate > query.toDate) {
      ctx.addIssue({
        code: "custom",
        path: ["toDate"],
        message: "Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu",
      });
    }
  });

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

const providerDayBoundary = (value: string, end: boolean) => {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(value));
  return new Date(`${day}T${end ? "23:59:59.999" : "00:00:00.000"}+07:00`);
};

// Bộ lọc provider dùng ngày Việt Nam, độc lập với múi giờ máy chủ.
export const providerDashboardQuerySchema = dashboardQuerySchema.safeExtend({
  fromDate: dateStringSchema.optional().transform((value) => value ? providerDayBoundary(value, false) : undefined),
  toDate: dateStringSchema.optional().transform((value) => value ? providerDayBoundary(value, true) : undefined),
});

export const providerAvailabilitySchema = z.object({
  availabilityStatus: z.enum(["online", "offline", "busy"]),
});
