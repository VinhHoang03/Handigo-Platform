import type { SystemConfig, SystemConfigType } from "../../types/systemConfig.types";
import { configDefinitions, type ConfigItem } from "./config-definitions";
import { bookingPolicyFields, defaultBookingPolicy } from "./booking-policy";
import { defaultRefundPolicy, defaultRewardPolicy } from "./business-policies";

export const dateTime = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
});
export const money = new Intl.NumberFormat("vi-VN");

export const getErrorMessage = (error: unknown) => {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } })
      .response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error
    ? error.message
    : "Có lỗi xảy ra, vui lòng thử lại.";
};

export const stringifyValue = (value: unknown, type: SystemConfigType) => {
  if (type === "JSON") return JSON.stringify(value ?? {}, null, 2);
  if (type === "BOOLEAN") return value ? "true" : "false";
  return value == null ? "" : String(value);
};

export const parseValue = (type: SystemConfigType, value: string) => {
  if (type === "STRING") return value;
  if (type === "BOOLEAN") return value === "true";
  if (type === "NUMBER") {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || numberValue < 0) {
      throw new Error("Giá trị số phải lớn hơn hoặc bằng 0.");
    }
    return numberValue;
  }

  try {
    return JSON.parse(value);
  } catch {
    throw new Error("Giá trị JSON không hợp lệ.");
  }
};

export const formatValue = (value: unknown, type: SystemConfigType, unit?: string) => {
  if (type === "BOOLEAN") return value ? "Bật" : "Tắt";
  if (type === "JSON") return JSON.stringify(value, null, 2);
  if (type === "NUMBER") {
    const numberValue = Number(value);
    const formatted = Number.isFinite(numberValue)
      ? money.format(numberValue)
      : String(value ?? "");
    return unit ? `${formatted} ${unit}` : formatted;
  }
  return String(value ?? "");
};

export const formatConfigValue = (item: ConfigItem, value: unknown, compact = false): string => {
  const saved = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const number = (amount: number, unit: string) => `${money.format(amount)} ${unit}`;
  if (item.key === "REWARD_POLICY") {
    const policy = { ...defaultRewardPolicy, ...saved };
    return `Tích 1 điểm với mỗi ${number(policy.amountPerPoint, "VNĐ")}\nHạn dùng mã đổi điểm: ${number(policy.validityDays, "ngày")}`;
  }
  if (item.key === "REFUND_POLICY") {
    const policy = { ...defaultRefundPolicy, ...saved };
    const hours = (amount: number) => number(amount, "giờ");
    const percent = (amount: number) => `${money.format(amount)}%`;
    if (compact) return [
      `Đơn thường/gấp: hoàn ${percent(policy.normalRefundPercent)}`,
      `Lịch hẹn: ${[policy.earlyRefundPercent, policy.middleRefundPercent, policy.lateRefundPercent, policy.lastMinuteRefundPercent].map(percent).join(" / ")}`,
      `Bồi thường thợ: ${percent(policy.providerCompensationPercent)} phí hủy`,
    ].join("\n");
    return [
      `Đơn thường/gấp đã có thợ: hoàn ${percent(policy.normalRefundPercent)}`,
      `Lịch hẹn thiếu giờ bắt đầu: hoàn ${percent(policy.missingScheduleRefundPercent)}`,
      `Trước lịch từ ${hours(policy.earlyHours)}: hoàn ${percent(policy.earlyRefundPercent)}`,
      `Từ ${hours(policy.middleHours)} đến dưới ${hours(policy.earlyHours)}: hoàn ${percent(policy.middleRefundPercent)}`,
      `Từ ${hours(policy.lateHours)} đến dưới ${hours(policy.middleHours)}: hoàn ${percent(policy.lateRefundPercent)}`,
      `Dưới ${hours(policy.lateHours)}, chưa đến giờ hẹn: hoàn ${percent(policy.lastMinuteRefundPercent)}`,
      `Bồi thường cho thợ: ${percent(policy.providerCompensationPercent)} phí hủy`,
    ].join("\n");
  }
  if (item.key === "BOOKING_POLICY") {
    const policy = { ...defaultBookingPolicy, ...saved };
    if (compact) return [
      `Thời lượng: ${number(policy.defaultDurationMinutes, "phút")} · Khảo sát: ${number(policy.inspectionDurationMinutes, "phút")}`,
      `Dự phòng: ${number(policy.bufferMinutes, "phút")} · Di chuyển: ${number(policy.travelMinutes, "phút")}`,
      `Giữ lịch: ${number(policy.paymentHoldMinutes, "phút")}`,
    ].join("\n");
    const time = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    return [
      ...bookingPolicyFields.filter(([key]) => key !== "workdayStart" && key !== "workdayEnd")
        .map(([key, label]) => `${label.replace(" (phút)", "")}: ${number(policy[key], "phút")}`),
      `Ca mặc định: ${time(policy.workdayStart)} – ${time(policy.workdayEnd)}`,
      ...Object.entries(policy.services).map(([id, rule]) => `Dịch vụ ${id}: ${number(rule.durationMinutes, "phút")}${rule.inspectionMinutes == null ? "" : `; khảo sát ${number(rule.inspectionMinutes, "phút")}`}`),
      ...Object.entries(policy.options).map(([id, rule]) => `Tùy chọn ${id}: ${rule.mode === "add" ? "cộng thêm" : "thay thế"} ${number(rule.minutes, "phút")}`),
      ...Object.entries(policy.providerCalendars).flatMap(([id, calendar]) => [
        `Lịch riêng của thợ ${id}:`,
        ...Object.entries(calendar.weekly).map(([day, windows]) => `  ${day === "0" ? "Chủ nhật" : `Thứ ${Number(day) + 1}`}: ${windows?.length ? windows.map((window) => `${time(window.start)} – ${time(window.end)}`).join(", ") : "Nghỉ"}`),
        ...calendar.absences.map((absence) => `  Nghỉ từ ${dateTime.format(new Date(absence.start))} đến ${dateTime.format(new Date(absence.end))}`),
      ]),
    ].join("\n");
  }
  return formatValue(value, item.type, item.unit);
};

export const mergeConfigItems = (configs: SystemConfig[]): ConfigItem[] => {
  const configByKey = new Map(configs.map((config) => [config.key, config]));

  return configDefinitions.map((definition) => {
    const existing = configByKey.get(definition.key) || null;
    return {
      ...definition,
      currentValue: existing ? existing.value : definition.defaultValue,
      existing,
    };
  });
};
