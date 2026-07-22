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
      {/* Trước đây khối này in "Giá tạm tính: Báo giá" rồi ngay dưới lại có ô
          "LOẠI GIÁ: Báo giá sau khảo sát" — hai lần nói cùng một điều, và với
          dịch vụ báo giá thì dòng trên còn từng in ra tiền cọc. Gộp làm một. */}
      <div className="mb-5">
        <p className="text-on-surface-variant">Giá tạm tính</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-primary">
          {estimatePrice > 0
            ? money.format(estimatePrice)
            : service.serviceType === "fixed_price"
              ? "Chọn gói dịch vụ"
              : "Báo giá sau khảo sát"}
        </p>
        {service.serviceType === "variable_price" && (
          <p className="mt-1 text-sm text-on-surface-variant">
            Thợ khảo sát rồi chốt giá với bạn trước khi làm.
          </p>
        )}
      </div>

      <div className="mb-5 space-y-3">
        <div className="flex items-center gap-3 rounded-lg bg-success/10 p-3">
          <span className="material-symbols-outlined text-success">verified_user</span>
          <span className="text-sm font-bold">Thợ đã qua kiểm duyệt</span>
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
