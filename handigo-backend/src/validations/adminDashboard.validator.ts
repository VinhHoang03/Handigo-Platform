import { z } from "zod";

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải có định dạng YYYY-MM-DD")
  .refine((value) => {
    const time = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
  }, "Ngày không hợp lệ");

export const adminDashboardQuerySchema = z.object({
  fromDate: calendarDate.optional().transform((value) => value ? new Date(`${value}T00:00:00+07:00`) : undefined),
  toDate: calendarDate.optional().transform((value) => value ? new Date(`${value}T23:59:59.999+07:00`) : undefined),
}).refine((query) => !query.fromDate || !query.toDate || query.fromDate <= query.toDate, {
  path: ["toDate"], message: "Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu",
});

export type AdminDashboardQuery = z.infer<typeof adminDashboardQuerySchema>;
