import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { createAuthenticatedSocket } from "@/realtime/authenticatedSocket";
import { mapText } from "./constants";
import { hasGeolocationSupport, isValidCoordinate } from "./geo-helpers";
import type { Coordinate, LocationEvent, TrackingState } from "./types";

interface UseRealtimeTrackingParams {
  orderId: string;
  viewerRole: "CUSTOMER" | "PROVIDER";
  trackingEnabled: boolean;
  liveTrackingEnabled: boolean;
  savedCustomerCoordinate: Coordinate | null;
}

function latestCoordinate(current: Coordinate | null, next?: Coordinate | null): Coordinate | null {
  if (!next || !isValidCoordinate(next)) return current;
  if (current?.updatedAt && next.updatedAt && Date.parse(next.updatedAt) < Date.parse(current.updatedAt)) return current;
  return next;
}

/**
 * Kết nối socket realtime tracking + (nếu là PROVIDER) chia sẻ GPS watchPosition.
 * Cả hai effect dùng chung state `tracking`/`locationMessage` nên gộp trong 1 hook.
 */
export function useRealtimeTracking({
  orderId,
  viewerRole,
  trackingEnabled,
  liveTrackingEnabled,
  savedCustomerCoordinate,
}: UseRealtimeTrackingParams) {
  const socketRef = useRef<Socket | null>(null);
  const lastSentAtRef = useRef(0);
  const latestPositionRef = useRef<GeolocationPosition | null>(null);
  const sendPosition = useCallback((position: GeolocationPosition) => {
    const now = Date.now();
    if (!socketRef.current?.connected || now - position.timestamp > 30_000 ||
      now - lastSentAtRef.current < 10_000) return;
    lastSentAtRef.current = now;
    socketRef.current.emit("order:location:update", {
      orderId, latitude: position.coords.latitude, longitude: position.coords.longitude,
      accuracy: position.coords.accuracy, capturedAt: position.timestamp,
    }, (res: { success: boolean; message?: string } | undefined) => {
      if (res && !res.success) console.warn("[Socket-Client] Cập nhật vị trí đơn hàng thất bại:", res.message);
    });
  }, [orderId]);

  const [tracking, setTracking] = useState<TrackingState>({
    customer: savedCustomerCoordinate,
    provider: null,
  });
  const [locationMessage, setLocationMessage] = useState(
    liveTrackingEnabled && !hasGeolocationSupport()
      ? mapText.locationUnsupported
      : liveTrackingEnabled
        ? mapText.connecting
        : "",
  );

  // Socket connection
  useEffect(() => {
    if (!trackingEnabled) return;

    console.log(`[Socket-Client] Đang kết nối cho đơn hàng ${orderId} với vai trò ${viewerRole}...`);
    const { socket, dispose } = createAuthenticatedSocket({
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;
    let disposed = false;
    let refreshing = false;
    let refreshQueued = false;

    const refreshTracking = (resendPosition = false) => {
      if (disposed || !socket.connected) return;
      if (refreshing) {
        refreshQueued = true;
        return;
      }
      refreshing = true;
      socket.timeout(10_000).emit(
        "order:tracking:join",
        { orderId },
        (error: Error | null, response?: { success: boolean; data?: TrackingState; message?: string }) => {
          if (disposed) return;
          refreshing = false;
          if (!error && response?.success) {
            setTracking((cur) => ({
              customer: cur.customer,
              provider: latestCoordinate(cur.provider, response.data?.provider),
            }));
            setLocationMessage(mapText.connected);
            // Chỉ gửi lại GPS khi kết nối, không gửi khi nhận tín hiệu vị trí đã đổi.
            if (resendPosition && viewerRole === "PROVIDER" && liveTrackingEnabled && latestPositionRef.current) {
              lastSentAtRef.current = 0;
              sendPosition(latestPositionRef.current);
            }
          } else {
            setLocationMessage(response?.message || mapText.joinFailed);
          }
          if (refreshQueued) {
            refreshQueued = false;
            refreshTracking();
          }
        },
      );
    };
    const joinOrderRoom = () => refreshTracking(true);

    const handleConnectError = (err: Error) => {
      console.error("[Socket-Client] Lỗi kết nối:", err.message);
      setLocationMessage(`Lỗi kết nối định vị: ${err.message}`);
    };

    socket.on("connect", joinOrderRoom);
    socket.on("connect_error", handleConnectError);

    const handleLocation = (location: LocationEvent | { orderId: string }) => {
      if (!location || (location.orderId && location.orderId !== orderId)) return;
      // App lưu GPS qua HTTP và chỉ báo mã đơn; lấy lại tọa độ qua luồng có kiểm tra quyền.
      if (!("ownerType" in location)) {
        if (location.orderId === orderId) refreshTracking();
        return;
      }
      if (location.ownerType === "provider") {
        setTracking((cur) => ({ ...cur, provider: latestCoordinate(cur.provider, location) }));
      } else if (location.ownerType === "customer") {
        setTracking((cur) => ({ ...cur, customer: latestCoordinate(cur.customer, location) }));
      }
    };
    socket.on("order:location", handleLocation);

    return () => {
      disposed = true;
      console.log("[Socket-Client] Đang đóng kết nối socket...");
      socket.off("connect", joinOrderRoom);
      socket.off("connect_error", handleConnectError);
      socket.off("order:location", handleLocation);
      dispose();
      socketRef.current = null;
    };
  }, [liveTrackingEnabled, orderId, sendPosition, trackingEnabled, viewerRole]);

  // GPS watchPosition — chỉ dành cho PROVIDER.
  // Customer không cần GPS: toạ độ của customer luôn là địa chỉ tĩnh từ đơn hàng.
  useEffect(() => {
    if (!liveTrackingEnabled || !hasGeolocationSupport()) return;
    if (viewerRole !== "PROVIDER") return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        latestPositionRef.current = position;
        const nextCoordinate = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          updatedAt: new Date().toISOString(),
        };

        // Cập nhật vị trí provider ngay lập tức trên local map
        setTracking((cur) => ({ ...cur, provider: nextCoordinate }));

        // Gửi lên server mỗi 10 giây để giảm tần suất chia sẻ GPS.
        sendPosition(position);
      },
      (err) => {
        console.error("[Socket-Client] Lỗi theo dõi vị trí GPS:", err.message);
        setLocationMessage(mapText.locationPermission);
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      latestPositionRef.current = null;
    };
  }, [liveTrackingEnabled, orderId, sendPosition, viewerRole]);

  return { tracking, locationMessage };
}
