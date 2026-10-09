import { useCallback, useRef, useState } from "react";

import { ToastContext } from "./toast-context";
import { getToastMessage } from "./toast-message";
import type { Toast, ToastContextType, ToastType } from "./toast-context";

export type { ToastType, Toast, ToastContextType };

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const recentToasts = useRef(new Map<string, { id: string; time: number }>());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    for (const [key, toast] of recentToasts.current) {
      if (toast.id === id) recentToasts.current.delete(key);
    }
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType, duration = 5000) => {
      const normalizedMessage = getToastMessage(message, type);
      const key = `${type}:${normalizedMessage}`;
      const time = Date.now();
      const previous = recentToasts.current.get(key);
      if (previous && time - previous.time < 750) return previous.id;
      const id = `${Date.now()}-${Math.random()}`;
      const toast: Toast = { id, message: normalizedMessage, type, duration };
      recentToasts.current.set(key, { id, time });

      setToasts((prev) => [...prev, toast]);

      return id;
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}
