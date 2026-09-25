export const defaultBookingPolicy = {
  immediatePercent: 15, immediateMin: 20000, immediateMax: 60000,
  inspectionImmediateFee: 30000, providerFeePercent: 80, minAdvanceMinutes: 240,
  defaultDurationMinutes: 60, inspectionDurationMinutes: 60, bufferMinutes: 15,
  travelMinutes: 30, paymentHoldMinutes: 15, workdayStart: 0, workdayEnd: 1440,
  services: {} as Record<string, { durationMinutes: number; inspectionMinutes?: number }>,
  options: {} as Record<string, { minutes: number; mode: 'replace' | 'add' }>,
  providerCalendars: {} as Record<string, {
    weekly: Partial<Record<string, Array<{ start: number; end: number }>>>;
    absences: Array<{ start: string; end: string }>;
  }>,
};

export const bookingPolicyFields = [
  ['immediatePercent', 'Phụ phí đặt ngay (%)', 0, 100],
  ['immediateMin', 'Phụ phí tối thiểu (đ)', 0, 10000000],
  ['immediateMax', 'Phụ phí tối đa (đ)', 0, 10000000],
  ['inspectionImmediateFee', 'Phụ phí khảo sát ngay (đ)', 0, 10000000],
  ['providerFeePercent', 'Phần phụ phí dành cho thợ (%)', 0, 100],
  ['minAdvanceMinutes', 'Đặt lịch trước tối thiểu (phút)', 1, 43200],
  ['defaultDurationMinutes', 'Thời lượng mặc định (phút)', 1, 1440],
  ['inspectionDurationMinutes', 'Thời lượng khảo sát mặc định (phút)', 1, 1440],
  ['bufferMinutes', 'Dự phòng mỗi đơn (phút)', 0, 1440],
  ['travelMinutes', 'Di chuyển giữa hai đơn (phút)', 0, 1440],
  ['paymentHoldMinutes', 'Giữ lịch chờ thanh toán (phút)', 1, 1440],
  ['workdayStart', 'Bắt đầu ca mặc định (phút từ 00:00)', 0, 1439],
  ['workdayEnd', 'Kết thúc ca mặc định (phút từ 00:00)', 1, 1440],
] as const;
