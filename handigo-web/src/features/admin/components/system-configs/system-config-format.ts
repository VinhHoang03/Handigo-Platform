import type { SystemConfig, SystemConfigType } from "../../types/systemConfig.types";
import { configDefinitions, type ConfigItem } from "./config-definitions";

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
