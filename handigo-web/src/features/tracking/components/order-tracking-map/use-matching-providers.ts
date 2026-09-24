import { useEffect, useState } from "react";
import { trackingApi, type MatchingMapProvider } from "../../api/tracking.api";

/** Làm mới theo bán kính hiện tại; hủy kết quả cũ khi đơn đã có thợ nhận. */
export function useMatchingProviders(orderId: string, radiusKm: number | null, enabled: boolean) {
  const [state, setState] = useState<{ key: string; providers: MatchingMapProvider[]; message: string }>({ key: "", providers: [], message: "" });
  const key = `${orderId}:${radiusKm}`;
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const data = await trackingApi.getMatchingProviders(orderId, controller.signal);
        if (controller.signal.aborted) return;
        const providers = data.radiusKm === radiusKm ? data.providers : [];
        setState({ key, providers, message: providers.length
          ? `Có ${providers.length} thợ phù hợp trong bán kính ${radiusKm} km. Biểu tượng mũ bảo hộ là vị trí thợ; đang chờ thợ nhận đơn.`
          : "Chưa có thợ phù hợp trong bán kính hiện tại. Hệ thống tiếp tục tìm kiếm." });
      } catch {
        if (controller.signal.aborted) return;
        setState({ key, providers: [], message: "Chưa tải được vị trí thợ. Hệ thống đang thử lại." });
      }
      if (!controller.signal.aborted) timer = setTimeout(refresh, 5000);
    };
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [enabled, key, orderId, radiusKm]);
  return enabled ? state.key === key ? state : { providers: [], message: "Đang tải vị trí thợ phù hợp…" } : { providers: [], message: "" };
}
