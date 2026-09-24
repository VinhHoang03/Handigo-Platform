import { useEffect, useState, type FormEvent } from 'react';
import { getErrorMessage } from '@/utils/apiError';
import { categoryServiceApi } from '../../api/categoryService.api';
import type { Category } from '../../types/categoryService.types';
import {
  countServicesByCategory,
  emptyCategoryForm,
  toCategoryPayload,
  type CategoryFormState,
} from './category.helpers';

const LIMIT = 10;

/**
 * Toàn bộ state + hành động của trang danh mục (tải danh sách, phân trang,
 * modal thêm/sửa, xóa). Tách khỏi `AdminCategoriesPage` để trang chính chỉ
 * còn lo bố cục.
 */
export function useAdminCategoriesController() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [serviceCounts, setServiceCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
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
      const [categoryResult, serviceResult] = await Promise.all([
        categoryServiceApi.listCategories({
          page: overridePage,
          limit: LIMIT,
          search: search.trim() || undefined,
          isActive: statusFilter || undefined,
        }),
        categoryServiceApi.listServices({ page: 1, limit: 200 }),
      ]);
      setCategories(categoryResult.items);
      setTotal(categoryResult.pagination.total);
      setTotalPages(categoryResult.pagination.totalPages);
      setPage(overridePage);
      setServiceCounts(countServicesByCategory(serviceResult.items));
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

  const changePage = (nextPage: number) => {
    setPage(nextPage);
    void load(nextPage);
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
    setBusy(true);
    setNotice('');
    try {
      await categoryServiceApi.deleteCategory(deleteTarget._id);
      setDeleteTarget(null);
      setNotice('Đã xóa danh mục.');
      void load();
    } catch (err) {
      setError(getErrorMessage(err, 'Có lỗi xảy ra.'));
    } finally {
      setBusy(false);
    }
  };

  return {
    LIMIT,
    categories,
    serviceCounts,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
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
