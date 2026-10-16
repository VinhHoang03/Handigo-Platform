import { z } from "zod";

const minutes = z.number().int().min(0).max(1440);
const duration = z.number().int().min(1).max(1440);
const id = z.string().regex(/^[a-fA-F0-9]{24}$/);
const windowSchema = z.object({ start: minutes, end: minutes }).strict()
  .refine((value) => value.end > value.start, "Giờ kết thúc phải sau giờ bắt đầu");

export const bookingPolicySchema = z.object({
  // Giữ các trường cấu hình cũ để đọc dữ liệu đã lưu; không dùng để tính giá.
  immediatePercent: z.number().min(0).max(100).default(15),
  immediateMin: z.number().int().min(0).max(10000000).default(20000),
  immediateMax: z.number().int().min(0).max(10000000).default(60000),
  inspectionImmediateFee: z.number().int().min(0).max(10000000).default(30000),
  providerFeePercent: z.number().min(0).max(100).default(80),
  minAdvanceMinutes: z.number().int().min(1).max(43200).default(240),
  defaultDurationMinutes: duration.default(60),
  inspectionDurationMinutes: duration.default(60),
  bufferMinutes: minutes.default(15),
  travelMinutes: minutes.default(30),
  paymentHoldMinutes: z.number().int().min(1).max(1440).default(15),
  workdayStart: minutes.default(0),
  workdayEnd: minutes.default(1440),
  services: z.record(id, z.object({
    durationMinutes: duration,
    inspectionMinutes: duration.optional(),
  }).strict()).default({}),
  options: z.record(id, z.object({
    minutes: duration,
    mode: z.enum(["replace", "add"]),
  }).strict()).default({}),
  providerCalendars: z.record(id, z.object({
    weekly: z.partialRecord(z.enum(["0", "1", "2", "3", "4", "5", "6"]), z.array(windowSchema).max(10)),
    absences: z.array(z.object({
      start: z.string().datetime({ offset: true }),
      end: z.string().datetime({ offset: true }),
    }).strict().refine((value) => Date.parse(value.end) > Date.parse(value.start), "Kết thúc nghỉ phải sau bắt đầu")).max(366).default([]),
  }).strict()).default({}),
}).strict().superRefine((value, ctx) => {
  if (value.immediateMax < value.immediateMin) {
    ctx.addIssue({ code: "custom", path: ["immediateMax"], message: "Phí tối đa phải lớn hơn hoặc bằng phí tối thiểu" });
  }
  if (value.workdayEnd <= value.workdayStart) {
    ctx.addIssue({ code: "custom", path: ["workdayEnd"], message: "Giờ kết thúc ca phải sau giờ bắt đầu" });
  }
});

export type BookingPolicy = z.infer<typeof bookingPolicySchema>;
export const DEFAULT_BOOKING_POLICY = bookingPolicySchema.parse({});
