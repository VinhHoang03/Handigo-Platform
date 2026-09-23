import { useState, type FormEvent } from 'react';
import { getErrorMessage } from '@/utils/apiError';
import { categoryServiceApi } from '../../api/categoryService.api';
import type { Service } from '../../types/categoryService.types';
import { emptyServiceForm, getCategoryId, toServicePayload, type ServiceForm } from './service.helpers';

interface UseAdminServiceFormParams {
  categoryFilter: string;
  selectedService: Service | null;
  busy: boolean;
  setBusy: (value: boolean) => void;
  setNotice: (value: string) => void;
  setError: (value: string) => void;
  discardTarget: 'service' | 'option' | null;
  setDiscardTarget: (target: 'service' | 'option' | null) => void;
  reloadAll: () => Promise<void>;
  updateSearchParams: (updates: Record<string, string | null>) => void;
}

/** Modal thêm/sửa dịch vụ — mở/đóng có xác nhận bỏ thay đổi, lưu qua API. */
export function useAdminServiceForm({
  categoryFilter,
  selectedService,
  busy,
  setBusy,
  setNotice,
  setError,
  setDiscardTarget,
  reloadAll,
  updateSearchParams,
}: UseAdminServiceFormParams) {
  const [serviceModal, setServiceModal] = useState<'create' | 'edit' | null>(null);
  const [serviceForm, setServiceForm] = useState<ServiceForm>(emptyServiceForm);
  const [initialServiceForm, setInitialServiceForm] = useState<ServiceForm>(emptyServiceForm);

  const openCreateService = () => {
    const nextForm = { ...emptyServiceForm, categoryId: categoryFilter };
    setServiceForm(nextForm);
    setInitialServiceForm(nextForm);
    setServiceModal('create');
  };

  const openEditService = (service: Service) => {
    const nextForm = {
      categoryId: getCategoryId(service),
      name: service.name,
      slug: service.slug,
      image: service.image || '',
      description: service.description || '',
      serviceType: service.serviceType,
      fixedPrice: service.fixedPrice == null ? '' : String(service.fixedPrice),
      depositAmount: service.depositAmount == null ? '' : String(service.depositAmount),
      requiresOptionSelection: service.requiresOptionSelection ?? false,
      isActive: service.isActive,
    };
    setServiceForm(nextForm);
    setInitialServiceForm(nextForm);
    setServiceModal('edit');
  };

  const requestCloseServiceModal = () => {
    if (busy) return;
    if (JSON.stringify(serviceForm) !== JSON.stringify(initialServiceForm)) {
      setDiscardTarget('service');
      return;
    }
    setServiceModal(null);
  };

  const saveService = async (event: FormEvent) => {
    event.preventDefault();
    if (!serviceForm.categoryId) {
      setError('Vui lòng chọn danh mục trước khi thêm dịch vụ.');
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      const payload = toServicePayload(serviceForm);
      const saved = serviceModal === 'edit' && selectedService
        ? await categoryServiceApi.updateService(selectedService._id, payload)
        : await categoryServiceApi.createService(payload);
      setServiceModal(null);
      setNotice(serviceModal === 'edit' ? 'Đã cập nhật dịch vụ.' : 'Đã thêm dịch vụ.');
      await reloadAll();
      updateSearchParams(
        serviceModal === 'edit'
          ? { serviceId: saved._id }
          : { search: null, category: null, status: null, serviceId: saved._id },
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Có lỗi xảy ra.'));
    } finally {
      setBusy(false);
    }
  };

  return { serviceModal, setServiceModal, serviceForm, setServiceForm, openCreateService, openEditService, requestCloseServiceModal, saveService };
}
