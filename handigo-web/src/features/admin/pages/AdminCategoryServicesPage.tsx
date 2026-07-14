import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CategoryIcon } from '@/components/common/CategoryIcon';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DashboardShell } from '@/components/common/DashboardShell';
import { Modal } from '@/components/common/Modal';
import { StatusBadge } from '@/components/common/StatusBadge';
import { categoryServiceApi } from '../api/categoryService.api';
import type { Category, CategoryDetail, CategoryPayload, Service, ServicePayload } from '../types/categoryService.types';

type CategoryFormState = { name: string; slug: string; icon: string; description: string; isActive: boolean };
type ServiceFormState = {
  name: string;
  slug: string;
  image: string;
  description: string;
  serviceType: 'fixed_price' | 'variable_price';
  fixedPrice: string;
  depositAmount: string;
  isActive: boolean;
};

const emptyCategoryForm: CategoryFormState = { name: '', slug: '', icon: '', description: '', isActive: true };
const emptyServiceForm: ServiceFormState = {
  name: '',
  slug: '',
  image: '',
  description: '',
  serviceType: 'fixed_price',
  fixedPrice: '',
  depositAmount: '',
  isActive: true,
};

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

const getErrorMessage = (error: unknown) => {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error ? error.message : 'Có lỗi xảy ra, vui lòng thử lại.';
};

const isImageUrl = (value: string | null | undefined) => /^https?:\/\//i.test(value || '');
const getServiceCategoryId = (service: Service) => {
  if (!service.categoryId) return '';
  return typeof service.categoryId === 'string' ? service.categoryId : service.categoryId._id;
};

const categoryPayload = (form: CategoryFormState): CategoryPayload => ({
  name: form.name.trim(),
  slug: form.slug.trim() || undefined,
  icon: form.icon.trim() || undefined,
  description: form.description.trim() || undefined,
  isActive: form.isActive,
});

const servicePayload = (form: ServiceFormState, categoryId: string): ServicePayload => ({
  categoryId,
  name: form.name.trim(),
  slug: form.slug.trim() || undefined,
  image: form.image.trim() || undefined,
  description: form.description.trim() || undefined,
  serviceType: form.serviceType,
  fixedPrice: form.fixedPrice ? Number(form.fixedPrice) : null,
  depositAmount: form.depositAmount ? Number(form.depositAmount) : null,
  isActive: form.isActive,
});

