import { useEffect } from "react";
import { createAuthenticatedSocket } from "@/realtime/authenticatedSocket";
import type { AppNotification } from "@/features/notification/types/notification.types";

/** Đăng ký lắng nghe sự kiện `notification:new` qua socket khi được bật. */
export function useNotificationSocket(
  enabled: boolean,
  onNotification: (notification: AppNotification) => void,
) {
  useEffect(() => {
    if (!enabled) return undefined;

    const { socket, dispose } = createAuthenticatedSocket();
    const handleNewNotification = (notification: AppNotification) =>
      onNotification(notification);

    socket.on("notification:new", handleNewNotification);

    return () => {
      socket.off("notification:new", handleNewNotification);
      dispose();
    };
  }, [enabled, onNotification]);
}
