import { useContext } from "react";
import { SystemAlertContext } from "./system-alert-context";

export function useSystemAlert() {
  const context = useContext(SystemAlertContext);

  if (!context) {
    throw new Error(
      "useSystemAlert phải được sử dụng bên trong SystemAlertProvider.",
    );
  }

  return context;
}
