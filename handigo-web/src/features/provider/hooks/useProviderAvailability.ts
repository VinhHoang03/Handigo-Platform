import { useCallback, useEffect, useRef } from "react";
import {
  providerDashboardApi,
  type ProviderAvailabilityStatus,
} from "../api/providerDashboard.api";
import { useToast } from "@/components/common/Toast";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useProviderAvailabilityStore } from "../store/providerAvailability.store";
import { createAuthenticatedSocket } from "@/realtime/authenticatedSocket";

const getCurrentCoordinates = () =>
  new Promise<GeolocationCoordinates>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Trình duyệt không hỗ trợ xác định vị trí"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve(coords),
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  });

const getLocationErrorMessage = async (error: unknown) => {
  if (window.isSecureContext === false) {
    return "Địa chỉ đang mở không hỗ trợ định vị an toàn. Vui lòng truy cập Handigo bằng HTTPS hoặc localhost.";
  }
  if (!navigator.geolocation) {
    return "Trình duyệt không hỗ trợ xác định vị trí. Vui lòng thử bằng trình duyệt khác.";
  }
  const locationDocument = document as Document & {
    permissionsPolicy?: { allowsFeature: (feature: string) => boolean };
    featurePolicy?: { allowsFeature: (feature: string) => boolean };
  };
  const policy = locationDocument.permissionsPolicy ?? locationDocument.featurePolicy;
  if (policy?.allowsFeature("geolocation") === false) {
    return "Trang đang bị chính sách trình duyệt chặn định vị. Vui lòng mở trực tiếp Handigo, không qua trang nhúng; nếu vẫn lỗi, cần kiểm tra cấu hình website.";
  }
  if (typeof error === "object" && error && "code" in error) {
    const code = Number(error.code);
    if (code === 1) {
      let permissionState: PermissionState | undefined;
      try {
        permissionState = (await navigator.permissions?.query({ name: "geolocation" }))?.state;
      } catch {
        // Một số trình duyệt hỗ trợ định vị nhưng không cho truy vấn trạng thái quyền.
      }
      console.warn("Không thể lấy vị trí dù đã yêu cầu định vị.", {
        code, permissionState,
        browserMessage: "message" in error ? error.message : undefined,
        isSecureContext: window.isSecureContext,
      });
      if (permissionState === "granted") {
        return "Trang Handigo đã được cấp quyền vị trí, nhưng trình duyệt vẫn không lấy được vị trí từ thiết bị. Hãy kiểm tra dịch vụ vị trí của hệ điều hành và quyền vị trí của ứng dụng trình duyệt.";
      }
      if (permissionState === "denied") {
        return "Quyền lấy vị trí đang bị chặn. Nếu trang đã hiển thị Đã cho phép, hãy kiểm tra quyền vị trí của trình duyệt trong cài đặt hệ điều hành.";
      }
      return "Trình duyệt chưa lấy được vị trí. Vui lòng kiểm tra quyền vị trí của trang và dịch vụ vị trí của thiết bị, rồi thử lại.";
    }
    if (code === 2) return "Không xác định được vị trí hiện tại. Vui lòng kiểm tra kết nối hoặc thử lại ở nơi có tín hiệu vị trí tốt hơn.";
    if (code === 3) return "Lấy vị trí mất quá lâu. Vui lòng thử lại.";
  }
  return "Không thể cập nhật vị trí hiện tại. Vui lòng thử lại.";
};

