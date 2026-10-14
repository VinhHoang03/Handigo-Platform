import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { createAuthenticatedSocket } from "@/realtime/authenticatedSocket";
import { mapText } from "./constants";
import { hasGeolocationSupport } from "./geo-helpers";
import type { Coordinate, LocationEvent, TrackingState } from "./types";

interface UseRealtimeTrackingParams {
  orderId: string;
  viewerRole: "CUSTOMER" | "PROVIDER";
  trackingEnabled: boolean;
  liveTrackingEnabled: boolean;
  savedCustomerCoordinate: Coordinate | null;
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

    const joinOrderRoom = () => {
      console.log(`[Socket-Client] Đã kết nối! Định danh socket: ${socket.id}`);
      socket.emit(
        "order:tracking:join",
        { orderId },
        (response: { success: boolean; data?: TrackingState; message?: string }) => {
          console.log("[Socket-Client] Phản hồi tham gia theo dõi đơn hàng:", response);
          if (response.success) {
            setTracking((cur) => ({
              customer: cur.customer,
              provider: response.data?.provider || cur.provider,
            }));
            setLocationMessage(mapText.connected);
            lastSentAtRef.current = 0;
          } else {
            setLocationMessage(response.message || mapText.joinFailed);
          }
        },
      );
    };

    const handleConnectError = (err: Error) => {
      console.error("[Socket-Client] Lỗi kết nối:", err.message);
      setLocationMessage(`Lỗi kết nối định vị: ${err.message}`);
    };

    socket.on("connect", joinOrderRoom);
    socket.on("connect_error", handleConnectError);

    const handleLocation = (location: LocationEvent) => {
      console.log("[Socket-Client] Đã nhận vị trí đơn hàng:", location);
      if (location.ownerType === "provider") {
        setTracking((cur) => ({ ...cur, provider: location }));
      } else if (location.ownerType === "customer") {
        setTracking((cur) => ({ ...cur, customer: location }));
      }
    };
    socket.on("order:location", handleLocation);

    return () => {
      console.log("[Socket-Client] Đang đóng kết nối socket...");
      socket.off("connect", joinOrderRoom);
      socket.off("connect_error", handleConnectError);
      socket.off("order:location", handleLocation);
      dispose();
      socketRef.current = null;
    };
  }, [orderId, trackingEnabled, viewerRole]);

  // GPS watchPosition — chỉ dành cho PROVIDER.
  // Customer không cần GPS: toạ độ của customer luôn là địa chỉ tĩnh từ đơn hàng.
  useEffect(() => {
    if (!liveTrackingEnabled || !hasGeolocationSupport()) return;
    if (viewerRole !== "PROVIDER") return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        const nextCoordinate = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          updatedAt: new Date().toISOString(),
        };

        // Cập nhật vị trí provider ngay lập tức trên local map
        setTracking((cur) => ({ ...cur, provider: nextCoordinate }));

        // Gửi lên server mỗi 10 giây để giảm tần suất chia sẻ GPS.
        if (now - lastSentAtRef.current < 10_000) return;
        lastSentAtRef.current = now;
        socketRef.current?.emit(
          "order:location:update",
          { orderId, ...nextCoordinate },
          (res: { success: boolean; message?: string } | undefined) => {
            if (res && !res.success) {
              console.warn("[Socket-Client] Cập nhật vị trí đơn hàng thất bại:", res.message);
            } else {
              console.log("[Socket-Client] Phản hồi xác nhận cập nhật vị trí đơn hàng:", res);
            }
          },
        );
      },
      (err) => {
        console.error("[Socket-Client] Lỗi theo dõi vị trí GPS:", err.message);
        setLocationMessage(mapText.locationPermission);
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [liveTrackingEnabled, orderId, viewerRole]);

  return { tracking, locationMessage };
}
