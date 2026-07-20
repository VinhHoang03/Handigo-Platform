import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ReliableImage } from "@/components/common/ReliableImage";
import {
  customerServiceApi,
  type NearbyProvider,
} from "../api/customerService.api";

interface NearbyProviderSelectorProps {
  serviceId?: string;
  addressId?: string;
  enabled?: boolean;
  scheduledAt?: string;
  requireSelection?: boolean;
  recurrenceUnit?: "weekly" | "monthly";
  recurrenceCount?: number;
  allowSelection?: boolean;
  selectedProviderId?: string;
  onSelectProvider?: (providerId?: string, providerName?: string) => void;
  onAvailabilityChange?: (status: ProviderAvailabilityStatus) => void;
}

export type ProviderAvailabilityStatus =
  | "idle"
  | "loading"
  | "available"
  | "unavailable"
  | "error";

const formatDistance = (distanceMeters: number) => {
  if (distanceMeters < 0) return "Chưa xác định khoảng cách";
  if (distanceMeters < 1000) return `${Math.round(distanceMeters)} m`;
  return `${(distanceMeters / 1000).toFixed(1)} km`;
};

const getProviderAvatar = (provider: NearbyProvider) =>
  provider.user.avatar ||
  `https://ui-avatars.com/api/?name=${encodeURIComponent(provider.user.fullName || "Handigo")}&background=E2DFFF&color=0F006D`;

