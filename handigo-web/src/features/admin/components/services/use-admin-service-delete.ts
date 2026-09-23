import { useState } from 'react';
import { getErrorMessage } from '@/utils/apiError';
import { categoryServiceApi } from '../../api/categoryService.api';
import type { Service } from '../../types/categoryService.types';

interface DeleteTarget {
  kind: 'service' | 'option';
  id: string;
  name: string;
}

interface UseAdminServiceDeleteParams {
  selectedService: Service | null;
  setBusy: (value: boolean) => void;
  setNotice: (value: string) => void;
  setError: (value: string) => void;
  reloadAll: () => Promise<void>;
  reloadOptions: (serviceId: string) => Promise<void>;
  updateSearchParams: (updates: Record<string, string | null>) => void;
}

/** Xóa dịch vụ hoặc tùy chọn dịch vụ, có bước xác nhận ở `ConfirmDialog`. */
export function useAdminServiceDelete({
  selectedService,
  setBusy,
  setNotice,
  setError,
  reloadAll,
  reloadOptions,
  updateSearchParams,
}: UseAdminServiceDeleteParams) {
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    setNotice('');
    try {
      if (deleteTarget.kind === 'service') {
        await categoryServiceApi.deleteService(deleteTarget.id);
        setDeleteTarget(null);
        setNotice('Đã xóa dịch vụ.');
        updateSearchParams({ serviceId: null });
        await reloadAll();
      } else {
        await categoryServiceApi.deleteServiceOption(deleteTarget.id);
        setDeleteTarget(null);
        setNotice('Đã xóa tùy chọn.');
        if (selectedService) await reloadOptions(selectedService._id);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Có lỗi xảy ra.'));
    } finally {
      setBusy(false);
    }
  };

  return { deleteTarget, setDeleteTarget, confirmDelete };
}
