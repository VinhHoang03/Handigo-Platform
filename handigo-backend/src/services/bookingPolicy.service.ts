import { getBookingPolicy, getNumberConfigValue, getRefundPolicy } from "./systemConfig.service";
import { getProviderResponseTimeoutSeconds } from "../utils/matchingSearch";
import { createHash } from "node:crypto";

/** Chỉ trả các điều khoản dành cho khách, không công khai lịch riêng hoặc cấu hình nội bộ. */
export const getCustomerBookingPolicies = async () => {
  const [booking, refund, initialRadius, expandedRadius, expandAfter, expandedDuration, responseTimeout] = await Promise.all([
    getBookingPolicy(), getRefundPolicy(),
    getNumberConfigValue("INITIAL_PROVIDER_RADIUS_KM", 5),
    getNumberConfigValue("MAX_PROVIDER_RADIUS_KM", 10),
    getNumberConfigValue("MATCHING_EXPAND_AFTER_MINUTES", 1),
    getNumberConfigValue("MATCHING_EXPANDED_DURATION_MINUTES", 3),
    getNumberConfigValue("MATCHING_PROVIDER_TIMEOUT_SECONDS", 60),
  ]);
  const policies = {
    paymentHoldMinutes: booking.paymentHoldMinutes,
    matching: {
      initialRadiusKm: Math.max(initialRadius, 0.1),
      expandedRadiusKm: Math.max(expandedRadius, initialRadius, 0.1),
      expandAfterMinutes: Math.max(expandAfter, 0.1),
      expandedDurationMinutes: Math.max(expandedDuration, 0.1),
      providerResponseSeconds: getProviderResponseTimeoutSeconds(responseTimeout, expandAfter),
    },
    fixedPriceRefund: {
      normalRefundPercent: refund.normalRefundPercent,
      missingScheduleRefundPercent: refund.missingScheduleRefundPercent,
      earlyHours: refund.earlyHours, middleHours: refund.middleHours, lateHours: refund.lateHours,
      earlyRefundPercent: refund.earlyRefundPercent, middleRefundPercent: refund.middleRefundPercent,
      lateRefundPercent: refund.lateRefundPercent, lastMinuteRefundPercent: refund.lastMinuteRefundPercent,
    },
  };
  // Tăng phiên bản nội dung khi thay đổi cách diễn đạt/điều khoản trong BookingPolicyContent.
  const version = createHash("sha256").update(JSON.stringify({ contentVersion: 3, policies })).digest("hex");
  return { ...policies, version };
};