export function NearbyProviderSelector({
  serviceId,
  addressId,
  enabled = true,
  scheduledAt,
  requireSelection = false,
  recurrenceUnit,
  recurrenceCount,
  allowSelection = true,
  selectedProviderId,
  onSelectProvider,
  onAvailabilityChange,
}: NearbyProviderSelectorProps) {
  const [providers, setProviders] = useState<NearbyProvider[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    if (!enabled || !serviceId || !addressId || (requireSelection && !scheduledAt)) {
      onAvailabilityChange?.("idle");
      return () => {
        isMounted = false;
      };
    }

    const loadProviders = async () => {
      setIsLoading(true);
      setHasLoaded(false);
      setError("");
      onAvailabilityChange?.("loading");

      try {
        const data = await customerServiceApi.nearbyProviders(
          serviceId,
          addressId,
          scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
          recurrenceUnit,
          recurrenceCount,
        );
        if (isMounted) {
          setProviders(data);
          onAvailabilityChange?.(data.length > 0 ? "available" : "unavailable");
        }
      } catch {
        if (!isMounted) return;
        setProviders([]);
        setError("Không tải được chuyên gia phù hợp với địa chỉ này.");
        onAvailabilityChange?.("error");
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setHasLoaded(true);
        }
      }
    };

    void loadProviders();

    return () => {
      isMounted = false;
    };
  }, [addressId, enabled, onAvailabilityChange, recurrenceCount, recurrenceUnit, requireSelection, scheduledAt, serviceId]);

  useEffect(() => {
    if (!allowSelection || !hasLoaded || !onSelectProvider || !selectedProviderId) return;
    if (providers.some((provider) => provider.id === selectedProviderId)) return;
    onSelectProvider(undefined);
  }, [allowSelection, hasLoaded, onSelectProvider, providers, selectedProviderId]);

  const selectProvider = (provider: NearbyProvider) => {
    if (!allowSelection || !onSelectProvider) return;
    const isSelected = selectedProviderId === provider.id;
    onSelectProvider(
      isSelected ? undefined : provider.id,
      isSelected ? undefined : provider.user.fullName,
    );
  };

  return (
    <section className="rounded-xl border border-outline-variant/20 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Các chuyên gia phụ trách
        </h3>
        {providers.length > 0 && (
          <span className="rounded-full bg-primary-container/10 px-2 py-1 text-xs font-bold text-primary">
            {providers.length} phù hợp
          </span>
        )}
      </div>

      {!enabled || !serviceId || !addressId || (requireSelection && !scheduledAt) ? (
        <p className="rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-3 py-3 text-sm text-on-surface-variant">
          {requireSelection
            ? "Chọn ngày và khung giờ để xem chuyên gia còn lịch trống."
            : "Chọn dịch vụ và địa chỉ để tìm chuyên gia phù hợp."}
        </p>
      ) : isLoading ? (
        <div className="flex items-center gap-2 rounded-lg bg-surface-container-low p-3 text-sm font-semibold text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin text-primary">
            progress_activity
          </span>
          Đang tìm chuyên gia gần bạn...
        </div>
      ) : error ? (
        <p className="rounded-lg bg-error/10 px-3 py-2 text-sm font-semibold text-error">
          {error}
        </p>
      ) : providers.length === 0 ? (
        <p className="rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-3 py-3 text-sm text-on-surface-variant">
          {requireSelection
            ? "Chưa có chuyên gia còn trống trong khung giờ này. Vui lòng chọn giờ khác."
            : "Chưa có chuyên gia phù hợp với địa chỉ đã chọn."}
        </p>
      ) : (
        <div className="space-y-3">
          {allowSelection && !requireSelection && <button
            type="button"
            onClick={() => onSelectProvider?.(undefined)}
            className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${
              !selectedProviderId
                ? "border-primary bg-primary-container/10"
                : "border-outline-variant/40 bg-surface-container-lowest hover:border-primary/50"
            }`}
          >
            <span className={`material-symbols-outlined ${!selectedProviderId ? "text-primary" : "text-on-surface-variant"}`}>
              auto_awesome
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-on-surface">
                Handigo tự điều phối chuyên gia
              </span>
              <span className="block text-xs text-on-surface-variant">
                Hệ thống sẽ điều phối người phù hợp nhất khi bạn đặt lịch.
              </span>
            </span>
            {!selectedProviderId && (
              <span className="material-symbols-outlined text-primary">check_circle</span>
            )}
          </button>}

          {providers.map((provider) => {
            const isSelected = allowSelection && selectedProviderId === provider.id;
            return (
              <div
                key={provider.id}
                className={`rounded-lg border p-3 ${
                  isSelected
                    ? "border-primary bg-primary-container/10"
                    : "border-outline-variant/40 bg-surface-container-lowest"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <ReliableImage
                      src={getProviderAvatar(provider)}
                      alt={provider.user.fullName}
                      className="h-14 w-14 rounded-full object-cover"
                    />
                    <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-white bg-success-green" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-on-surface">
                      {provider.user.fullName}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                      <span className="inline-flex items-center gap-1">
                        <span
                          className="material-symbols-outlined text-[16px] text-star-gold"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          star
                        </span>
                        <b className="text-on-surface">
                          {provider.averageRating.toFixed(1)}
                        </b>
                      </span>
                      <span>{provider.totalCompletedOrders}+ đơn</span>
                      <span>
                        {provider.distanceMeters >= 0 ? "Cách bạn " : ""}
                        {formatDistance(provider.distanceMeters)}
                      </span>
                    </div>
                  </div>
                  <Link
                    to={`/customer/providers/${provider.id}`}
                    className="grid h-10 w-10 place-items-center rounded-full bg-primary-container/10 text-primary hover:bg-primary-container/20"
                    aria-label={`Xem chuyên gia ${provider.user.fullName}`}
                  >
                    <span className="material-symbols-outlined">person_search</span>
                  </Link>
                </div>

                <p className="mt-3 line-clamp-1 text-xs text-on-surface-variant">
                  {[provider.serviceArea?.ward, provider.serviceArea?.province]
                    .filter(Boolean)
                    .join(", ") ||
                    provider.workingAreas.slice(0, 2).join(", ") ||
                    "Khu vực hoạt động chưa cập nhật"}
                </p>

                {allowSelection && (
                  <>
                    <button
                      type="button"
                      onClick={() => selectProvider(provider)}
                      className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition ${
                        isSelected
                          ? "border-primary bg-primary text-on-primary"
                          : "border-primary text-primary hover:bg-primary/5"
                      }`}
                    >
                      {isSelected
                        ? requireSelection
                          ? "Đã chọn chuyên gia"
                          : "Đã ưu tiên chuyên gia"
                        : requireSelection
                          ? "Chọn chuyên gia này"
                          : "Ưu tiên chuyên gia này"}
                      <span className="material-symbols-outlined text-[18px]">
                        {isSelected ? "check_circle" : "add_circle"}
                      </span>
                    </button>
                    {isSelected && !requireSelection && (
                      <p className="mt-2 text-xs leading-5 text-on-surface-variant">
                        Nếu chuyên gia không thể nhận, Handigo sẽ tự tìm người phù hợp khác.
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
