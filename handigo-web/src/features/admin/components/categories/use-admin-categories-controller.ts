import { useToastFeedback } from "@/components/common/Toast";
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useToast } from '@/components/common/Toast';
import { getErrorMessage } from '@/utils/apiError';
import { getAvailableCategoryIconColor, isCategoryIconColor, resolveCategoryIcon } from '@/components/common/category-icons';
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
 * modal thêm/sửa, bật/tắt trạng thái). Tách khỏi `AdminCategoriesPage` để trang chính chỉ
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
  const [error, setError] = useToastFeedback<string>('', "error");
  const [notice, setNotice] = useToastFeedback<string>('', "success");

  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState<CategoryFormState>(emptyCategoryForm);
  const [editing, setEditing] = useState<Category | null>(null);
  const [formError, setFormError] = useToastFeedback<string>('', "error");
  const [categoryIconColors, setCategoryIconColors] = useState<Array<Pick<Category, '_id' | 'name' | 'iconColor'>>>([]);
  const [colorLoading, setColorLoading] = useState(false);
  const [colorError, setColorError] = useToastFeedback<string>('', "error");
  const colorRequestId = useRef(0);
  const statusRequest = useRef(new Set<string>());
  const [statusBusy, setStatusBusy] = useState<string[]>([]);

  const load = async (overridePage = page): Promise<void> => {
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
        categoryServiceApi.listAllServices(),
        categoryServiceApi.listServices({ page: 1, limit: 100, isActive: 'true' }),
      ]);
      if (overridePage > Math.max(1, categoryResult.pagination.totalPages)) {
        await load(Math.max(1, categoryResult.pagination.totalPages));
        return;
      }
      setCategories(categoryResult.items);
      setTotal(categoryResult.pagination.total);
      setTotalPages(categoryResult.pagination.totalPages);
      setPage(overridePage);
      setServiceCounts(countServicesByCategory(serviceResult));
      setServicesByCategory(
        serviceResult.reduce<Record<string, Service[]>>((groups, service) => {
          const categoryId = typeof service.categoryId === 'string' ? service.categoryId : service.categoryId?._id ?? '';
          if (categoryId) groups[categoryId] = [...(groups[categoryId] || []), service];
          return groups;
        }, {}),
      );
      setServiceStats({
        active: activeServiceResult.pagination.total,
        total: serviceResult.length,
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

  const loadIconColors = async (excludeId?: string) => {
    const requestId = ++colorRequestId.current;
    setColorLoading(true);
    setColorError('');
    try {
      const colors = await categoryServiceApi.listCategoryIconColors();
      if (requestId !== colorRequestId.current) return;
      setCategoryIconColors(colors);
      const usedColors = colors
        .filter((category) => category._id !== excludeId && isCategoryIconColor(category.iconColor))
        .map((category) => category.iconColor!);
      setForm((current) => isCategoryIconColor(current.iconColor) ? current : {
        ...current, iconColor: getAvailableCategoryIconColor(usedColors),
      });
    } catch (err) {
      if (requestId === colorRequestId.current) {
        setColorError(getErrorMessage(err, 'Không thể tải các màu đã dùng.'));
      }
    } finally {
      if (requestId === colorRequestId.current) setColorLoading(false);
    }
  };

  const openCreate = () => {
    setFormError('');
    setForm(emptyCategoryForm);
    setEditing(null);
    setModal('create');
    void loadIconColors();
  };

  const openEdit = (category: Category) => {
    setFormError('');
    setEditing(category);
    setForm({
      name: category.name,
      slug: category.slug,
      icon: resolveCategoryIcon(category.icon, category.name).id,
      iconColor: isCategoryIconColor(category.iconColor) ? category.iconColor : '',
      description: category.description || '',
      isActive: category.isActive,
    });
    setModal('edit');
    void loadIconColors(category._id);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setFormError('');
    if (colorLoading || colorError) {
      setFormError('Cần tải danh sách màu đã dùng trước khi lưu.');
      return;
    }
    if (!isCategoryIconColor(form.iconColor)) {
      setFormError('Vui lòng chọn màu biểu tượng.');
      return;
    }
    if (categoryIconColors.some((category) =>
      category._id !== editing?._id && category.iconColor?.toLowerCase() === form.iconColor.toLowerCase(),
    )) {
      setFormError('Mã màu này đã được dùng cho danh mục khác. Vui lòng chọn màu khác.');
      return;
    }
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
      setFormError(getErrorMessage(err, 'Không thể lưu danh mục.'));
      if ((err as { response?: { status?: number } })?.response?.status === 409) {
        void loadIconColors(editing?._id);
      }
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (item: Category | Service, kind: 'category' | 'service') => {
    const requestKey = `${kind}:${item._id}`;
    if (statusRequest.current.has(requestKey)) return;
    statusRequest.current.add(requestKey);
    setStatusBusy([...statusRequest.current]);
    try {
      if (kind === 'category') {
        const updated = await categoryServiceApi.updateCategory(item._id, { isActive: !item.isActive });
        setCategories(current => current.map(category => category._id === updated._id ? updated : category));
        setServicesByCategory(current => ({
          ...current,
          [updated._id]: (current[updated._id] ?? []).map(service => ({
            ...service,
            categoryId: typeof service.categoryId === 'object' && service.categoryId
              ? { ...service.categoryId, isActive: updated.isActive }
              : service.categoryId,
          })),
        }));
        const leavesFilter = statusFilter && String(updated.isActive) !== statusFilter;
        const nextTotal = Math.max(0, total - (leavesFilter ? 1 : 0));
        const nextPage = Math.min(page, Math.max(1, Math.ceil(nextTotal / LIMIT)));
        if (leavesFilter) {
          setCategories(current => current.filter(category => category._id !== updated._id));
          setTotal(nextTotal);
          setTotalPages(Math.ceil(nextTotal / LIMIT));
          setPage(nextPage);
        }
        try {
          const result = await categoryServiceApi.listCategories({
            page: nextPage, limit: LIMIT, search: search.trim() || undefined, isActive: statusFilter || undefined,
          });
          setCategories(result.items);
          setTotal(result.pagination.total);
          setTotalPages(result.pagination.totalPages);
        } catch (err) {
          addToast(getErrorMessage(err, 'Đã đổi trạng thái nhưng chưa thể cập nhật thứ tự danh sách.'), 'error');
        }
      } else {
        const updated = await categoryServiceApi.updateService(item._id, { isActive: !item.isActive });
        setServicesByCategory(current => Object.fromEntries(Object.entries(current).map(([categoryId, services]) => [
          categoryId,
          services.map(service => service._id === updated._id
            ? { ...service, ...updated, categoryId: service.categoryId }
            : service),
        ])));
        setServiceStats(current => ({ ...current, active: current.active + Number(updated.isActive) - Number(item.isActive) }));
      }
      addToast(item.isActive ? 'Đã ngừng hoạt động.' : 'Đã bật hoạt động.', 'success');
    } catch (err) {
      addToast(getErrorMessage(err, 'Không thể cập nhật trạng thái.'), 'error');
    } finally {
      statusRequest.current.delete(requestKey);
      setStatusBusy([...statusRequest.current]);
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
    formError,
    colorLoading,
    colorError,
    unavailableIconColors: Object.fromEntries(categoryIconColors
      .filter((category) => category._id !== editing?._id && isCategoryIconColor(category.iconColor))
      .map((category) => [category.iconColor!.toLowerCase(), category.name])),
    reloadIconColors: () => void loadIconColors(editing?._id),
    setForm,
    statusBusy,
    toggleStatus,
    reload: load,
    changePage,
    openCreate,
    openEdit,
    save,
  };
}