export function useProviderAvailability(enabled = true) {
  const { addToast } = useToast();
  const providerUserId = useAuthStore(
    (state) => state.user?.id || state.user?._id || null,
  );
  const storedProviderUserId = useProviderAvailabilityStore(
    (state) => state.providerUserId,
  );
  const storedAvailabilityStatus = useProviderAvailabilityStore(
    (state) => state.availabilityStatus,
  );
  const isUpdating = useProviderAvailabilityStore(
    (state) => state.isUpdating,
  );
  const availabilityStatus: ProviderAvailabilityStatus =
    enabled && storedProviderUserId === providerUserId
      ? storedAvailabilityStatus
      : "offline";
  const socketRef = useRef<ReturnType<typeof createAuthenticatedSocket>["socket"] | null>(null);
  const requestVersion = useRef(0);
  const invalidateRequests = useCallback(() => { requestVersion.current++; }, []);

  const synchronizeAvailability = useCallback(async () => {
    if (!enabled || !providerUserId || useProviderAvailabilityStore.getState().isUpdating) return;
    const version = ++requestVersion.current;
    try {
      const overview = await providerDashboardApi.overview();
      const store = useProviderAvailabilityStore.getState();
      if (version !== requestVersion.current || store.providerUserId !== providerUserId || store.isUpdating) return;
      store.completeInitialization(providerUserId, overview.availabilityStatus || "offline");
    } catch {
      const store = useProviderAvailabilityStore.getState();
      if (version === requestVersion.current && store.providerUserId === providerUserId) {
        store.completeInitialization(providerUserId, store.availabilityStatus);
      }
    }
  }, [enabled, providerUserId]);

  useEffect(() => {
    if (!enabled || !providerUserId) return;

    const store = useProviderAvailabilityStore.getState();
    if (!store.startInitialization(providerUserId)) return;

    void synchronizeAvailability();
  }, [enabled, providerUserId, synchronizeAvailability]);

  useEffect(() => {
    if (!enabled || !providerUserId) return;
    // Giữ kết nối nhận việc ở cấp dashboard, không phụ thuộc việc mở/đóng chat.
    const { socket, dispose } = createAuthenticatedSocket();
    socketRef.current = socket;
    const synchronize = () => { void synchronizeAvailability(); };
    socket.on("connect", synchronize);
    socket.on("provider:availability", synchronize);
    window.addEventListener("online", synchronize);

    return () => {
      invalidateRequests();
      socketRef.current = null;
      socket.off("connect", synchronize);
      socket.off("provider:availability", synchronize);
      window.removeEventListener("online", synchronize);
      dispose();
    };
  }, [enabled, providerUserId, synchronizeAvailability, invalidateRequests]);

  const toggleAvailability = useCallback(async () => {
    const store = useProviderAvailabilityStore.getState();
    if (!enabled || store.providerUserId !== providerUserId || store.isUpdating) return;

    const previousStatus = store.availabilityStatus;
    const nextStatus = previousStatus === "online" ? "offline" : "online";
    requestVersion.current++;
    store.setIsUpdating(true);

    try {
      if (nextStatus === "online") {
        if (socketRef.current && !socketRef.current.connected) {
          addToast("Chưa kết nối được kênh nhận việc. Vui lòng chờ kết nối lại rồi thử bật nhận việc.", "error");
          return;
        }
        let coordinates: GeolocationCoordinates;
        try {
          coordinates = await getCurrentCoordinates();
        } catch (error) {
          await providerDashboardApi.deactivateCurrentLocation().catch(() => undefined);
          addToast(
            `${await getLocationErrorMessage(error)} Chưa thể bật nhận việc khi chưa cập nhật được vị trí.`,
            "error",
          );
          return;
        }
        try {
          if (useProviderAvailabilityStore.getState().providerUserId !== providerUserId) return;
          await providerDashboardApi.updateCurrentLocation(
            coordinates.latitude,
            coordinates.longitude,
          );
        } catch {
          addToast("Đã lấy được vị trí nhưng chưa lưu được lên hệ thống. Vui lòng kiểm tra kết nối và thử lại.", "error");
          return;
        }
      }

      if (useProviderAvailabilityStore.getState().providerUserId !== providerUserId) return;
      if (nextStatus === "online" && socketRef.current && !socketRef.current.connected) throw new Error("Mất kết nối kênh nhận việc.");
      const result = await providerDashboardApi.updateAvailability(nextStatus);
      if (useProviderAvailabilityStore.getState().providerUserId !== providerUserId) return;
      useProviderAvailabilityStore
        .getState()
        .setAvailabilityStatus(result.availabilityStatus);
      addToast(result.availabilityStatus === "online" ? "Đã bật trạng thái nhận việc." : "Đã tắt trạng thái nhận việc.", "success");
    } catch {
      if (useProviderAvailabilityStore.getState().providerUserId !== providerUserId) return;
      useProviderAvailabilityStore
        .getState()
        .setAvailabilityStatus(previousStatus);
      addToast(
        nextStatus === "online"
          ? "Không thể cập nhật trạng thái nhận việc. Vui lòng thử lại."
          : "Không thể cập nhật trạng thái hoạt động. Vui lòng thử lại.",
        "error",
      );
    } finally {
      if (useProviderAvailabilityStore.getState().providerUserId === providerUserId) useProviderAvailabilityStore.getState().setIsUpdating(false);
    }
  }, [enabled, addToast, providerUserId]);

  return {
    availabilityStatus,
    isOnline: availabilityStatus === "online",
    isUpdating,
    toggleAvailability,
  };
}
