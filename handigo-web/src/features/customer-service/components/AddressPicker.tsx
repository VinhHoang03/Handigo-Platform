import { Link } from "react-router-dom";
import type { Address } from "@/types/booking";
import { CURRENT_LOCATION_VALUE, formatAddressLabel } from "./addressLocationUtils";

interface AddressPickerProps {
  addresses: Address[];
  addressId: string | undefined;
  isLoadingAddresses: boolean;
  isLocating: boolean;
  addressSelectionError: string;
  requiresPhoneUpdate: boolean;
  onAddressChange: (value: string) => void;
}

/** Chọn địa chỉ thực hiện: vị trí hiện tại hoặc một địa chỉ đã lưu. */
export function AddressPicker({
  addresses,
  addressId,
  isLoadingAddresses,
  isLocating,
  addressSelectionError,
  requiresPhoneUpdate,
  onAddressChange,
}: AddressPickerProps) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-label-md font-semibold text-on-surface">
        Địa chỉ thực hiện
      </p>
      <div
        className="grid max-h-72 gap-2 overflow-y-auto pr-1"
        role="radiogroup"
        aria-label="Chọn địa chỉ thực hiện"
      >
        <button
          type="button"
          role="radio"
          aria-checked={false}
          disabled={isLoadingAddresses || isLocating}
          onClick={() => onAddressChange(CURRENT_LOCATION_VALUE)}
          className="relative flex min-h-20 w-full items-start gap-3 rounded-xl border border-outline-variant/50 bg-surface-container-low p-3 text-left transition hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="material-symbols-outlined mt-0.5 shrink-0 text-xl leading-none text-primary">
            my_location
          </span>
          <span className="min-w-0 text-sm font-semibold leading-5 text-on-surface">
            {isLocating ? "Đang lấy vị trí hiện tại..." : "Vị trí hiện tại"}
          </span>
        </button>

        {addresses.map((address) => {
          const isSelected = address._id === addressId;

          return (
            <button
              key={address._id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={isLoadingAddresses || isLocating}
              onClick={() => onAddressChange(address._id)}
              className={`relative flex min-h-20 w-full items-start gap-3 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60 ${
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-outline-variant/50 bg-surface-container-low hover:border-primary/50 hover:bg-primary/5"
              } ${address.isDefault ? "pb-8" : ""}`}
            >
              <span className="material-symbols-outlined mt-0.5 shrink-0 text-xl leading-none text-primary">
                location_on
              </span>
              <span className="min-w-0 flex-1 text-sm font-semibold leading-5 text-on-surface">
                {formatAddressLabel(address)}
              </span>
              {isSelected && (
                <span className="material-symbols-outlined shrink-0 text-xl leading-none text-primary">
                  check_circle
                </span>
              )}
              {address.isDefault && (
                <span className="absolute bottom-2 right-3 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                  Mặc định
                </span>
              )}
            </button>
          );
        })}

        {isLoadingAddresses && (
          <p className="rounded-xl bg-surface-container-low px-3 py-4 text-center text-sm text-on-surface-variant">
            Đang tải địa chỉ...
          </p>
        )}
      </div>
      {addressSelectionError && (
        <div className="mt-2 rounded-lg bg-error/10 px-3 py-2 text-xs font-semibold text-error">
          <p>{addressSelectionError}</p>
          {requiresPhoneUpdate && (
            <Link
              to="/customer/profile"
              className="mt-2 inline-flex items-center gap-1 underline underline-offset-2"
            >
              Cập nhật số điện thoại
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
