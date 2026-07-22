import { useEffect, useMemo, useState } from 'react';
import { getErrorMessage } from '@/utils/apiError';
import { categoryServiceApi } from '../../api/categoryService.api';
import type { Category, CategoryDetail } from '../../types/categoryService.types';
import { getServiceCategoryId } from './category-service.helpers';

/**
 * Tải danh sách danh mục (debounce theo `search`) và chi tiết danh mục đang
 * chọn. Tách khỏi `useAdminCategoryServicesController` để hook đó gọn hơn.
 */
export function useAdminCategoryServicesData() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [selected, setSelected] = useState<CategoryDetail | null>(null);
  const [serviceCounts, setServiceCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [serviceStatus, setServiceStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  const visibleServices = useMemo(() => {
    const services = selected?.services || [];
    if (!serviceStatus) return services;
    return services.filter((service) => String(service.isActive) === serviceStatus);
  }, [selected, serviceStatus]);

  const loadCategories = async (preferredId?: string) => {
    setLoading(true);
    setError('');
    try {
      const [categoryResult, serviceResult] = await Promise.all([
        categoryServiceApi.listCategories({ page: 1, limit: 100, search: search.trim() || undefined }),
        categoryServiceApi.listServices({ page: 1, limit: 100 }),
      ]);
      setCategories(categoryResult.items);
      setServiceCounts(
        serviceResult.items.reduce<Record<string, number>>((acc, service) => {
          const categoryId = getServiceCategoryId(service);
          if (!categoryId) return acc;
          acc[categoryId] = (acc[categoryId] || 0) + 1;
          return acc;
        }, {}),
      );
      const nextId = preferredId || selectedId || categoryResult.items[0]?._id || '';
      setSelectedId(categoryResult.items.some((item) => item._id === nextId) ? nextId : categoryResult.items[0]?._id || '');
    } catch (err) {
      setError(getErrorMessage(err, 'Có lỗi xảy ra.'));
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: string) => {
    if (!id) {
      setSelected(null);
      return;
    }
    setDetailLoading(true);
    setError('');
    try {
      const detail = await categoryServiceApi.getCategory(id);
      setSelected(detail);
      setServiceCounts((counts) => ({ ...counts, [id]: detail.services.length }));
    } catch (err) {
      setSelected(null);
      setError(getErrorMessage(err, 'Có lỗi xảy ra.'));
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCategories(), 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDetail(selectedId), 0);
    return () => window.clearTimeout(timer);
  }, [selectedId]);

  return {
    categories,
    selectedId,
    setSelectedId,
    selected,
    serviceCounts,
    search,
    setSearch,
    serviceStatus,
    setServiceStatus,
    loading,
    detailLoading,
    error,
    setError,
    visibleServices,
    loadCategories,
    loadDetail,
  };
}
