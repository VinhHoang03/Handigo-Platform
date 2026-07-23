import { useCallback, useState } from "react";
import { bookingApi } from "@/features/booking/api/booking.api";
import { getErrorMessage } from "./notificationBell.utils";

interface ReassignmentAction {
  orderId: string;
  expiresAt?: string;
}

/**
 * Hộp thoại "tìm kỹ thuật viên khác" bật lên khi có thông báo
 * `order_reassignment_required` từ socket. Tách riêng khỏi luồng danh sách
 * thông báo vì đây là một quyết định nghiệp vụ độc lập (chấp nhận/từ chối).
 */
export function useReassignmentPrompt() {
  const [action, setAction] = useState<ReassignmentAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const present = useCallback((orderId: string, expiresAt?: string) => {
    setError("");
    setAction({ orderId, expiresAt });
  }, []);

  const dismiss = useCallback(() => {
    if (!busy) setAction(null);
  }, [busy]);

  const respond = useCallback(
    async (decision: "accept" | "decline") => {
      if (!action) return;
      try {
        setBusy(true);
        setError("");
        await bookingApi.respondToReassignment(action.orderId, decision);
        setAction(null);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [action],
  );

  return { action, busy, error, present, dismiss, respond };
}
