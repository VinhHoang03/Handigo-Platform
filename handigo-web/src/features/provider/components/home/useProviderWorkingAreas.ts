import { useEffect, useState } from "react";
import { providerProfileApi } from "../../api/providerProfile.api";

/**
 * Khu vực hoạt động và điểm đánh giá của thợ, lấy chung từ một lần gọi
 * `getProfile()` — cùng response nên không tách thành hook riêng để khỏi gọi
 * API hai lần.
 */
export function useProviderWorkingAreas() {
  const [workingAreas, setWorkingAreas] = useState<string[]>([]);
  const [rating, setRating] = useState<{ average: number; total: number } | null>(null);
  const [isLoadingAreas, setIsLoadingAreas] = useState(true);
  const [areasError, setAreasError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    providerProfileApi
      .getProfile()
      .then((profile) => {
        if (cancelled) return;

        const configuredAreas = (profile.provider.workingAreas || [])
          .map((area) => area.trim())
          .filter(Boolean);
        const legacyArea = [
          profile.provider.serviceArea?.ward,
          profile.provider.serviceArea?.province,
        ]
          .map((area) => area?.trim())
          .filter(Boolean)
          .join(", ");

        setWorkingAreas(
          configuredAreas.length
            ? [...new Set(configuredAreas)]
            : legacyArea
              ? [legacyArea]
              : [],
        );
        setRating({
          average: profile.provider.averageRating,
          total: profile.provider.totalFeedbacks,
        });
        setAreasError(null);
      })
      .catch(() => {
        if (!cancelled) {
          setAreasError("Không thể tải khu vực hoạt động.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingAreas(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { workingAreas, rating, isLoadingAreas, areasError };
}
