import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useToast } from "./useToast";
import type { ToastType } from "./toast-context";

/** Giữ trạng thái cho biểu mẫu/thử lại và báo toast ngay khi có phản hồi mới. */
export function useToastFeedback<T extends string | null>(
  initialValue: T,
  type: ToastType,
): [T, Dispatch<SetStateAction<T>>] {
  const [message, setMessage] = useState<T>(initialValue);
  const currentMessage = useRef(initialValue);
  const { addToast } = useToast();

  const reportMessage = useCallback<Dispatch<SetStateAction<T>>>((value) => {
    const nextMessage = typeof value === "function" ? value(currentMessage.current) : value;
    currentMessage.current = nextMessage;
    setMessage(nextMessage);
    if (nextMessage?.trim()) {
      addToast(nextMessage, type);
    }
  }, [addToast, type]);

  return [message, reportMessage];
}
