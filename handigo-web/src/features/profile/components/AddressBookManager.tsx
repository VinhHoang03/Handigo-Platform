import { useCallback, useEffect, useState } from "react";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { AddressBookModal } from "./AddressBookModal";
import {
  createUserAddress,
  deleteUserAddress,
  getUserAddresses,
  updateUserAddress,
} from "@/features/profile/api/addressBook.api";
import type {
  UserAddress,
  UserAddressPayload,
} from "@/features/profile/types/profile.types";
import { getErrorMessage } from "@/utils/apiError";

interface AddressBookManagerProps {
  defaultRecipient: { name: string; phone: string };
  selectedAddressId?: string;
  selectable?: boolean;
  compact?: boolean;
  singleAddressMode?: boolean;
  onManageAddresses?: () => void;
  onSelectAddress?: (address: UserAddress | null) => void;
}

export function AddressBookManager({
  defaultRecipient,
  selectedAddressId,
  selectable = false,
  compact = false,
  singleAddressMode = false,
  onManageAddresses,
  onSelectAddress,
}: AddressBookManagerProps) {
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserAddress | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const loadAddresses = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getUserAddresses();
      setAddresses(data);
      setError("");

      if (selectable && data.length > 0) {
        const selectedAddress = data.find((item) => item.id === selectedAddressId);
        const nextAddress = selectedAddress || data.find((item) => item.isDefault) || data[0];
        if (nextAddress.id !== selectedAddressId) {
          onSelectAddress?.(nextAddress);
        }
      }
    } catch {
      setError("Không tải được danh sách địa chỉ đã lưu.");
    } finally {
      setIsLoading(false);
    }
  }, [onSelectAddress, selectable, selectedAddressId]);

  useEffect(() => {
    // Tải dữ liệu từ API khi component được gắn hoặc tiêu chí chọn thay đổi.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAddresses();
  }, [loadAddresses]);

  const openCreate = () => {
    setEditingAddress(null);
    setError("");
    setIsModalOpen(true);
  };

  const openEdit = (address: UserAddress) => {
    setEditingAddress(address);
    setError("");
    setIsModalOpen(true);
  };

  const activeAddress =
    addresses.find((item) => item.id === selectedAddressId)
    || addresses.find((item) => item.isDefault)
    || addresses[0]
    || null;
  const displayedAddresses = singleAddressMode && activeAddress
    ? [activeAddress]
    : addresses;

  const handleSubmit = async (
    payload: UserAddressPayload,
    address: UserAddress | null,
  ) => {
    try {
      setIsSaving(true);
      const savedAddress = address
        ? await updateUserAddress(address.id, payload)
        : await createUserAddress(payload);
      await loadAddresses();
      onSelectAddress?.(savedAddress);
    } catch (submitError) {
      const message = getErrorMessage(
        submitError,
        "Không thể lưu địa chỉ. Vui lòng thử lại.",
      );
      setError(message);
      throw submitError;
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsSaving(true);
      await deleteUserAddress(deleteTarget.id);
      const nextAddresses = addresses.filter(
        (item) => item.id !== deleteTarget.id,
      );
      setAddresses(nextAddresses);
      setError("");
      if (selectedAddressId === deleteTarget.id && nextAddresses.length > 0) {
        onSelectAddress?.(
          nextAddresses.find((item) => item.isDefault) || nextAddresses[0],
        );
      } else if (selectedAddressId === deleteTarget.id) {
        onSelectAddress?.(null);
      }
      setDeleteTarget(null);
    } catch (deleteError) {
      setError(
        getErrorMessage(deleteError, "Không thể xóa địa chỉ. Vui lòng thử lại."),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="saved-addresses" className={compact ? "space-y-3" : "rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-5"}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="font-headline-sm text-headline-sm text-on-surface">
            {singleAddressMode ? "Địa chỉ thực hiện" : "Địa chỉ đã lưu"}
          </h4>
          {!compact && (
            <p className="mt-1 text-sm text-on-surface-variant">
              Dùng cho đặt lịch và hồ sơ tài khoản.
            </p>
          )}
        </div>
        {(!singleAddressMode || !isLoading) && (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
            onClick={() => {
              if (singleAddressMode && onManageAddresses) {
                onManageAddresses();
                return;
              }
              if (singleAddressMode && activeAddress) {
                openEdit(activeAddress);
                return;
              }
              openCreate();
            }}
          >
            {singleAddressMode && activeAddress
              ? <Pencil size={16} />
              : <Plus size={16} />}
            {singleAddressMode && activeAddress ? "Sửa" : "Thêm địa chỉ mới"}
          </button>
        )}
      </div>

      {error && <p className="mb-3 rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}

      {isLoading ? (
        <div className="rounded-lg bg-surface-container-low p-4 text-on-surface-variant">
          Đang tải địa chỉ...
        </div>
      ) : addresses.length === 0 ? (
        <button
          type="button"
          className="w-full rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-5 text-center text-on-surface-variant hover:border-primary hover:text-primary"
          onClick={() => {
            if (singleAddressMode && onManageAddresses) onManageAddresses();
            else openCreate();
          }}
        >
          Bạn chưa có địa chỉ. Nhấn để thêm địa chỉ mới.
        </button>
      ) : (
        <div className={compact ? "max-h-52 space-y-2 overflow-y-auto pr-1" : "space-y-3"}>
          {displayedAddresses.map((address) => {
            const selected = selectedAddressId === address.id;
            return (
              <div
                key={address.id}
                className={`flex items-start gap-3 rounded-xl border p-3 transition ${
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-outline-variant/30 bg-surface-container-low hover:border-primary/50"
                }`}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  onClick={() => selectable && onSelectAddress?.(address)}
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${selected ? "bg-primary text-on-primary" : "bg-primary/10 text-primary"}`}>
                    <MapPin size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 font-bold text-on-surface">
                      {address.note || `${address.ward}, ${address.province}`}
                      {address.isDefault && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] uppercase text-primary">Mặc định</span>}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-on-surface-variant">{address.fullAddress}</span>
                    <span className="mt-1 block text-xs text-on-surface-variant">
                      Người nhận: {address.recipientName || "Chưa cập nhật"}
                      {address.recipientPhone ? ` • ${address.recipientPhone}` : ""}
                    </span>
                  </span>
                </button>
                {!singleAddressMode && (
                  <div className="flex shrink-0 gap-1">
                    <button type="button" aria-label="Sửa địa chỉ" className="grid h-9 w-9 place-items-center rounded-full text-on-surface-variant hover:bg-primary/10 hover:text-primary" disabled={isSaving} onClick={() => openEdit(address)}>
                      <Pencil size={16} />
                    </button>
                    <button type="button" aria-label="Xóa địa chỉ" className="grid h-9 w-9 place-items-center rounded-full text-on-surface-variant hover:bg-error/10 hover:text-error" disabled={isSaving} onClick={() => setDeleteTarget(address)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <AddressBookModal
          key={editingAddress?.id || "new-address"}
          open
          address={editingAddress}
          addressCount={addresses.length}
          isSaving={isSaving}
          defaultRecipient={defaultRecipient}
          onClose={() => {
            if (!isSaving) setIsModalOpen(false);
          }}
          onSubmit={handleSubmit}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa địa chỉ"
        message={`Bạn chắc chắn muốn xóa địa chỉ "${deleteTarget?.fullAddress || ""}"? Hành động này không thể khôi phục.`}
        busy={isSaving}
        variant="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