export default function AdminCategoryServicesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [selected, setSelected] = useState<CategoryDetail | null>(null);
  const [serviceCounts, setServiceCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [serviceStatus, setServiceStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [categoryModal, setCategoryModal] = useState<'create' | 'edit' | null>(null);
  const [serviceModal, setServiceModal] = useState<'create' | 'edit' | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(emptyCategoryForm);
  const [serviceForm, setServiceForm] = useState<ServiceFormState>(emptyServiceForm);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'category' | 'service'; id: string; name: string } | null>(null);

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
      setServiceCounts(serviceResult.items.reduce<Record<string, number>>((acc, service) => {
        const categoryId = getServiceCategoryId(service);
        if (!categoryId) return acc;
        acc[categoryId] = (acc[categoryId] || 0) + 1;
        return acc;
      }, {}));
      const nextId = preferredId || selectedId || categoryResult.items[0]?._id || '';
      setSelectedId(categoryResult.items.some((item) => item._id === nextId) ? nextId : categoryResult.items[0]?._id || '');
    } catch (err) {
      setError(getErrorMessage(err));
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
      setServiceCounts((counts) => ({
        ...counts,
        [id]: detail.services.length,
      }));
    } catch (err) {
      setSelected(null);
      setError(getErrorMessage(err));
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
      const payload = categoryPayload(categoryForm);
      const saved = categoryModal === 'edit' && selected
        ? await categoryServiceApi.updateCategory(selected._id, payload)
        : await categoryServiceApi.createCategory(payload);
      setCategoryModal(null);
      setNotice(categoryModal === 'edit' ? 'Đã cập nhật danh mục.' : 'Đã thêm danh mục.');
      await loadCategories(saved._id);
      await loadDetail(saved._id);
    } catch (err) {
      setError(getErrorMessage(err));
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
      const payload = servicePayload(serviceForm, selected._id);
      if (serviceModal === 'edit' && editingService) await categoryServiceApi.updateService(editingService._id, payload);
      else await categoryServiceApi.createService(payload);
      setServiceModal(null);
      setEditingService(null);
      setNotice(serviceModal === 'edit' ? 'Đã cập nhật dịch vụ.' : 'Đã thêm dịch vụ.');
      await loadCategories(selected._id);
      await loadDetail(selected._id);
    } catch (err) {
      setError(getErrorMessage(err));
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
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardShell role="ADMIN">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-headline-lg font-bold text-on-background">Quản lý danh mục và dịch vụ</h1>
            <p className="text-on-surface-variant">Tạo danh mục, quản lý các dịch vụ thuộc từng danh mục và trạng thái hiển thị.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative min-w-72">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-primary/30" placeholder="Tìm danh mục..." />
            </label>
            <button onClick={openCreateCategory} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary shadow-sm">
              <span className="material-symbols-outlined text-[20px]">add</span>
              Thêm danh mục
            </button>
          </div>
        </div>

        {(notice || error) && <div className={`rounded-xl px-4 py-3 ${error ? 'bg-error/10 text-error' : 'bg-emerald-100 text-emerald-700'}`}>{error || notice}</div>}

        <div className="grid min-h-[640px] gap-6 xl:grid-cols-[380px_1fr]">
          <section className="flex min-h-0 flex-col gap-4">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-headline-md font-bold">Danh mục dịch vụ</h2>
                <p className="text-sm text-on-surface-variant">{categories.length} danh mục</p>
              </div>
              <button onClick={() => void loadCategories()} className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-low" aria-label="Tải lại">
                <span className="material-symbols-outlined">refresh</span>
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {loading && <div className="rounded-xl bg-surface-container-low p-6 text-center text-on-surface-variant">Đang tải danh mục...</div>}
              {!loading && categories.length === 0 && <div className="rounded-xl border border-dashed border-outline-variant p-6 text-center text-on-surface-variant">Chưa có danh mục phù hợp.</div>}
              {!loading && categories.map((category) => {
                const active = category._id === selectedId;
                return (
                  <button key={category._id} onClick={() => setSelectedId(category._id)} className={`group flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all ${active ? 'border-primary bg-primary/5 shadow-md' : 'border-outline-variant/30 bg-surface-container-lowest hover:border-primary/50'}`}>
                    <span className="flex min-w-0 items-center gap-4">
                      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-primary/10 text-primary' : 'bg-surface-variant text-on-surface-variant'}`}>
                        <CategoryIcon icon={category.icon} name={category.name} className="h-7 w-7" />
                      </span>
                      <span className="min-w-0">
                        <span className={`block truncate font-semibold ${active ? 'text-primary' : ''}`}>{category.name}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                          <span>{serviceCounts[category._id] || 0} dịch vụ</span>
                          <span className="h-1 w-1 rounded-full bg-outline-variant" />
                          <StatusBadge value={category.isActive ? 'active' : 'hidden'} />
                        </span>
                      </span>
                    </span>
                    <span className="material-symbols-outlined text-[20px] text-primary opacity-0 transition-opacity group-hover:opacity-100">chevron_right</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="min-w-0 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm">
            {detailLoading && <div className="rounded-xl bg-surface-container-low p-8 text-center text-on-surface-variant">Đang tải chi tiết...</div>}
            {!detailLoading && !selected && <div className="rounded-xl border border-dashed border-outline-variant p-8 text-center text-on-surface-variant">Chọn một danh mục để quản lý dịch vụ.</div>}
            {!detailLoading && selected && (
              <div className="space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex gap-4">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <CategoryIcon icon={selected.icon} name={selected.name} className="h-11 w-11" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-headline-md font-bold">{selected.name}</h2>
                        <StatusBadge value={selected.isActive ? 'active' : 'hidden'} />
                      </div>
                      <p className="mt-2 max-w-2xl text-on-surface-variant">{selected.description || 'Chưa có mô tả cho danh mục này.'}</p>
                      <p className="mt-2 text-sm text-on-surface-variant">/{selected.slug}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => openEditCategory(selected)} className="inline-flex items-center gap-2 rounded-lg border border-outline-variant px-4 py-2 font-semibold text-on-surface-variant hover:bg-surface-container-low"><span className="material-symbols-outlined text-[20px]">edit</span>Sửa</button>
                    <button onClick={openCreateService} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary"><span className="material-symbols-outlined text-[20px]">add</span>Thêm dịch vụ</button>
                    <button onClick={() => setDeleteTarget({ type: 'category', id: selected._id, name: selected.name })} className="rounded-lg p-2 text-error hover:bg-error/10" aria-label="Xóa danh mục"><span className="material-symbols-outlined">delete</span></button>
                  </div>
                </div>

                <div className="grid gap-4 border-y border-outline-variant/10 py-4 sm:grid-cols-3">
                  <Stat label="Tổng dịch vụ" value={selected.services.length} />
                  <Stat label="Đang hoạt động" value={selected.services.filter((service) => service.isActive).length} />
                  <Stat label="Giá cố định" value={selected.services.filter((service) => service.serviceType === 'fixed_price').length} />
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-headline-md font-bold">Dịch vụ thuộc danh mục</h3>
                    <select value={serviceStatus} onChange={(event) => setServiceStatus(event.target.value)} className="rounded-lg border border-outline-variant bg-surface px-3 py-2">
                      <option value="">Tất cả trạng thái</option>
                      <option value="true">Hoạt động</option>
                      <option value="false">Đang ẩn</option>
                    </select>
                  </div>
                  <ServiceTable services={visibleServices} onEdit={openEditService} onDelete={(service) => setDeleteTarget({ type: 'service', id: service._id, name: service.name })} />
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <CategoryModal open={Boolean(categoryModal)} mode={categoryModal || 'create'} form={categoryForm} busy={busy} onChange={setCategoryForm} onClose={() => setCategoryModal(null)} onSubmit={saveCategory} />
      <ServiceModal open={Boolean(serviceModal)} mode={serviceModal || 'create'} form={serviceForm} busy={busy} onChange={setServiceForm} onClose={() => setServiceModal(null)} onSubmit={saveService} />
      <ConfirmDialog open={Boolean(deleteTarget)} title={`Xóa ${deleteTarget?.type === 'service' ? 'dịch vụ' : 'danh mục'}`} message={`Bạn chắc chắn muốn xóa "${deleteTarget?.name || ''}"? Danh mục chỉ xóa được khi không còn dịch vụ.`} busy={busy} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
    </DashboardShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="sm:border-l sm:border-outline-variant/10 sm:pl-4 first:border-l-0 first:pl-0"><p className="text-sm text-on-surface-variant">{label}</p><p className="text-headline-md font-bold">{value}</p></div>;
}

function ServiceTable({ services, onEdit, onDelete }: { services: Service[]; onEdit: (service: Service) => void; onDelete: (service: Service) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left">
        <thead className="border-b border-outline-variant/20 text-sm uppercase tracking-wide text-on-surface-variant"><tr><th className="pb-4 font-semibold">Tên dịch vụ</th><th className="pb-4 font-semibold">Loại giá</th><th className="pb-4 font-semibold">Giá</th><th className="pb-4 font-semibold">Đặt cọc</th><th className="pb-4 font-semibold">Trạng thái</th><th className="pb-4 text-right" /></tr></thead>
        <tbody className="divide-y divide-outline-variant/10">
          {services.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-on-surface-variant">Chưa có dịch vụ phù hợp.</td></tr>}
          {services.map((service) => (
            <tr key={service._id} className="hover:bg-surface-container-low">
              <td className="py-4"><div className="flex items-center gap-3"><div className="h-10 w-10 overflow-hidden rounded-lg bg-surface-variant">{service.image ? <img alt={service.name} src={service.image} className="h-full w-full object-cover" /> : <span className="material-symbols-outlined flex h-full w-full items-center justify-center text-on-surface-variant">home_repair_service</span>}</div><div><p className="font-semibold">{service.name}</p><p className="text-sm text-on-surface-variant">/{service.slug}</p></div></div></td>
              <td className="py-4">{service.serviceType === 'fixed_price' ? 'Giá cố định' : 'Giá linh hoạt'}</td>
              <td className="py-4 font-medium">{service.fixedPrice == null ? 'Theo báo giá' : money.format(service.fixedPrice)}</td>
              <td className="py-4">{service.depositAmount == null ? '-' : money.format(service.depositAmount)}</td>
              <td className="py-4"><StatusBadge value={service.isActive ? 'active' : 'hidden'} /></td>
              <td className="py-4 text-right"><div className="flex justify-end gap-1"><button onClick={() => onEdit(service)} className="rounded-lg p-2 text-primary hover:bg-primary/10" aria-label="Sửa dịch vụ"><span className="material-symbols-outlined text-[20px]">edit</span></button><button onClick={() => onDelete(service)} className="rounded-lg p-2 text-error hover:bg-error/10" aria-label="Xóa dịch vụ"><span className="material-symbols-outlined text-[20px]">delete</span></button></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssetInput({
  label,
  value,
  name,
  onChange,
  placeholder,
  mode,
}: {
  label: string;
  value: string;
  name?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mode: 'icon' | 'image';
}) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setMessage('');
    try {
      const uploaded = await categoryServiceApi.uploadImage(file);
      onChange(uploaded.url);
      setMessage('Đã tải ảnh lên.');
    } catch (err) {
      setMessage(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-xl border border-outline-variant bg-surface p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{label}</span>
        <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary ${uploading ? 'pointer-events-none opacity-60' : ''}`}>
          <span className="material-symbols-outlined text-[18px]">upload</span>
          {uploading ? 'Đang tải...' : 'Chọn ảnh'}
          <input type="file" accept="image/*" className="sr-only" onChange={(event) => void upload(event.target.files?.[0])} />
        </label>
      </div>
      <div className="flex gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-container-low text-primary">
          {mode === 'icon'
            ? <CategoryIcon icon={value} name={name} className="h-8 w-8" imageClassName="h-9 w-9 object-contain" />
            : value && isImageUrl(value)
              ? <img src={value} alt="Service" className="h-full w-full object-cover" />
              : <span className="material-symbols-outlined text-3xl">image</span>}
        </div>
        <div className="min-w-0 flex-1">
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-2 outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className={`text-xs ${message.includes('lỗi') || message.includes('Could') ? 'text-error' : 'text-on-surface-variant'}`}>{message || 'Có thể nhập URL ảnh hoặc chọn file từ máy.'}</p>
            {value && <button type="button" onClick={() => onChange('')} className="text-xs font-semibold text-error">Xóa</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryModal({ open, mode, form, busy, onChange, onClose, onSubmit }: { open: boolean; mode: 'create' | 'edit'; form: CategoryFormState; busy: boolean; onChange: (form: CategoryFormState) => void; onClose: () => void; onSubmit: (event: FormEvent) => void }) {
  return <Modal open={open} title={mode === 'edit' ? 'Sửa danh mục' : 'Thêm danh mục'} onClose={onClose}><form onSubmit={onSubmit} className="space-y-4"><FormInput label="Tên danh mục" required value={form.name} onChange={(value) => onChange({ ...form, name: value })} /><FormInput label="Slug" value={form.slug} onChange={(value) => onChange({ ...form, slug: value })} placeholder="Tự sinh nếu bỏ trống" /><AssetInput label="Icon danh mục" value={form.icon} name={form.name} onChange={(value) => onChange({ ...form, icon: value })} placeholder="electrical, cleaning, plumbing hoặc https://..." mode="icon" /><FormTextArea label="Mô tả" value={form.description} onChange={(value) => onChange({ ...form, description: value })} /><ToggleRow checked={form.isActive} onChange={(value) => onChange({ ...form, isActive: value })} label="Hiển thị danh mục" /><FormActions busy={busy} onCancel={onClose} /></form></Modal>;
}

function ServiceModal({ open, mode, form, busy, onChange, onClose, onSubmit }: { open: boolean; mode: 'create' | 'edit'; form: ServiceFormState; busy: boolean; onChange: (form: ServiceFormState) => void; onClose: () => void; onSubmit: (event: FormEvent) => void }) {
  return <Modal open={open} title={mode === 'edit' ? 'Sửa dịch vụ' : 'Thêm dịch vụ'} onClose={onClose}><form onSubmit={onSubmit} className="space-y-4"><FormInput label="Tên dịch vụ" required value={form.name} onChange={(value) => onChange({ ...form, name: value })} /><FormInput label="Slug" value={form.slug} onChange={(value) => onChange({ ...form, slug: value })} placeholder="Tự sinh nếu bỏ trống" /><AssetInput label="Ảnh dịch vụ" value={form.image} onChange={(value) => onChange({ ...form, image: value })} placeholder="https://..." mode="image" /><label className="block"><span className="mb-1 block text-sm font-semibold">Loại giá</span><select value={form.serviceType} onChange={(event) => onChange({ ...form, serviceType: event.target.value as ServiceFormState['serviceType'] })} className="w-full rounded-xl border border-outline-variant bg-surface p-3"><option value="fixed_price">Giá cố định</option><option value="variable_price">Giá linh hoạt</option></select></label><div className="grid gap-3 sm:grid-cols-2"><FormInput label="Giá cố định" type="number" required={form.serviceType === 'fixed_price'} value={form.fixedPrice} onChange={(value) => onChange({ ...form, fixedPrice: value })} /><FormInput label="Tiền đặt cọc" type="number" value={form.depositAmount} onChange={(value) => onChange({ ...form, depositAmount: value })} /></div><FormTextArea label="Mô tả" value={form.description} onChange={(value) => onChange({ ...form, description: value })} /><ToggleRow checked={form.isActive} onChange={(value) => onChange({ ...form, isActive: value })} label="Hiển thị dịch vụ" /><FormActions busy={busy} onCancel={onClose} /></form></Modal>;
}

function FormInput({ label, value, onChange, placeholder, type = 'text', required }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; required?: boolean }) {
  return <label className="block"><span className="mb-1 block text-sm font-semibold">{label}</span><input type={type} required={required} min={type === 'number' ? 0 : undefined} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30" /></label>;
}

function FormTextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-1 block text-sm font-semibold">{label}</span><textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30" /></label>;
}

function ToggleRow({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <label className="flex items-center justify-between rounded-xl bg-surface-container-low p-3"><span className="font-semibold">{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-primary" /></label>;
}

function FormActions({ busy, onCancel }: { busy: boolean; onCancel: () => void }) {
  return <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={onCancel} disabled={busy} className="rounded-xl bg-surface-container-high px-5 py-2.5">Hủy</button><button type="submit" disabled={busy} className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-on-primary disabled:opacity-50">{busy ? 'Đang lưu...' : 'Lưu'}</button></div>;
}
