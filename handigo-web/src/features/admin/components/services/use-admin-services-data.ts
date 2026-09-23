import { useEffect, useState } from 'react';
import { getErrorMessage } from '@/utils/apiError';
import { categoryServiceApi } from '../../api/categoryService.api';
import type { Category, Service, ServiceOption } from '../../types/categoryService.types';

/**
 * Tải danh mục/dịch vụ (một lần) + tùy chọn của dịch vụ đang chọn (mỗi khi
 * đổi dịch vụ). Tách khỏi `useAdminServicesController` để hook đó gọn hơn.
 */
export function useAdminServicesData(selectedServiceId: string | undefined) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [options, setOptions] = useState<ServiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [error, setError] = useState('');

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [catResult, svcResult] = await Promise.all([
        categoryServiceApi.listCategories({ page: 1, limit: 200 }),
        categoryServiceApi.listServices({ page: 1, limit: 200 }),
      ]);
      setCategories(catResult.items);
      setServices(svcResult.items);
    } catch (err) {
      setError(getErrorMessage(err, 'Có lỗi xảy ra.'));
    } finally {
      setLoading(false);
    }
  };

  const loadOptions = async (serviceId: string) => {
    setOptionsLoading(true);
    try {
      const opts = await categoryServiceApi.listServiceOptions(serviceId);
      setOptions(opts);
    } catch {
      setOptions([]);
    } finally {
      setOptionsLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadAll(), 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (selectedServiceId) void loadOptions(selectedServiceId);
      else setOptions([]);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [selectedServiceId]);

  return {
    categories,
    services,
    options,
    loading,
    optionsLoading,
    error,
    setError,
    loadAll,
    loadOptions,
  };
}
