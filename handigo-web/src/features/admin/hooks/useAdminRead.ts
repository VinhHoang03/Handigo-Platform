import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { getErrorMessage } from "@/utils/apiError";

/** Gom thao tác đọc liên tiếp, hủy request cũ và chỉ nhận phản hồi của bộ lọc hiện tại. */
export function useAdminRead<T>(key: string, request: (signal: AbortSignal) => Promise<T>, {
  delay = 250, enabled = true, timeout = 30000, errorMessage = "Không thể tải dữ liệu. Vui lòng thử lại.",
}: { delay?: number; enabled?: boolean; timeout?: number; errorMessage?: string } = {}) {
  const session = useAuthStore(state => state.sessionRevision);
  const [attempt, setAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState<{ session: number; key: string; data: T } | null>(null);
  const [status, setStatus] = useState<{ identity: string; loading: boolean; error: string } | null>(null);
  const identity = JSON.stringify([session, key, attempt]);
  const requestRef = useRef(request);
  useEffect(() => { requestRef.current = request; }, [request]);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let active = true;
    let expired = false;
    let deadline: number | undefined;
    const timer = window.setTimeout(() => {
      deadline = window.setTimeout(() => {
        expired = true;
        controller.abort();
        if (active) setStatus({ identity, loading: false, error: "Yêu cầu mất quá nhiều thời gian. Vui lòng thử lại." });
      }, timeout);
      void (async () => {
        try {
          const data = await requestRef.current(controller.signal);
          if (active && !expired && !controller.signal.aborted) {
            startTransition(() => {
              setSnapshot({ session, key, data });
              setStatus({ identity, loading: false, error: "" });
            });
          }
        } catch (cause) {
          if (active && !expired && !controller.signal.aborted) setStatus({ identity, loading: false, error: getErrorMessage(cause, errorMessage) });
        } finally { window.clearTimeout(deadline); controller.abort(); }
      })();
    }, delay);
    return () => {
      active = false;
      window.clearTimeout(timer);
      window.clearTimeout(deadline);
      controller.abort();
    };
  }, [identity, session, key, delay, enabled, timeout, errorMessage]);

  const reload = useCallback(() => setAttempt(value => value + 1), []);
  return {
    data: snapshot && snapshot.session === session ? snapshot.data : null,
    dataKey: snapshot && snapshot.session === session ? snapshot.key : null,
    loading: enabled && (status?.identity !== identity || status.loading),
    error: enabled && status?.identity === identity ? status.error : "",
    reload,
  };
}
