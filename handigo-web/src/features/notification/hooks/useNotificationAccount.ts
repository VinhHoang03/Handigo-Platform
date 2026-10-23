import { useCallback, useEffect, useRef } from "react";
import { useAuthStore } from "@/features/auth/store/auth.store";

/** Bỏ qua phản hồi và sự kiện của tài khoản đã rời khỏi màn hình thông báo. */
export function useNotificationAccount() {
  const accountId = useAuthStore((state) =>
    state.isAuthenticated ? state.user?.id || state.user?._id || "" : "",
  );
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  const isCurrentAccount = useCallback(() => {
    const state = useAuthStore.getState();
    return active.current && Boolean(accountId) && state.isAuthenticated
      && (state.user?.id || state.user?._id) === accountId;
  }, [accountId]);

  return { accountId, isCurrentAccount };
}
