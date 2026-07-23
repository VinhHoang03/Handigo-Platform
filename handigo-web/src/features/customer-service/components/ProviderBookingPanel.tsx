import type { PublicProviderProfile } from "../api/customerService.api";
import { TrustItem } from "./ProviderProfilePrimitives";
import { ArrowRight } from "lucide-react";

interface ProviderBookingPanelProps {
  providerFullName: string;
  averageRating: number;
  services: PublicProviderProfile["provider"]["services"];
  selectedServiceId: string;
  onSelectService: (serviceId: string) => void;
  onBook: () => void;
}

/** Thẻ đặt dịch vụ với thợ: chọn dịch vụ và xác nhận đặt lịch. */
export function ProviderBookingPanel({
  providerFullName,
  averageRating,
  services,
  selectedServiceId,
  onSelectService,
  onBook,
}: ProviderBookingPanelProps) {
  return (
    <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-lg">
      <h3 className="text-xl font-bold text-on-background">
        Đặt dịch vụ với thợ này
      </h3>
      <p className="mt-2 text-sm text-on-surface-variant">
        Chọn dịch vụ bạn cần. Handigo sẽ giữ đúng thợ này khi họ phù
        hợp với khu vực và lịch đã chọn.
      </p>
      {services.length > 0 ? (
        <label className="mt-5 block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Dịch vụ cần đặt
          </span>
          <select
            value={selectedServiceId}
            onChange={(event) => onSelectService(event.target.value)}
            className="min-h-12 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 font-semibold text-on-surface outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
          >
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="mt-5 rounded-xl bg-surface-container-low p-3 text-sm text-on-surface-variant">
          Chuyên gia chưa có dịch vụ đang hoạt động để đặt lịch.
        </p>
      )}
      <div className="mt-5 space-y-3">
        <TrustItem icon="verified_user" text="Hồ sơ đã xác minh" />
        <TrustItem
          icon="star"
          text={`${averageRating.toFixed(1)} điểm đánh giá`}
        />
      </div>
      <button
        type="button"
        onClick={onBook}
        disabled={!selectedServiceId}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-bold text-on-primary shadow-md transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Đặt lịch với {providerFullName}
        <ArrowRight aria-hidden="true" size={24} />
      </button>
    </div>
  );
}
