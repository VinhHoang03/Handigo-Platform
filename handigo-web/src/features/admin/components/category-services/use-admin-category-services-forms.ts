import { useState, type FormEvent } from 'react';
import { getErrorMessage } from '@/utils/apiError';
import { categoryServiceApi } from '../../api/categoryService.api';
import type { CategoryDetail, Service } from '../../types/categoryService.types';
import {
  emptyCategoryForm,
  emptyServiceForm,
  toCategoryPayload,
  toServicePayload,
  type CategoryFormState,
  type ServiceFormState,
} from './category-service.helpers';

interface UseAdminCategoryServicesFormsParams {
  selected: CategoryDetail | null;
  setError: (message: string) => void;
  loadCategories: (preferredId?: string) => Promise<void>;
  loadDetail: (id: string) => Promise<void>;
}

/**
 * Modal thêm/sửa danh mục, modal thêm/sửa dịch vụ và xóa (danh mục/dịch vụ)
 * của trang danh mục & dịch vụ. Tách khỏi `useAdminCategoryServicesController`
 * để hook đó gọn hơn.
 */
export function useAdminCategoryServicesForms({ selected, setError, loadCategories, loadDetail }: UseAdminCategoryServicesFormsParams) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [categoryModal, setCategoryModal] = useState<'create' | 'edit' | null>(null);
  const [serviceModal, setServiceModal] = useState<'create' | 'edit' | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(emptyCategoryForm);
  const [serviceForm, setServiceForm] = useState<ServiceFormState>(emptyServiceForm);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'category' | 'service'; id: string; name: string } | null>(null);

  const openCreateCategory = () => {
    setCategoryForm(emptyCategoryForm);
    setCategoryModal('create');
  };

  const openEditCategory = (category: CategoryDetail) => {
    setCategoryForm({
      name: category.name,
      slug: category.slug,
      icon: category.icon || '',
      description: category.description || '',
      isActive: category.isActive,
    });
    setCategoryModal('edit');
  };

  const openCreateService = () => {
    setServiceForm(emptyServiceForm);
    setEditingService(null);
    setServiceModal('create');
  };

  const openEditService = (service: Service) => {
    setEditingService(service);
    setServiceForm({
      name: service.name,
      slug: service.slug,
      image: service.image || '',
      description: service.description || '',
      serviceType: service.serviceType,
      fixedPrice: service.fixedPrice == null ? '' : String(service.fixedPrice),
      depositAmount: service.depositAmount == null ? '' : String(service.depositAmount),
      isActive: service.isActive,
    });
    setServiceModal('edit');
  };

  const saveCategory = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      const payload = toCategoryPayload(categoryForm);
      const saved = categoryModal === 'edit' && selected
        ? await categoryServiceApi.updateCategory(selected._id, payload)
        : await categoryServiceApi.createCategory(payload);
      setCategoryModal(null);
      setNotice(categoryModal === 'edit' ? 'Đã cập nhật danh mục.' : 'Đã thêm danh mục.');
      await loadCategories(saved._id);
      await loadDetail(saved._id);
    } catch (err) {
      setError(getErrorMessage(err, 'Có lỗi xảy ra.'));
    } finally {
      setBusy(false);
    }
  };

  const saveService = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setNotice('');
    try {
      const payload = toServicePayload(serviceForm, selected._id);
      if (serviceModal === 'edit' && editingService) await categoryServiceApi.updateService(editingService._id, payload);
      else await categoryServiceApi.createService(payload);
      setServiceModal(null);
      setEditingService(null);
      setNotice(serviceModal === 'edit' ? 'Đã cập nhật dịch vụ.' : 'Đã thêm dịch vụ.');
      await loadCategories(selected._id);
      await loadDetail(selected._id);
    } catch (err) {
      setError(getErrorMessage(err, 'Có lỗi xảy ra.'));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    setNotice('');
    try {
      if (deleteTarget.type === 'service') {
        await categoryServiceApi.deleteService(deleteTarget.id);
        if (selected) {
          await loadCategories(selected._id);
          await loadDetail(selected._id);
        }
        setNotice('Đã xóa dịch vụ.');
      } else {
        await categoryServiceApi.deleteCategory(deleteTarget.id);
        await loadCategories('');
        setNotice('Đã xóa danh mục.');
      }
      setDeleteTarget(null);
    } catch (err) {
      setError(getErrorMessage(err, 'Có lỗi xảy ra.'));
    } finally {
      setBusy(false);
    }
  };

  return {
    busy,
    notice,
    categoryModal,
    setCategoryModal,
    serviceModal,
    setServiceModal,
    categoryForm,
    setCategoryForm,
    serviceForm,
    setServiceForm,
    deleteTarget,
    setDeleteTarget,
    openCreateCategory,
    openEditCategory,
    openCreateService,
    openEditService,
    saveCategory,
    saveService,
    confirmDelete,
  };
}
