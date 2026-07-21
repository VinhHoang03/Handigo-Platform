import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Modal } from "../Modal";
import {
  SystemAlertContext,
  type SystemAlertOptions,
  type SystemAlertVariant,
} from "./system-alert-context";

interface SystemAlertState {
  message: string;
  title: string;
  variant: SystemAlertVariant;
}

export function SystemAlertProvider({ children }: { children: ReactNode }) {
  const [alert, setAlert] = useState<SystemAlertState | null>(null);

  const showSystemAlert = useCallback(
    (message: string, options: SystemAlertOptions = {}) => {
      setAlert({
        message,
        title: options.title || "Thông báo",
        variant: options.variant || "default",
      });
    },
    [],
  );

  const contextValue = useMemo(
    () => ({ showSystemAlert }),
    [showSystemAlert],
  );

  return (
    <SystemAlertContext.Provider value={contextValue}>
      {children}
      <Modal
        open={Boolean(alert)}
        title={alert?.title || "Thông báo"}
        onClose={() => setAlert(null)}
        size="sm"
        danger={alert?.variant === "error"}
      >
        <p className="leading-6 text-on-surface-variant">{alert?.message}</p>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => setAlert(null)}
            className="btn-primary min-h-12 px-6"
          >
            Đã hiểu
          </button>
        </div>
      </Modal>
    </SystemAlertContext.Provider>
  );
}
