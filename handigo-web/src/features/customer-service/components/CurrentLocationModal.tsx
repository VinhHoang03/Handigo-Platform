import { Modal } from "@/components/common/Modal";
import { LocationPickerMap } from "@/components/common/LocationPickerMap";
import type { CurrentLocationDraft } from "./addressLocationUtils";

interface CurrentLocationModalProps {
  draft: CurrentLocationDraft | null;
  isSaving: boolean;
  isResolving: boolean;
  error: string;
  onClose: () => void;
  onPositionChange: (latitude: number, longitude: number) => void;
  onConfirm: () => void;
}

/** Xác nhận vị trí hiện tại: ghim lại trên bản đồ trước khi lưu thành địa chỉ. */
export function CurrentLocationModal({
  draft,
  isSaving,
  isResolving,
  error,
  onClose,
  onPositionChange,
  onConfirm,
}: CurrentLocationModalProps) {
  return (
    <Modal
      open={Boolean(draft)}
      title="Chọn vị trí thực hiện"
      size="lg"
      closeOnOverlayClick={!isSaving}
      closeOnEsc={!isSaving}
      onClose={() => {
        if (!isSaving) onClose();
      }}
    >
      {draft && (
        <div className="space-y-4">
          <LocationPickerMap
            latitude={draft.latitude}
            longitude={draft.longitude}
            disabled={isSaving || isResolving}
            isResolvingAddress={isResolving}
            onPositionChange={onPositionChange}
          />

          <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
              Địa chỉ theo vị trí ghim
            </p>
            <p className="mt-1.5 text-sm font-semibold leading-6 text-on-surface">
              {draft.fullAddress}
            </p>
          </div>

          {error && (
            <div className="rounded-2xl bg-error/10 px-4 py-3 text-sm font-medium text-error">
              {error}
            </div>
          )}

          <div className="flex flex-col justify-end gap-3 pt-1 sm:flex-row">
            <button
              type="button"
              className="btn-secondary"
              disabled={isSaving}
              onClick={onClose}
            >
              Hủy
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={isSaving || isResolving || Boolean(error)}
              onClick={onConfirm}
            >
              {isSaving ? "Đang lưu vị trí..." : "Xác nhận vị trí này"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
