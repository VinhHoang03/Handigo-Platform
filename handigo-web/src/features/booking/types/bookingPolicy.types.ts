export interface BookingPolicies {
  paymentHoldMinutes: number;
  matching: {
    initialRadiusKm: number;
    expandedRadiusKm: number;
    expandAfterMinutes: number;
    expandedDurationMinutes: number;
    providerResponseSeconds: number;
  };
  fixedPriceRefund: {
    normalRefundPercent: number;
    missingScheduleRefundPercent: number;
    earlyHours: number;
    middleHours: number;
    lateHours: number;
    earlyRefundPercent: number;
    middleRefundPercent: number;
    lateRefundPercent: number;
    lastMinuteRefundPercent: number;
  };
}
