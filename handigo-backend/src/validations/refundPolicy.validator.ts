import { z } from "zod";

const percent = z.number().min(0).max(100);
const hours = z.number().positive().max(8760);

export const refundPolicySchema = z.object({
  normalRefundPercent: percent.default(70),
  missingScheduleRefundPercent: percent.default(70),
  earlyHours: hours.default(24),
  middleHours: hours.default(6),
  lateHours: hours.default(2),
  earlyRefundPercent: percent.default(100),
  middleRefundPercent: percent.default(80),
  lateRefundPercent: percent.default(50),
  lastMinuteRefundPercent: percent.default(20),
  providerCompensationPercent: percent.default(80),
}).strict().superRefine((value, ctx) => {
  if (!(value.earlyHours > value.middleHours && value.middleHours > value.lateHours)) {
    ctx.addIssue({ code: "custom", path: ["earlyHours"], message: "Các mốc hủy lịch phải giảm dần: mốc sớm > mốc giữa > mốc sát giờ." });
  }
  if (!(value.earlyRefundPercent >= value.middleRefundPercent
    && value.middleRefundPercent >= value.lateRefundPercent
    && value.lateRefundPercent >= value.lastMinuteRefundPercent)) {
    ctx.addIssue({ code: "custom", path: ["earlyRefundPercent"], message: "Tỷ lệ hoàn tiền không được tăng khi hủy gần giờ hẹn hơn." });
  }
});

export type RefundPolicy = z.infer<typeof refundPolicySchema>;
export const DEFAULT_REFUND_POLICY = refundPolicySchema.parse({});
