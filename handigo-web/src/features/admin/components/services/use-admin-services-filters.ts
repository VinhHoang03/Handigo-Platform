import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Bộ lọc dịch vụ đồng bộ với URL (search/category/status/serviceId).
 * Ô tìm kiếm dùng draft cục bộ, chỉ đẩy lên URL khi rời focus — tách khỏi
 * `useAdminServicesController` để hook đó gọn hơn.
 */
export function useAdminServicesFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const searchParam = searchParams.get('search') || '';
  const categoryFilter = searchParams.get('category') || '';
  const statusFilter = searchParams.get('status') || '';
  const selectedServiceId = searchParams.get('serviceId') || '';

  const [searchDraft, setSearchDraft] = useState({ value: searchParam, sourceParam: searchParam });
  const search = searchDraft.sourceParam === searchParam ? searchDraft.value : searchParam;

  const updateSearchParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    if (!Object.prototype.hasOwnProperty.call(updates, 'search')) {
      if (search) next.set('search', search);
      else next.delete('search');
    }
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => {
    setSearchDraft({ value: '', sourceParam: searchParam });
    updateSearchParams({ search: null, category: null, status: null, serviceId: null });
  };

  return {
    search,
    searchParam,
    categoryFilter,
    statusFilter,
    selectedServiceId,
    setSearchDraft,
    updateSearchParams,
    clearFilters,
    hasFilters: Boolean(search || categoryFilter || statusFilter),
  };
}
