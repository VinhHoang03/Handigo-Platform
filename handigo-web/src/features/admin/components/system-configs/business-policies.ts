export const defaultRefundPolicy = {
  normalRefundPercent: 70,
  missingScheduleRefundPercent: 70,
  earlyHours: 24,
  middleHours: 6,
  lateHours: 2,
  earlyRefundPercent: 100,
  middleRefundPercent: 80,
  lateRefundPercent: 50,
  lastMinuteRefundPercent: 20,
  providerCompensationPercent: 80,
};

export const defaultRewardPolicy = { amountPerPoint: 10_000, validityDays: 30 };

export const refundPolicyFields = [
  ['normalRefundPercent', 'Hoàn tiền đơn thường/gấp đã có thợ (%)', 0, 100],
  ['missingScheduleRefundPercent', 'Hoàn tiền lịch hẹn thiếu giờ bắt đầu (%)', 0, 100],
  ['earlyHours', 'Mốc hủy sớm (giờ trước lịch hẹn)', 0.01, 8760],
  ['earlyRefundPercent', 'Hoàn tiền từ mốc hủy sớm trở lên (%)', 0, 100],
  ['middleHours', 'Mốc hủy giữa (giờ trước lịch hẹn)', 0.01, 8760],
  ['middleRefundPercent', 'Hoàn tiền từ mốc giữa đến dưới mốc sớm (%)', 0, 100],
  ['lateHours', 'Mốc hủy sát giờ (giờ trước lịch hẹn)', 0.01, 8760],
  ['lateRefundPercent', 'Hoàn tiền từ mốc sát giờ đến dưới mốc giữa (%)', 0, 100],
  ['lastMinuteRefundPercent', 'Hoàn tiền dưới mốc sát giờ, chưa đến giờ hẹn (%)', 0, 100],
  ['providerCompensationPercent', 'Phần phí hủy được bồi thường cho thợ (%)', 0, 100],
] as const;

export const rewardPolicyFields = [
  ['amountPerPoint', 'Số tiền đủ điều kiện để tích 1 điểm (VNĐ)', 1, 100_000_000],
  ['validityDays', 'Hạn dùng mã đổi điểm kể từ khi đổi (ngày)', 1, 3650],
] as const;
