import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useToast } from "./useToast";
import type { Toast } from "./toast-context";

const toastStyles = {
  success: { title: "Thành công", icon: CheckCircle2, color: "text-success", background: "bg-success/10", border: "border-l-success" },
  error: { title: "Có lỗi xảy ra", icon: AlertCircle, color: "text-error", background: "bg-error/10", border: "border-l-error" },
  info: { title: "Thông báo", icon: Info, color: "text-primary", background: "bg-primary/10", border: "border-l-primary" },
};

function ToastItem({ toast, onClose }: { toast: Toast; onClose: (id: string) => void }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const remaining = useRef(toast.duration ?? 5000);
  const paused = hovered || focused;
  const styles = toastStyles[toast.type];
  const Icon = styles.icon;

  useEffect(() => {
    if (paused || (toast.duration ?? 5000) <= 0) return;
    const startedAt = Date.now();
    const timeoutId = window.setTimeout(() => onClose(toast.id), remaining.current);
    return () => {
      window.clearTimeout(timeoutId);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt));
    };
  }, [paused, toast.id, toast.duration, onClose]);

  return (
    <div
      role={toast.type === "error" ? "alert" : "status"}
      aria-atomic="true"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      className={`handigo-toast pointer-events-auto flex shrink-0 items-start gap-3 rounded-xl border border-outline-variant/40 border-l-4 bg-surface-container-lowest p-4 text-on-surface shadow-[0_8px_30px_rgba(19,27,46,0.16)] ${styles.border}`}
    >
      <span className={`grid size-9 shrink-0 place-items-center rounded-full ${styles.background} ${styles.color}`}>
        <Icon size={20} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-bold ${styles.color}`}>{styles.title}</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-on-surface-variant [overflow-wrap:anywhere]">{toast.message}</p>
      </div>
      <button
        type="button"
        onClick={() => onClose(toast.id)}
        className="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container focus-visible:ring-2"
        aria-label="Đóng thông báo"
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return createPortal(
    <section
      aria-label="Thông báo hệ thống"
      className="pointer-events-none fixed right-0 top-24 z-[1000] flex max-h-[calc(100dvh-6rem)] w-full max-w-[420px] flex-col gap-3 overflow-y-auto overscroll-contain p-4 pt-[max(1rem,env(safe-area-inset-top))] sm:right-2"
    >
      {toasts.map((toast) => <ToastItem key={toast.id} toast={toast} onClose={removeToast} />)}
    </section>,
    document.body,
  );
}
