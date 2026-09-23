import type { SystemConfig, SystemConfigPayload, SystemConfigType } from "../../types/systemConfig.types";

export type ConfigGroupKey =
  | "operation"
  | "booking"
  | "payment"
  | "display"
  | "notification";

export type ConfigDefinition = {
  key: string;
  label: string;
  group: ConfigGroupKey;
  type: SystemConfigType;
  defaultValue: unknown;
  description: string;
  unit?: string;
  isPublic: boolean;
  effect: string;
  isEffective: boolean;
};

export type ConfigItem = ConfigDefinition & {
  currentValue: unknown;
  existing: SystemConfig | null;
};

export type ConfigFormState = {
  value: string;
  isPublic: boolean;
};

export type PendingSave = {
  item: ConfigItem;
  payload: SystemConfigPayload;
};
