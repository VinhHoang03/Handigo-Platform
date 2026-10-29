import { useToastFeedback } from "@/components/common/Toast";
import { useEffect, useState } from "react";
import { providerProfileApi } from "../../api/providerProfile.api";

/** Nạp điểm đánh giá cho trang tổng quan của thợ. */
export function useProviderRating() {
  const [rating, setRating] = useState<{ average: number; total: number } | null>(null);
  const [, setError] = useToastFeedback<string | null>(null, "error");
  useEffect(() => {
    let cancelled = false;
    providerProfileApi.getProfile().then((profile) => {
      if (!cancelled) {
        setRating({ average: profile.provider.averageRating, total: profile.provider.totalFeedbacks });
        setError(null);
      }
    }).catch(() => {
      if (!cancelled) setError("Không thể tải điểm đánh giá.");
    });
    return () => { cancelled = true; };
  }, [setError]);
  return { rating };
}
