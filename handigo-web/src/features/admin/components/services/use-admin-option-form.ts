import { useState, type FormEvent } from 'react';
import { getErrorMessage } from '@/utils/apiError';
import { categoryServiceApi } from '../../api/categoryService.api';
import type { Service, ServiceOption } from '../../types/categoryService.types';
import { emptyOptionForm, toOptionPayload, type OptionForm } from './service.helpers';

interface UseAdminOptionFormParams {
  selectedService: Service | null;
  options: ServiceOption[];
  busy: boolean;
  setBusy: (value: boolean) => void;
  setNotice: (value: string) => void;
  setDiscardTarget: (target: 'service' | 'option' | null) => void;
  reloadOptions: (serviceId: string) => Promise<void>;
}

/** Modal thêm/sửa tùy chọn dịch vụ — gồm kiểm tra trùng cách lựa chọn trong nhóm. */
export function useAdminOptionForm({
  selectedService,
  options,
  busy,
  setBusy,
  setNotice,
  setDiscardTarget,
  reloadOptions,
}: UseAdminOptionFormParams) {
  const [optionModal, setOptionModal] = useState<'create' | 'edit' | null>(null);
  const [optionForm, setOptionForm] = useState<OptionForm>(emptyOptionForm);
  const [initialOptionForm, setInitialOptionForm] = useState<OptionForm>(emptyOptionForm);
  const [editingOption, setEditingOption] = useState<ServiceOption | null>(null);
  const [optionFormError, setOptionFormError] = useState('');

  const openCreateOption = () => {
    setOptionForm(emptyOptionForm);
    setInitialOptionForm(emptyOptionForm);
    setEditingOption(null);
    setOptionFormError('');
    setOptionModal('create');
  };

  const openEditOption = (option: ServiceOption) => {
    setEditingOption(option);
    const nextForm = {
      name: option.name,
      description: option.description || '',
      image: option.image || '',
      optionType: option.optionType,
      price: String(option.price),
      selectionGroup: option.selectionGroup || '',
      selectionMode: option.selectionMode ?? 'multiple',
      allowsQuantity: option.allowsQuantity ?? false,
      sortOrder: String(option.sortOrder ?? 0),
      isActive: option.isActive,
    };
    setOptionForm(nextForm);
    setInitialOptionForm(nextForm);
    setOptionFormError('');
    setOptionModal('edit');
  };

  const requestCloseOptionModal = () => {
    if (busy) return;
    if (JSON.stringify(optionForm) !== JSON.stringify(initialOptionForm)) {
      setDiscardTarget('option');
      return;
    }
    setOptionModal(null);
  };

  const saveOption = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedService) return;
    const normalizedGroup = optionForm.selectionGroup.trim().toLocaleLowerCase('vi-VN');
    const normalizedOriginalGroup = editingOption?.selectionGroup?.trim().toLocaleLowerCase('vi-VN') ?? '';
    const staysInCurrentGroup = optionModal === 'edit' && normalizedGroup === normalizedOriginalGroup;
    const sibling = normalizedGroup
      ? options.find(
          (option) => option._id !== editingOption?._id && option.selectionGroup?.trim().toLocaleLowerCase('vi-VN') === normalizedGroup,
        )
      : undefined;
    if (!staysInCurrentGroup && sibling && (sibling.selectionMode ?? 'multiple') !== optionForm.selectionMode) {
      const expectedMode = sibling.selectionMode === 'single' ? 'Chỉ chọn một' : 'Được chọn nhiều';
      setOptionFormError(
        `Nhóm “${optionForm.selectionGroup.trim()}” đang dùng cách lựa chọn “${expectedMode}”. Các tùy chọn trong cùng nhóm phải có cùng cách lựa chọn.`,
      );
      return;
    }

    setOptionFormError('');
    setBusy(true);
    setNotice('');
    try {
      if (optionModal === 'edit' && editingOption) {
        await categoryServiceApi.updateServiceOption(editingOption._id, toOptionPayload(optionForm, selectedService.serviceType));
        setNotice('Đã cập nhật tùy chọn.');
      } else {
        await categoryServiceApi.createServiceOption(selectedService._id, toOptionPayload(optionForm, selectedService.serviceType));
        setNotice('Đã thêm tùy chọn.');
      }
      setOptionModal(null);
      setOptionFormError('');
      await reloadOptions(selectedService._id);
    } catch (err) {
      setOptionFormError(getErrorMessage(err, 'Có lỗi xảy ra.'));
    } finally {
      setBusy(false);
    }
  };

  return {
    optionModal,
    setOptionModal,
    optionForm,
    setOptionForm,
    optionFormError,
    setOptionFormError,
    openCreateOption,
    openEditOption,
    requestCloseOptionModal,
    saveOption,
  };
}
