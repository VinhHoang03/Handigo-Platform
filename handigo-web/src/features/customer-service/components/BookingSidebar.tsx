import type { Address, Service } from "@/types/booking";
import { money } from "../utils/serviceDisplay";
import { AddressPicker } from "./AddressPicker";

interface BookingSidebarProps {
  service: Service;
  estimatePrice: number;
  addresses: Address[];
  addressId: string | undefined;
  isLoadingAddresses: boolean;
  isLocating: boolean;
  addressSelectionError: string;
  requiresPhoneUpdate: boolean;
  onAddressChange: (value: string) => void;
  isBookDisabled: boolean;
  onBookNow: () => void;
}

/** Panel giá tạm tính, chọn địa chỉ và nút đặt lịch. */
export function BookingSidebar({
  service,
  estimatePrice,
  addresses,
  addressId,
  isLoadingAddresses,
  isLocating,
  addressSelectionError,
  requiresPhoneUpdate,
  onAddressChange,
  isBookDisabled,
  onBookNow,
}: BookingSidebarProps) {
  return (
    <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-lg">
      <div className="mb-5 flex items-center justify-between">
        <span className="text-on-surface-variant">Giá tạm tính</span>
        <span className="text-2xl font-bold tabular-nums text-primary">
          {estimatePrice > 0
            ? money.format(estimatePrice)
            : service.serviceType === "fixed_price"
              ? "Chọn tùy chọn"
              : "Báo giá"}
        </span>
      </div>

      <div className="mb-5 space-y-3">
        <div className="rounded-lg bg-surface-container-low p-3">
          <p className="text-xs font-bold uppercase text-on-surface-variant">Loại giá</p>
          <p className="mt-1 font-semibold">
            {service.serviceType === "fixed_price" ? "Giá cố định" : "Báo giá sau khảo sát"}
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-lg bg-success/10 p-3">
          <span className="material-symbols-outlined text-success">verified_user</span>
          <span className="text-sm font-bold">Provider đã được xác minh</span>
        </div>
        <div className="flex items-center gap-3 rounded-lg bg-primary-container/5 p-3">
          <span className="material-symbols-outlined text-primary">security</span>
          <span className="text-sm">Thanh toán an toàn</span>
        </div>
      </div>

      <AddressPicker
        addresses={addresses}
        addressId={addressId}
        isLoadingAddresses={isLoadingAddresses}
        isLocating={isLocating}
        addressSelectionError={addressSelectionError}
        requiresPhoneUpdate={requiresPhoneUpdate}
        onAddressChange={onAddressChange}
      />

      <button
        type="button"
        onClick={onBookNow}
        disabled={isBookDisabled}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-lg font-bold text-on-primary shadow-md transition hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
      >
        Đặt lịch ngay
        <span className="material-symbols-outlined">arrow_forward</span>
      </button>
    </div>
  );
}
