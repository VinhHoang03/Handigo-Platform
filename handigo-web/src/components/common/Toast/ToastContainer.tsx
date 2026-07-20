import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { useToast } from "./useToast";
import type { ToastType } from "./toast-context";

function ToastItem({
  message,
  type,
  onClose,
}: {
  id: string;
  message: string;
  type: ToastType;
  onClose: () => void;
}) {
  const getStyles = () => {
    switch (type) {
      case "success":
        return {
          bg: "bg-secondary/10",
          border: "border-secondary/30",
          text: "text-secondary",
          icon: "text-secondary",
        };
      case "error":
        return {
          bg: "bg-error/10",
          border: "border-error/30",
          text: "text-error",
          icon: "text-error",
        };
      case "info":
      default:
        return {
          bg: "bg-primary/10",
          border: "border-primary/30",
          text: "text-primary",
          icon: "text-primary",
        };
    }
  };

  const styles = getStyles();

  const getIcon = () => {
    switch (type) {
      case "success":
        return <CheckCircle2 size={20} />;
      case "error":
        return <AlertCircle size={20} />;
      case "info":
      default:
        return <Info size={20} />;
    }
  };

  return (
    <div
      className={`
        flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-md
        ${styles.bg} ${styles.border} ${styles.text}
        animate-in fade-in slide-in-from-top-2 duration-200
      `}
    >
      <div className={`mt-0.5 shrink-0 ${styles.icon}`}>{getIcon()}</div>
      <p className="flex-1 text-sm font-semibold">{message}</p>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Đóng thông báo"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="pointer-events-none fixed right-0 top-20 z-50 flex flex-col gap-3 p-4 sm:gap-4 sm:p-6">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem
            id={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        </div>
      ))}
    </div>
  );
}
