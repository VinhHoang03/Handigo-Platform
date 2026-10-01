import { useEffect, useState, type FormEvent } from 'react';
import { useToast } from '@/components/common/Toast';
import { getErrorMessage } from '@/utils/apiError';
import { categoryServiceApi } from '../../api/categoryService.api';
import type { Category, Service } from '../../types/categoryService.types';
import {
  countServicesByCategory,
  emptyCategoryForm,
  toCategoryPayload,
  type CategoryFormState,
} from './category.helpers';

const LIMIT = 10;
const PINNED_CATEGORIES_STORAGE_KEY = 'handigo.admin.categories.pinned';

const readPinnedCategoryIds = () => {
  try {
    const stored = window.localStorage.getItem(PINNED_CATEGORIES_STORAGE_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) && parsed.every((id): id is string => typeof id === 'string') ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * Toàn bộ state + hành động của trang danh mục (tải danh sách, phân trang,
 * modal thêm/sửa, xóa). Tách khỏi `AdminCategoriesPage` để trang chính chỉ
 * còn lo bố cục.
 */
export function useAdminCategoriesController() {
  const { addToast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [serviceCounts, setServiceCounts] = useState<Record<string, number>>({});
  const [servicesByCategory, setServicesByCategory] = useState<Record<string, Service[]>>({});
  const [optionCounts, setOptionCounts] = useState<Record<string, number>>({});
  const [optionsLoadingId, setOptionsLoadingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [serviceStats, setServiceStats] = useState({ active: 0, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [pinnedIds, setPinnedIds] = useState<string[]>(readPinnedCategoryIds);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState<CategoryFormState>(emptyCategoryForm);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const load = async (overridePage = page) => {
    setLoading(true);
    setError('');
    try {
      const [categoryResult, serviceResult, activeServiceResult] = await Promise.all([
        categoryServiceApi.listCategories({
          page: overridePage,
          limit: LIMIT,
          search: search.trim() || undefined,
          isActive: statusFilter || undefined,
        }),
        categoryServiceApi.listServices({ page: 1, limit: 200 }),
        categoryServiceApi.listServices({ page: 1, limit: 100, isActive: 'true' }),
      ]);
      setCategories(categoryResult.items);
      setTotal(categoryResult.pagination.total);
      setTotalPages(categoryResult.pagination.totalPages);
      setPage(overridePage);
      setServiceCounts(countServicesByCategory(serviceResult.items));
      setServicesByCategory(
        serviceResult.items.reduce<Record<string, Service[]>>((groups, service) => {
          const categoryId = typeof service.categoryId === 'string' ? service.categoryId : service.categoryId?._id ?? '';
          if (categoryId) groups[categoryId] = [...(groups[categoryId] || []), service];
          return groups;
        }, {}),
      );
      setServiceStats({
        active: activeServiceResult.pagination.total,
        total: serviceResult.pagination.total,
      });
    } catch (err) {
      setError(getErrorMessage(err, 'Có lỗi xảy ra.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(1), 250);
    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PINNED_CATEGORIES_STORAGE_KEY, JSON.stringify(pinnedIds));
    } catch {
      // Không chặn thao tác ghim nếu trình duyệt không cho lưu localStorage.
    }
  }, [pinnedIds]);

  const changePage = (nextPage: number) => {
    setPage(nextPage);
    void load(nextPage);
  };

  const togglePinned = (id: string) => {
    setPinnedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const toggleExpanded = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    const services = servicesByCategory[id] || [];
    const missing = services.filter((service) => optionCounts[service._id] === undefined);
    if (!missing.length) return;
    setOptionsLoadingId(id);
    try {
      const results = await Promise.all(
        missing.map(async (service) => [service._id, (await categoryServiceApi.listServiceOptions(service._id)).length] as const),
      );
      setOptionCounts((current) => ({ ...current, ...Object.fromEntries(results) }));
    } finally {
      setOptionsLoadingId(null);
    }
  };

  const openCreate = () => {
    setForm(emptyCategoryForm);
    setEditing(null);
    setModal('create');
  };

  const openEdit = (category: Category) => {
    setEditing(category);
    setForm({
      name: category.name,
      slug: category.slug,
      icon: category.icon || '',
      description: category.description || '',
      isActive: category.isActive,
    });
    setModal('edit');
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      if (modal === 'edit' && editing) {
        await categoryServiceApi.updateCategory(editing._id, toCategoryPayload(form));
        setNotice('Đã cập nhật danh mục.');
      } else {
        await categoryServiceApi.createCategory(toCategoryPayload(form));
        setNotice('Đã thêm danh mục.');
      }
      setModal(null);
      void load();
    } catch (err) {
      setError(getErrorMessage(err, 'Có lỗi xảy ra.'));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setBusy(true);
    setNotice('');
    try {
      await categoryServiceApi.deleteCategory(target._id);
      addToast('Đã xóa danh mục.', 'success');
      void load();
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        addToast('Không thể xóa danh mục vì danh mục vẫn còn dịch vụ.', 'error');
      } else {
        addToast(getErrorMessage(err, 'Không thể xóa danh mục.'), 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  return {
    LIMIT,
    categories,
    serviceCounts,
    servicesByCategory,
    optionCounts,
    optionsLoadingId,
    expandedId,
    serviceStats,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    sortOrder,
    setSortOrder,
    pinnedIds,
    togglePinned,
    toggleExpanded,
    page,
    totalPages,
    total,
    loading,
    busy,
    error,
    notice,
    modal,
    setModal,
    form,
    setForm,
    deleteTarget,
    setDeleteTarget,
    reload: load,
    changePage,
    openCreate,
    openEdit,
    save,
    confirmDelete,
  };
}
