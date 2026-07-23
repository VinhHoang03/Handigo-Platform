import { useCallback, useEffect, useState } from "react";
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

interface UseAddressBookManagerParams {
  selectedAddressId?: string;
  selectable?: boolean;
  singleAddressMode?: boolean;
  onSelectAddress?: (address: UserAddress | null) => void;
}

/**
 * Gom toàn bộ state + logic gọi API của AddressBookManager. Tách khỏi phần
 * trình bày để file component không vượt quá 200 dòng.
 */
export function useAddressBookManager({
  selectedAddressId,
  selectable = false,
  singleAddressMode = false,
  onSelectAddress,
}: UseAddressBookManagerParams) {
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
    } catch {
      setError("Không tải được danh sách địa chỉ đã lưu.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Chỉ tải từ API khi component được gắn; đổi lựa chọn dùng danh sách hiện có.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAddresses();
  }, [loadAddresses]);

  useEffect(() => {
    if (!selectable || addresses.length === 0) return;

    const selectedAddress = addresses.find(
      (item) => item.id === selectedAddressId,
    );
    const nextAddress =
      selectedAddress || addresses.find((item) => item.isDefault) || addresses[0];
    if (nextAddress.id !== selectedAddressId) {
      onSelectAddress?.(nextAddress);
    }
  }, [addresses, onSelectAddress, selectable, selectedAddressId]);

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

  return {
    addresses,
    displayedAddresses,
    editingAddress,
    deleteTarget,
    isModalOpen,
    isLoading,
    isSaving,
    error,
    openCreate,
    openEdit,
    setIsModalOpen,
    setDeleteTarget,
    handleSubmit,
    confirmDelete,
  };
}
