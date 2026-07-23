import { Link } from "react-router-dom";
import { InitialsAvatar } from "@/components/common/InitialsAvatar";
import type { NearbyProvider } from "../api/customerService.api";
import { Star, UserSearch } from "lucide-react";

const formatDistance = (distanceMeters: number) => {
  if (distanceMeters < 0) return "Chưa xác định khoảng cách";
  if (distanceMeters < 1000) return `${Math.round(distanceMeters)} m`;
  return `${(distanceMeters / 1000).toFixed(1)} km`;
};

interface NearbyProviderCardProps {
  provider: NearbyProvider;
  isSelected: boolean;
  allowSelection: boolean;
  requireSelection: boolean;
  onSelect: (provider: NearbyProvider) => void;
}

/** Thẻ hiển thị một thợ phù hợp, kèm nút chọn/ưu tiên thợ. */
export function NearbyProviderCard({
  provider,
  isSelected,
  allowSelection,
  requireSelection,
  onSelect,
}: NearbyProviderCardProps) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        isSelected
          ? "border-primary bg-primary-container/10"
          : "border-outline-variant/40 bg-surface-container-lowest"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <InitialsAvatar
            name={provider.user.fullName || "Thợ"}
            src={provider.user.avatar}
            className="h-14 w-14"
          />
          <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-white bg-success" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-on-surface">
            {provider.user.fullName}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
            <span className="inline-flex items-center gap-1">
              <Star aria-hidden="true" size={16} className="text-star-gold" fill="currentColor" />
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
          aria-label={`Xem hồ sơ thợ ${provider.user.fullName}`}
        >
          <UserSearch aria-hidden="true" size={24} />
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
            onClick={() => onSelect(provider)}
            className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition ${
              isSelected
                ? "border-primary bg-primary text-on-primary"
                : "border-primary text-primary hover:bg-primary/5"
            }`}
          >
            {isSelected
              ? requireSelection
                ? "Đã chọn thợ"
                : "Đã ưu tiên thợ"
              : requireSelection
                ? "Chọn thợ này"
                : "Ưu tiên thợ này"}
            <span className="material-symbols-outlined text-[18px]">
              {isSelected ? "check_circle" : "add_circle"}
            </span>
          </button>
          {isSelected && !requireSelection && (
            <p className="mt-2 text-xs leading-5 text-on-surface-variant">
              Nếu thợ không thể nhận, Handigo sẽ tự tìm người phù hợp khác.
            </p>
          )}
        </>
      )}
    </div>
  );
}
