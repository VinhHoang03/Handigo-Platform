import { useAdminCategoryServicesData } from './use-admin-category-services-data';
import { useAdminCategoryServicesForms } from './use-admin-category-services-forms';

/**
 * Điều phối hook dữ liệu (danh mục/chi tiết) và hook modal/xóa thành một API
 * duy nhất cho `AdminCategoryServicesPage`.
 */
export function useAdminCategoryServicesController() {
  const data = useAdminCategoryServicesData();
  const forms = useAdminCategoryServicesForms({
    selected: data.selected,
    setError: data.setError,
    loadCategories: data.loadCategories,
    loadDetail: data.loadDetail,
  });

  return {
    categories: data.categories,
    selectedId: data.selectedId,
    setSelectedId: data.setSelectedId,
    selected: data.selected,
    serviceCounts: data.serviceCounts,
    search: data.search,
    setSearch: data.setSearch,
    serviceStatus: data.serviceStatus,
    setServiceStatus: data.setServiceStatus,
    loading: data.loading,
    detailLoading: data.detailLoading,
    error: data.error,
    visibleServices: data.visibleServices,
    reload: data.loadCategories,
    ...forms,
  };
}
