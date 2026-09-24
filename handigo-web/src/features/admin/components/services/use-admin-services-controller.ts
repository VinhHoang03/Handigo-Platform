import { useMemo, useState } from 'react';
import type { Category } from '../../types/categoryService.types';
import { getCategoryId } from './service.helpers';
import { useAdminOptionForm } from './use-admin-option-form';
import { useAdminServiceDelete } from './use-admin-service-delete';
import { useAdminServiceForm } from './use-admin-service-form';
import { useAdminServicesData } from './use-admin-services-data';
import { useAdminServicesFilters } from './use-admin-services-filters';

/**
 * Điều phối các hook nhỏ của trang quản lý dịch vụ (bộ lọc URL, dữ liệu,
 * modal dịch vụ, modal tùy chọn, xóa) thành một API duy nhất cho trang.
 */
export function useAdminServicesController() {
  const filters = useAdminServicesFilters();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [discardTarget, setDiscardTarget] = useState<'service' | 'option' | null>(null);

  const visibleServicesOf = (services: ReturnType<typeof useAdminServicesData>['services']) =>
    services.filter((service) => {
      const matchSearch = !filters.search || service.name.toLowerCase().includes(filters.search.toLowerCase());
      const matchCategory = !filters.categoryFilter || getCategoryId(service) === filters.categoryFilter;
      const matchStatus = !filters.statusFilter || String(service.isActive) === filters.statusFilter;
      return matchSearch && matchCategory && matchStatus;
    });

  const data = useAdminServicesData(filters.selectedServiceId);
  const visibleServices = useMemo(
    () => visibleServicesOf(data.services),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.services, filters.search, filters.categoryFilter, filters.statusFilter],
  );
  const selectedService = useMemo(
    () => visibleServices.find((service) => service._id === filters.selectedServiceId) || visibleServices[0] || null,
    [filters.selectedServiceId, visibleServices],
  );

  const serviceForm = useAdminServiceForm({
    categoryFilter: filters.categoryFilter,
    selectedService,
    busy,
    setBusy,
    setNotice,
    setError: data.setError,
    discardTarget,
    setDiscardTarget,
    reloadAll: data.loadAll,
    updateSearchParams: filters.updateSearchParams,
  });

  const optionForm = useAdminOptionForm({
    selectedService,
    options: data.options,
    busy,
    setBusy,
    setNotice,
    setDiscardTarget,
    reloadOptions: data.loadOptions,
  });

  const deletion = useAdminServiceDelete({
    selectedService,
    setBusy,
    setNotice,
    setError: data.setError,
    reloadAll: data.loadAll,
    reloadOptions: data.loadOptions,
    updateSearchParams: filters.updateSearchParams,
  });

  const confirmDiscard = () => {
    if (discardTarget === 'service') serviceForm.setServiceModal(null);
    if (discardTarget === 'option') optionForm.setOptionModal(null);
    setDiscardTarget(null);
  };

  const categoryNames = useMemo(() => new Map(data.categories.map((category: Category) => [category._id, category.name])), [data.categories]);
  const selectedCategoryName = selectedService ? categoryNames.get(getCategoryId(selectedService)) || '' : '';
  const activeServiceCount = data.services.filter((service) => service.isActive).length;

  return {
    categories: data.categories,
    services: data.services,
    options: data.options,
    search: filters.search,
    searchParam: filters.searchParam,
    categoryFilter: filters.categoryFilter,
    statusFilter: filters.statusFilter,
    hasFilters: filters.hasFilters,
    setSearchDraft: filters.setSearchDraft,
    updateSearchParams: filters.updateSearchParams,
    clearFilters: filters.clearFilters,
    loading: data.loading,
    optionsLoading: data.optionsLoading,
    error: data.error,
    busy,
    notice,
    reload: data.loadAll,
    visibleServices,
    selectedService,
    selectedCategoryName,
    activeServiceCount,
    discardTarget,
    setDiscardTarget,
    confirmDiscard,
    ...serviceForm,
    ...optionForm,
    ...deletion,
  };
}
