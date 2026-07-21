import { createContext } from "react";

export type SystemAlertVariant = "default" | "error";

export interface SystemAlertOptions {
  title?: string;
  variant?: SystemAlertVariant;
}

export interface SystemAlertContextValue {
  showSystemAlert: (message: string, options?: SystemAlertOptions) => void;
}

export const SystemAlertContext = createContext<SystemAlertContextValue | null>(
  null,
);
