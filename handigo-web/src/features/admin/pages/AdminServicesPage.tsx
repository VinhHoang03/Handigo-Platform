import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DashboardShell } from '@/components/common/DashboardShell';
import { Modal } from '@/components/common/Modal';
import { categoryServiceApi } from '../api/categoryService.api';
import type {
  Category,
  Service,
  ServiceOption,
  ServiceOptionPayload,
  ServiceOptionSelectionMode,
  ServiceOptionType,
  ServicePayload,
} from '../types/categoryService.types';

// ─── helpers ────────────────────────────────────────────────────────────────

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

const getError = (err: unknown) => {
  if (typeof err === 'object' && err && 'response' in err) {
    const r = (err as { response?: { data?: { message?: string } } }).response;
    if (r?.data?.message) return r.data.message;
  }
  return err instanceof Error ? err.message : 'Có lỗi xảy ra.';
};

const isImageUrl = (v: string | null | undefined) => /^https?:\/\//i.test(v ?? '');

const getCategoryId = (s: Service) =>
  typeof s.categoryId === 'string' ? s.categoryId : s.categoryId?._id ?? '';

const OPTION_TYPE_LABELS: Record<ServiceOptionType, string> = {
  room_count:  'Theo số phòng',
  area_size:   'Theo diện tích',
  package:     'Gói dịch vụ',
  add_on:      'Dịch vụ thêm',
  other:       'Khác',
};

// ─── form types ──────────────────────────────────────────────────────────────

type ServiceForm = {
  categoryId: string; name: string; slug: string; image: string; description: string;
  serviceType: 'fixed_price' | 'variable_price';
  fixedPrice: string;
  depositAmount: string;
  requiresOptionSelection: boolean;
  isActive: boolean;
};

const emptyServiceForm: ServiceForm = {
  categoryId: '', name: '', slug: '', image: '', description: '',
  serviceType: 'fixed_price', fixedPrice: '', depositAmount: '',
  requiresOptionSelection: false, isActive: true,
};
type OptionForm = {
  name: string;
  description: string;
  image: string;
  optionType: ServiceOptionType;
  price: string;
  selectionGroup: string;
  selectionMode: ServiceOptionSelectionMode;
  allowsQuantity: boolean;
  sortOrder: string;
  isActive: boolean;
};

const emptyOptionForm: OptionForm = {
  name: '', description: '', image: '', optionType: 'other', price: '', selectionGroup: '',
  selectionMode: 'multiple', allowsQuantity: false, sortOrder: '0', isActive: true,
};

const toOptionPayload = (
  f: OptionForm,
  serviceType: Service['serviceType'],
): ServiceOptionPayload => ({
  name: f.name.trim(),
  description: f.description.trim() || undefined,
  image: f.image.trim() || undefined,
  optionType: f.optionType,
  price: serviceType === 'variable_price' ? 0 : Number(f.price) || 0,
  selectionGroup: f.selectionGroup.trim() || null,
  selectionMode: f.selectionMode,
  allowsQuantity: f.allowsQuantity,
  sortOrder: Number(f.sortOrder) || 0,
  isActive: f.isActive,
});

const toServicePayload = (f: ServiceForm): ServicePayload => ({
  categoryId: f.categoryId,
  name: f.name.trim(),
  slug: f.slug.trim() || undefined,
  image: f.image.trim() || undefined,
  description: f.description.trim() || undefined,
  serviceType: f.serviceType,
  fixedPrice: null,
  depositAmount: f.serviceType === 'variable_price' ? Number(f.depositAmount) : null,
  requiresOptionSelection: f.serviceType === 'fixed_price' ? true : f.requiresOptionSelection,
  isActive: f.isActive,
});

// ─── shared form components ──────────────────────────────────────────────────

function FormInput({ label, name, value, onChange, placeholder, type = 'text', required }: {
  label: string; name: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <input type={type} name={name} autoComplete="off" required={required} min={type === 'number' ? 0 : undefined}
        inputMode={type === 'number' ? 'decimal' : undefined}
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-xl border border-outline-variant bg-surface p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" />
    </label>
  );
}

function FormTextArea({ label, name, value, onChange }: { label: string; name: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <textarea name={name} autoComplete="off" rows={3} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-outline-variant bg-surface p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" />
    </label>
  );
}

function ToggleRow({ checked, onChange, label, name }: { checked: boolean; onChange: (v: boolean) => void; label: string; name: string }) {
  return (
    <label className="flex items-center justify-between rounded-xl bg-surface-container-low p-3">
      <span className="font-semibold">{label}</span>
      <input type="checkbox" name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" />
    </label>
  );
}

function FormActions({ busy, onCancel }: { busy: boolean; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <button type="button" onClick={onCancel} disabled={busy}
        className="min-h-11 rounded-xl bg-surface-container-high px-5 py-2.5 transition-colors hover:bg-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">Hủy</button>
      <button type="submit" disabled={busy}
        className="min-h-11 rounded-xl bg-primary px-5 py-2.5 font-semibold text-on-primary transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50">
        {busy ? 'Đang lưu…' : 'Lưu'}
      </button>
    </div>
  );
}

// ─── image upload input ───────────────────────────────────────────────────────

function ImageInput({ value, onChange, label = 'Ảnh dịch vụ', inputName = 'service-image' }: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  inputName?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true); setMsg('');
    try {
      const uploaded = await categoryServiceApi.uploadImage(file);
      onChange(uploaded.url);
      setMsg('Đã tải ảnh lên.');
    } catch (err) { setMsg(getError(err)); }
    finally { setUploading(false); }
  };

  return (
    <div className="rounded-xl border border-outline-variant bg-surface p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold">{label}</span>
        <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary transition-colors hover:bg-primary/90 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${uploading ? 'pointer-events-none opacity-60' : ''}`}>
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">upload</span>
          {uploading ? 'Đang tải…' : 'Chọn ảnh'}
          <input type="file" name={`${inputName}-file`} accept="image/*" className="sr-only" onChange={(e) => void upload(e.target.files?.[0])} />
        </label>
      </div>
      <div className="flex gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-container-low">
          {value && isImageUrl(value)
            ? <img src={value} alt={`Xem trước ${label.toLowerCase()}`} width={64} height={64} className="h-full w-full object-cover" />
            : <span className="material-symbols-outlined text-3xl text-on-surface-variant" aria-hidden="true">image</span>}
        </div>
        <div className="min-w-0 flex-1">
          <input type="url" name={`${inputName}-url`} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://example.com/anh-dich-vu…"
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" />
          <p aria-live="polite" className={`mt-1 text-xs ${msg.includes('lỗi') ? 'text-error' : 'text-on-surface-variant'}`}>
            {msg || 'Nhập URL hoặc chọn file từ máy.'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function AdminServicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // list state
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [options, setOptions] = useState<ServiceOption[]>([]);

  const search = searchParams.get('search') || '';
  const categoryFilter = searchParams.get('category') || '';
  const statusFilter = searchParams.get('status') || '';
  const selectedServiceId = searchParams.get('serviceId') || '';

  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [optionFormError, setOptionFormError] = useState('');

  // modals
  const [serviceModal, setServiceModal] = useState<'create' | 'edit' | null>(null);
  const [optionModal, setOptionModal] = useState<'create' | 'edit' | null>(null);
  const [serviceForm, setServiceForm] = useState<ServiceForm>(emptyServiceForm);
  const [optionForm, setOptionForm] = useState<OptionForm>(emptyOptionForm);
  const [initialServiceForm, setInitialServiceForm] = useState<ServiceForm>(emptyServiceForm);
  const [initialOptionForm, setInitialOptionForm] = useState<OptionForm>(emptyOptionForm);
  const [editingOption, setEditingOption] = useState<ServiceOption | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'service' | 'option'; id: string; name: string } | null>(null);
  const [discardTarget, setDiscardTarget] = useState<'service' | 'option' | null>(null);

  const visibleServices = useMemo(() => {
    return services.filter((s) => {
      const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase());
      const matchCat = !categoryFilter || getCategoryId(s) === categoryFilter;
      const matchStatus = !statusFilter || String(s.isActive) === statusFilter;
      return matchSearch && matchCat && matchStatus;
    });
  }, [services, search, categoryFilter, statusFilter]);

  const selectedService = useMemo(
    () => visibleServices.find((service) => service._id === selectedServiceId) || visibleServices[0] || null,
    [selectedServiceId, visibleServices],
  );

  const updateSearchParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => {
    updateSearchParams({ search: null, category: null, status: null, serviceId: null });
  };

  // ── data loading ────────────────────────────────────────────────────────────

  const loadAll = async () => {
    setLoading(true); setError('');
    try {
      const [catResult, svcResult] = await Promise.all([
        categoryServiceApi.listCategories({ page: 1, limit: 200 }),
        categoryServiceApi.listServices({ page: 1, limit: 200 }),
      ]);
      setCategories(catResult.items);
      setServices(svcResult.items);
    } catch (err) { setError(getError(err)); }
    finally { setLoading(false); }
  };

  const loadOptions = async (serviceId: string) => {
    setOptionsLoading(true);
    try {
      const opts = await categoryServiceApi.listServiceOptions(serviceId);
      setOptions(opts);
    } catch { setOptions([]); }
    finally { setOptionsLoading(false); }
  };

  useEffect(() => {
    const t = window.setTimeout(() => void loadAll(), 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (selectedService) void loadOptions(selectedService._id);
      else setOptions([]);
    }, 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedService?._id]);

  // ── service actions ─────────────────────────────────────────────────────────

  const openCreateService = () => {
    const nextForm = { ...emptyServiceForm, categoryId: categoryFilter };
    setServiceForm(nextForm);
    setInitialServiceForm(nextForm);
    setServiceModal('create');
  };

  const openEditService = (s: Service) => {
    const nextForm = {
      categoryId: getCategoryId(s),
      name: s.name, slug: s.slug, image: s.image || '',
      description: s.description || '', serviceType: s.serviceType,
      fixedPrice: s.fixedPrice == null ? '' : String(s.fixedPrice),
      depositAmount: s.depositAmount == null ? '' : String(s.depositAmount),
      requiresOptionSelection: s.requiresOptionSelection ?? false,
      isActive: s.isActive,
    };
    setServiceForm(nextForm);
    setInitialServiceForm(nextForm);
    setServiceModal('edit');
  };

  const requestCloseServiceModal = () => {
    if (busy) return;
    if (JSON.stringify(serviceForm) !== JSON.stringify(initialServiceForm)) {
      setDiscardTarget('service');
      return;
    }
    setServiceModal(null);
  };

  const saveService = async (e: FormEvent) => {
    e.preventDefault();
    if (!serviceForm.categoryId) {
      setError('Vui lòng chọn danh mục trước khi thêm dịch vụ.'); return;
    }
    setBusy(true); setNotice('');
    try {
      const payload = toServicePayload(serviceForm);
      const saved = serviceModal === 'edit' && selectedService
        ? await categoryServiceApi.updateService(selectedService._id, payload)
        : await categoryServiceApi.createService(payload);
      setServiceModal(null);
      setNotice(serviceModal === 'edit' ? 'Đã cập nhật dịch vụ.' : 'Đã thêm dịch vụ.');
      await loadAll();
      updateSearchParams(serviceModal === 'edit'
        ? { serviceId: saved._id }
        : { search: null, category: null, status: null, serviceId: saved._id });
    } catch (err) { setError(getError(err)); }
    finally { setBusy(false); }
  };

  // ── option actions ──────────────────────────────────────────────────────────

  const openCreateOption = () => {
    setOptionForm(emptyOptionForm);
    setInitialOptionForm(emptyOptionForm);
    setEditingOption(null);
    setOptionFormError('');
    setOptionModal('create');
  };

  const openEditOption = (opt: ServiceOption) => {
    setEditingOption(opt);
    const nextForm = {
      name: opt.name,
      description: opt.description || '',
      image: opt.image || '',
      optionType: opt.optionType,
      price: String(opt.price),
      selectionGroup: opt.selectionGroup || '',
      selectionMode: opt.selectionMode ?? 'multiple',
      allowsQuantity: opt.allowsQuantity ?? false,
      sortOrder: String(opt.sortOrder ?? 0),
      isActive: opt.isActive,
    };
    setOptionForm(nextForm);
    setInitialOptionForm(nextForm);
    setOptionFormError('');
    setOptionModal('edit');
  };

  const requestCloseOptionModal = () => {
    if (busy) return;
    if (JSON.stringify(optionForm) !== JSON.stringify(initialOptionForm)) {
      setDiscardTarget('option');
      return;
    }
    setOptionModal(null);
  };

  const confirmDiscard = () => {
    if (discardTarget === 'service') setServiceModal(null);
    if (discardTarget === 'option') setOptionModal(null);
    setDiscardTarget(null);
  };

  const saveOption = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;
    const normalizedGroup = optionForm.selectionGroup.trim().toLocaleLowerCase('vi-VN');
    const normalizedOriginalGroup = editingOption?.selectionGroup
      ?.trim()
      .toLocaleLowerCase('vi-VN') ?? '';
    const staysInCurrentGroup = optionModal === 'edit'
      && normalizedGroup === normalizedOriginalGroup;
    const sibling = normalizedGroup
      ? options.find((option) =>
          option._id !== editingOption?._id &&
          option.selectionGroup?.trim().toLocaleLowerCase('vi-VN') === normalizedGroup)
      : undefined;
    if (
      !staysInCurrentGroup
      && sibling
      && (sibling.selectionMode ?? 'multiple') !== optionForm.selectionMode
    ) {
      const expectedMode = sibling.selectionMode === 'single' ? 'Chỉ chọn một' : 'Được chọn nhiều';
      setOptionFormError(
        `Nhóm “${optionForm.selectionGroup.trim()}” đang dùng cách lựa chọn “${expectedMode}”. Các tùy chọn trong cùng nhóm phải có cùng cách lựa chọn.`,
      );
      return;
    }

    setOptionFormError('');
    setBusy(true); setNotice('');
    try {
      if (optionModal === 'edit' && editingOption) {
        await categoryServiceApi.updateServiceOption(
          editingOption._id,
          toOptionPayload(optionForm, selectedService.serviceType),
        );
        setNotice('Đã cập nhật tùy chọn.');
      } else {
        await categoryServiceApi.createServiceOption(
          selectedService._id,
          toOptionPayload(optionForm, selectedService.serviceType),
        );
        setNotice('Đã thêm tùy chọn.');
      }
      setOptionModal(null);
      setOptionFormError('');
      await loadOptions(selectedService._id);
    } catch (err) { setOptionFormError(getError(err)); }
    finally { setBusy(false); }
  };

  // ── delete ──────────────────────────────────────────────────────────────────

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true); setNotice('');
    try {
      if (deleteTarget.kind === 'service') {
        await categoryServiceApi.deleteService(deleteTarget.id);
        setDeleteTarget(null);
        setNotice('Đã xóa dịch vụ.');
        updateSearchParams({ serviceId: null });
        await loadAll();
      } else {
        await categoryServiceApi.deleteServiceOption(deleteTarget.id);
        setDeleteTarget(null);
        setNotice('Đã xóa tùy chọn.');
        if (selectedService) await loadOptions(selectedService._id);
      }
    } catch (err) { setError(getError(err)); }
    finally { setBusy(false); }
  };

  // ── render ──────────────────────────────────────────────────────────────────

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category._id, category.name])),
    [categories],
  );
  const selectedCategoryName = selectedService
    ? categoryNames.get(getCategoryId(selectedService)) || ''
    : '';
  const activeServiceCount = services.filter((service) => service.isActive).length;
  const hasFilters = Boolean(search || categoryFilter || statusFilter);

  const getPriceLabel = (service: Service) => {
    if (service.serviceType === 'variable_price') return 'Giá linh hoạt';
    return 'Theo tùy chọn';
  };

  return (
    <DashboardShell role="ADMIN">
      <div className="space-y-5">

        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-primary">Danh mục vận hành</p>
            <h1 className="text-wrap-balance font-headline-lg text-headline-lg font-bold text-on-surface">Quản lý dịch vụ</h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              {services.length} dịch vụ · {activeServiceCount} hoạt động · {services.length - activeServiceCount} tạm ngưng
            </p>
          </div>
          <button type="button" onClick={openCreateService}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-bold text-on-primary shadow-sm transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:translate-y-0">
            <span className="material-symbols-outlined" aria-hidden="true">add</span>
            Thêm dịch vụ mới
          </button>
        </header>

        {/* Notice / Error */}
        {(notice || error) && (
          <div
            role={error ? 'alert' : 'status'}
            aria-live="polite"
            className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 ${error ? 'border-error/20 bg-error/10 text-error' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}
          >
            <span>{error || notice}</span>
            <button
              type="button"
              onClick={() => { setError(''); setNotice(''); }}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
              aria-label="Đóng thông báo"
            >
              <span className="material-symbols-outlined text-lg" aria-hidden="true">close</span>
            </button>
          </div>
        )}

        {/* Filter bar */}
        <div className="flex flex-col gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm lg:flex-row lg:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Tìm kiếm dịch vụ</span>
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" aria-hidden="true">search</span>
            <input
              type="search"
              name="service-search"
              autoComplete="off"
              value={search}
              onChange={(event) => updateSearchParams({ search: event.target.value || null, serviceId: null })}
              placeholder="Tìm kiếm dịch vụ…"
              className="min-h-11 w-full rounded-lg border border-transparent bg-surface-container-low py-2.5 pl-10 pr-4 text-label-md focus-visible:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </label>
          <label className="min-w-44">
            <span className="sr-only">Lọc theo danh mục</span>
            <select value={categoryFilter} onChange={(event) => updateSearchParams({ category: event.target.value || null, serviceId: null })}
              name="service-category-filter"
              className="min-h-11 w-full rounded-lg border border-transparent bg-surface-container-low px-4 py-2.5 text-label-md focus-visible:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20">
              <option value="">Tất cả danh mục</option>
              {categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
            </select>
          </label>
          <label className="min-w-40">
            <span className="sr-only">Lọc theo trạng thái</span>
            <select value={statusFilter} onChange={(event) => updateSearchParams({ status: event.target.value || null, serviceId: null })}
              name="service-status-filter"
              className="min-h-11 w-full rounded-lg border border-transparent bg-surface-container-low px-4 py-2.5 text-label-md focus-visible:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20">
              <option value="">Tất cả trạng thái</option>
              <option value="true">Hoạt động</option>
              <option value="false">Tạm ngưng</option>
            </select>
          </label>
          {hasFilters && (
            <button type="button" onClick={clearFilters}
              className="min-h-11 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
              Xóa bộ lọc
            </button>
          )}
          <button type="button" onClick={() => void loadAll()}
            className="flex h-11 min-w-11 items-center justify-center rounded-lg bg-surface-container-low text-on-surface-variant transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" aria-label="Tải lại danh sách">
            <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm text-on-surface-variant">
          <span>Hiển thị <strong className="font-semibold text-on-surface">{visibleServices.length}</strong>/{services.length} dịch vụ</span>
          {selectedService && <span className="hidden truncate sm:block">Đang xem: <strong className="font-semibold text-on-surface">{selectedService.name}</strong></span>}
        </div>

        {/* Master-Detail */}
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(300px,340px)_minmax(0,1fr)] xl:items-start">

          {/* LEFT: service list */}
          <section aria-labelledby="service-list-title" className="min-w-0 overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm xl:sticky xl:top-4">
            <div className="flex items-center justify-between border-b border-outline-variant/20 px-4 py-3">
              <h2 id="service-list-title" className="font-bold text-on-surface">Danh sách dịch vụ</h2>
              <span className="rounded-full bg-surface-container-high px-2.5 py-1 text-xs font-semibold text-on-surface-variant">{visibleServices.length}</span>
            </div>
            <div className="max-h-[440px] space-y-2 overflow-y-auto p-3 [overscroll-behavior:contain] xl:max-h-[calc(100dvh-280px)]">
            {loading && <div className="rounded-lg bg-surface-container-low p-6 text-center text-on-surface-variant">Đang tải…</div>}
            {!loading && visibleServices.length === 0 && (
              <div className="rounded-lg border border-dashed border-outline-variant p-6 text-center">
                <span className="material-symbols-outlined text-3xl text-on-surface-variant" aria-hidden="true">search_off</span>
                <p className="mt-2 font-semibold text-on-surface">Không tìm thấy dịch vụ</p>
                <p className="mt-1 text-sm text-on-surface-variant">Thử thay đổi từ khóa hoặc xóa bộ lọc hiện tại.</p>
                {hasFilters && <button type="button" onClick={clearFilters} className="mt-3 rounded-lg px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">Xóa bộ lọc</button>}
              </div>
            )}
            {!loading && visibleServices.map((svc) => {
              const active = selectedService?._id === svc._id;
              return (
                <button key={svc._id} type="button" onClick={() => updateSearchParams({ serviceId: svc._id })}
                  aria-pressed={active}
                  className={`w-full touch-manipulation rounded-lg border p-3 text-left [contain-intrinsic-size:auto_90px] [content-visibility:auto] transition-[border-color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${active ? 'border-primary bg-primary/5 shadow-sm' : 'border-transparent bg-surface-container-lowest hover:border-outline-variant/50 hover:bg-surface-container-low'}`}>
                  <div className="flex gap-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-surface-variant">
                      {svc.image && isImageUrl(svc.image)
                        ? <img src={svc.image} alt="" aria-hidden="true" width={64} height={64} loading="lazy" className="h-full w-full object-cover" />
                        : <span className="material-symbols-outlined flex h-full w-full items-center justify-center text-on-surface-variant" aria-hidden="true">home_repair_service</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-label-md font-bold text-on-surface">{svc.name}</p>
                        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${svc.isActive ? 'bg-success-green' : 'bg-outline'}`}
                          title={svc.isActive ? 'Hoạt động' : 'Tạm ngưng'} aria-label={svc.isActive ? 'Hoạt động' : 'Tạm ngưng'}>
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-label-sm text-on-surface-variant">
                        {categoryNames.get(getCategoryId(svc)) || 'Chưa phân loại'}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-primary">{getPriceLabel(svc)}</span>
                        <span className="text-on-surface-variant">{svc.isActive ? 'Hoạt động' : 'Tạm ngưng'}</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
            </div>
          </section>

          {/* RIGHT: detail + options */}
          <section id="service-detail" aria-labelledby="service-detail-title" className="min-w-0 overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm scroll-mt-4">
            {!selectedService && (
              <div className="flex min-h-80 flex-col items-center justify-center p-8 text-center">
                <span className="material-symbols-outlined text-5xl text-outline" aria-hidden="true">inventory_2</span>
                <h2 id="service-detail-title" className="mt-3 text-lg font-bold text-on-surface">Chưa có dịch vụ được chọn</h2>
                <p className="mt-1 max-w-sm text-sm text-on-surface-variant">Chọn một dịch vụ trong danh sách hoặc thêm dịch vụ mới để quản lý thông tin và tùy chọn.</p>
              </div>
            )}
            {selectedService && (
              <>
                {/* service detail hero */}
                <div className="border-b border-outline-variant/30 p-4 sm:p-6">
                  <div className="flex flex-col gap-5 sm:flex-row">
                    <div className="relative shrink-0">
                      <div className="h-28 w-full overflow-hidden rounded-xl bg-surface-variant sm:w-28">
                        {selectedService.image && isImageUrl(selectedService.image)
                          ? <img src={selectedService.image} alt={selectedService.name} width={112} height={112} className="h-full w-full object-cover" />
                          : <span className="material-symbols-outlined flex h-full w-full items-center justify-center text-5xl text-on-surface-variant" aria-hidden="true">home_repair_service</span>}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 id="service-detail-title" className="text-wrap-balance font-headline-md text-headline-md font-bold text-on-surface">{selectedService.name}</h2>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${selectedService.isActive ? 'bg-success-green/10 text-success-green' : 'bg-on-surface-variant/10 text-on-surface-variant'}`}>
                              {selectedService.isActive ? 'Hoạt động' : 'Tạm ngưng'}
                            </span>
                          </div>
                          <p className="mt-1 text-label-md font-medium text-on-surface-variant">{selectedCategoryName || 'Chưa phân loại'} · {getPriceLabel(selectedService)}</p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <button type="button" onClick={() => openEditService(selectedService)}
                            className="flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-label-md font-bold text-on-primary transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                            <span className="material-symbols-outlined text-base" aria-hidden="true">edit</span>Sửa dịch vụ
                          </button>
                          <button type="button" onClick={() => setDeleteTarget({ kind: 'service', id: selectedService._id, name: selectedService.name })}
                            className="flex min-h-10 items-center gap-2 rounded-lg border border-error/30 px-3 py-2 text-label-md font-bold text-error transition-colors hover:bg-error-container/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40"
                            aria-label={`Xóa dịch vụ ${selectedService.name}`}>
                            <span className="material-symbols-outlined text-base" aria-hidden="true">delete</span>Xóa
                          </button>
                        </div>
                      </div>
                      <p className="mt-4 max-w-3xl break-words leading-relaxed text-on-surface-variant">
                        {selectedService.description || 'Chưa có mô tả.'}
                      </p>
                      <div className="mt-5 grid gap-px overflow-hidden rounded-lg border border-outline-variant/20 bg-outline-variant/20 sm:grid-cols-3">
                        <div className="bg-surface-container-low px-4 py-3">
                          <span className="block text-xs text-on-surface-variant">Tùy chọn</span>
                          <strong className="mt-1 block font-semibold text-on-surface tabular-nums">{options.length}</strong>
                        </div>
                        <div className="bg-surface-container-low px-4 py-3">
                          <span className="block text-xs text-on-surface-variant">Loại giá</span>
                          <strong className="mt-1 block font-semibold text-on-surface">{selectedService.serviceType === 'fixed_price' ? 'Cố định' : 'Linh hoạt'}</strong>
                        </div>
                        <div className="bg-surface-container-low px-4 py-3">
                          <span className="block text-xs text-on-surface-variant">Tiền đặt cọc</span>
                          <strong className="mt-1 block font-semibold text-on-surface tabular-nums">{selectedService.serviceType === 'variable_price' ? money.format(selectedService.depositAmount || 0) : 'Không áp dụng'}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* options table */}
                <div className="p-4 sm:p-6">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-headline-md text-headline-md font-bold text-on-surface">Tùy chọn dịch vụ</h3>
                      <p className="mt-1 text-sm text-on-surface-variant">Thiết lập các gói, đơn vị tính và mức giá khách hàng có thể chọn.</p>
                    </div>
                    <button type="button" onClick={openCreateOption}
                      className="flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-primary/20 px-4 py-2 font-bold text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                      <span className="material-symbols-outlined" aria-hidden="true">add_circle</span>
                      Thêm tùy chọn
                    </button>
                  </div>
                  {optionsLoading && <div className="py-8 text-center text-on-surface-variant" role="status">Đang tải tùy chọn…</div>}
                  {!optionsLoading && (
                    <div className="overflow-x-auto [overscroll-behavior-x:contain]">
                      <table className="w-full border-separate border-spacing-y-2 text-left">
                        <caption className="sr-only">Danh sách tùy chọn của dịch vụ {selectedService.name}</caption>
                        <thead>
                          <tr className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                            <th scope="col" className="min-w-48 px-4 py-2">Tên tùy chọn</th>
                            <th scope="col" className="min-w-32 px-4 py-2">Loại</th>
                            <th scope="col" className="min-w-32 px-4 py-2 text-right">Giá</th>
                            <th scope="col" className="min-w-32 px-4 py-2">Trạng thái</th>
                            <th scope="col" className="w-24 px-4 py-2 text-right">Hành động</th>
                          </tr>
                        </thead>
                        <tbody className="text-label-md">
                          {options.length === 0 && (
                            <tr><td colSpan={5} className="rounded-xl border border-dashed border-outline-variant px-4 py-10 text-center">
                              <span className="material-symbols-outlined text-3xl text-outline" aria-hidden="true">playlist_add</span>
                              <p className="mt-2 font-semibold text-on-surface">Chưa có tùy chọn nào</p>
                              <p className="mt-1 text-sm text-on-surface-variant">Tạo tùy chọn đầu tiên để cấu hình gói và mức giá cho dịch vụ.</p>
                              <button type="button" onClick={openCreateOption} className="mt-3 rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">Thêm tùy chọn đầu tiên</button>
                            </td></tr>
                          )}
                          {options.map((opt) => (
                            <tr key={opt._id} className={`rounded-lg transition-colors hover:bg-surface-container-low ${!opt.isActive ? 'text-on-surface-variant' : ''}`}>
                              <td className="max-w-72 rounded-l-lg border-y border-l border-outline-variant/30 px-4 py-4">
                                <div className="flex items-start gap-3">
                                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-container-low">
                                    {opt.image && isImageUrl(opt.image)
                                      ? <img src={opt.image} alt="" aria-hidden="true" width={48} height={48} loading="lazy" className="h-full w-full object-cover" />
                                      : <span className="material-symbols-outlined flex h-full w-full items-center justify-center text-on-surface-variant" aria-hidden="true">image</span>}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="break-words font-bold text-on-surface">{opt.name}</p>
                                    {opt.description && <p className="mt-1 line-clamp-2 text-xs text-on-surface-variant">{opt.description}</p>}
                                  </div>
                                </div>
                              </td>
                              <td className="border-y border-outline-variant/30 px-4 py-4 text-on-surface-variant">
                                <p>{OPTION_TYPE_LABELS[opt.optionType]}</p>
                                {opt.selectionGroup && (
                                  <p className="mt-1 text-xs">
                                    {opt.selectionGroup} · {opt.selectionMode === 'single' ? 'chọn một' : 'chọn nhiều'}
                                  </p>
                                )}
                                {opt.allowsQuantity && (
                                  <p className="mt-1 text-xs text-primary">Có chọn số lượng</p>
                                )}
                              </td>
                              <td className="border-y border-outline-variant/30 px-4 py-4 text-right font-bold text-primary tabular-nums">
                                {selectedService.serviceType === 'variable_price'
                                  ? <span className="text-on-surface-variant">Không áp dụng</span>
                                  : money.format(opt.price)}
                              </td>
                              <td className="border-y border-outline-variant/30 px-4 py-4">
                                {opt.isActive
                                  ? <span className="rounded-full bg-success-green/10 px-2.5 py-1 text-[12px] font-bold text-success-green">Hoạt động</span>
                                  : <span className="rounded-full bg-on-surface-variant/10 px-2.5 py-1 text-[12px] font-bold text-on-surface-variant">Tạm ngưng</span>}
                              </td>
                              <td className="rounded-r-lg border-y border-r border-outline-variant/30 px-4 py-4 text-right">
                                <div className="flex justify-end gap-1">
                                  <button type="button" onClick={() => openEditOption(opt)}
                                    className="grid h-9 w-9 place-items-center rounded-lg text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" aria-label={`Sửa tùy chọn ${opt.name}`}>
                                    <span className="material-symbols-outlined text-base" aria-hidden="true">edit</span>
                                  </button>
                                  <button type="button" onClick={() => setDeleteTarget({ kind: 'option', id: opt._id, name: opt.name })}
                                    className="grid h-9 w-9 place-items-center rounded-lg text-error transition-colors hover:bg-error/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/30" aria-label={`Xóa tùy chọn ${opt.name}`}>
                                    <span className="material-symbols-outlined text-base" aria-hidden="true">delete</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {/* Service Modal */}
      <Modal open={Boolean(serviceModal)} title={serviceModal === 'edit' ? 'Sửa dịch vụ' : 'Thêm dịch vụ mới'} onClose={requestCloseServiceModal} closeOnEsc={!busy && !discardTarget} closeOnOverlayClick={!busy && !discardTarget} size="lg">
        <form onSubmit={saveService} className="space-y-5">
          <fieldset className="rounded-xl border border-outline-variant/40 p-4">
            <legend className="px-2 text-sm font-bold text-primary">Thông tin cơ bản</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Danh mục <span className="text-error">*</span></span>
                <select required disabled={serviceModal === 'edit'} name="service-category" value={serviceForm.categoryId} onChange={(e) => setServiceForm({ ...serviceForm, categoryId: e.target.value })}
                  className="w-full rounded-xl border border-outline-variant bg-surface p-3 disabled:cursor-not-allowed disabled:bg-surface-container-low disabled:text-on-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                  <option value="">Chọn danh mục…</option>
                  {categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
                </select>
              </label>
              <FormInput label="Tên dịch vụ" name="service-name" required value={serviceForm.name} onChange={(value) => setServiceForm({ ...serviceForm, name: value })} />
              <div className="sm:col-span-2">
                <FormInput label="Slug" name="service-slug" value={serviceForm.slug} onChange={(value) => setServiceForm({ ...serviceForm, slug: value })} placeholder="Tự sinh nếu bỏ trống…" />
              </div>
            </div>
          </fieldset>

          <fieldset className="rounded-xl border border-outline-variant/40 p-4">
            <legend className="px-2 text-sm font-bold text-primary">Giá và vận hành</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Loại giá</span>
                <select name="service-price-type" value={serviceForm.serviceType} onChange={(e) => setServiceForm({ ...serviceForm, serviceType: e.target.value as ServiceForm['serviceType'] })}
                  className="w-full rounded-xl border border-outline-variant bg-surface p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                  <option value="fixed_price">Giá cố định</option>
                  <option value="variable_price">Giá linh hoạt</option>
                </select>
              </label>
              {serviceForm.serviceType === 'fixed_price' && (
                <p className="rounded-lg bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
                  Giá dịch vụ được tính từ các tùy chọn bên dưới, không sử dụng giá cơ bản.
                </p>
              )}
              {serviceForm.serviceType === 'variable_price' && (
                <FormInput
                  label="Tiền đặt cọc (VNĐ)"
                  name="service-deposit-amount"
                  type="number"
                  required
                  value={serviceForm.depositAmount}
                  onChange={(value) => setServiceForm({ ...serviceForm, depositAmount: value })}
                />
              )}
              {serviceForm.serviceType === 'variable_price' && (
                <p className="rounded-lg bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant sm:col-span-2">
                  Khoản cọc này được hiển thị trong phần tóm tắt đơn hàng và thu khi khách đặt dịch vụ giá linh hoạt.
                </p>
              )}
            </div>
          </fieldset>

          <fieldset className="space-y-4 rounded-xl border border-outline-variant/40 p-4">
            <legend className="px-2 text-sm font-bold text-primary">Nội dung hiển thị</legend>
            <ImageInput value={serviceForm.image} onChange={(value) => setServiceForm({ ...serviceForm, image: value })} />
            <FormTextArea label="Mô tả" name="service-description" value={serviceForm.description} onChange={(value) => setServiceForm({ ...serviceForm, description: value })} />
          </fieldset>

          <ToggleRow checked={serviceForm.isActive} onChange={(value) => setServiceForm({ ...serviceForm, isActive: value })} label="Hiển thị dịch vụ" name="service-active" />
          {serviceForm.serviceType === 'variable_price' && (
            <ToggleRow
              checked={serviceForm.requiresOptionSelection}
              onChange={(value) => setServiceForm({ ...serviceForm, requiresOptionSelection: value })}
              label="Bắt buộc chọn ít nhất một tùy chọn"
              name="service-requires-option"
            />
          )}
          <FormActions busy={busy} onCancel={requestCloseServiceModal} />
        </form>
      </Modal>

      {/* Option Modal */}
      <Modal open={Boolean(optionModal)} title={optionModal === 'edit' ? 'Sửa tùy chọn' : 'Thêm tùy chọn dịch vụ'} onClose={requestCloseOptionModal} closeOnEsc={!busy && !discardTarget} closeOnOverlayClick={!busy && !discardTarget}>
        <form onSubmit={saveOption} className="space-y-4">
          {optionFormError && (
            <div role="alert" className="rounded-xl bg-error/10 px-4 py-3 text-sm font-medium text-error">
              {optionFormError}
            </div>
          )}
          <FormInput label="Tên tùy chọn" name="option-name" required value={optionForm.name} onChange={(v) => setOptionForm({ ...optionForm, name: v })} />
          <FormTextArea label="Mô tả" name="option-description" value={optionForm.description} onChange={(v) => setOptionForm({ ...optionForm, description: v })} />
          <ImageInput
            value={optionForm.image}
            onChange={(value) => setOptionForm({ ...optionForm, image: value })}
            label="Ảnh tùy chọn"
            inputName="option-image"
          />
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Loại tùy chọn</span>
            <select name="option-type" value={optionForm.optionType} onChange={(e) => setOptionForm({ ...optionForm, optionType: e.target.value as ServiceOptionType })}
              className="w-full rounded-xl border border-outline-variant bg-surface p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
              {Object.entries(OPTION_TYPE_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormInput
              label="Nhóm lựa chọn"
              name="option-selection-group"
              value={optionForm.selectionGroup}
              onChange={(v) => {
                setOptionForm({ ...optionForm, selectionGroup: v });
                setOptionFormError('');
              }}
              placeholder="Ví dụ: Quy mô căn hộ"
              required={optionForm.selectionMode === 'single'}
            />
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Cách lựa chọn</span>
              <select
                name="option-selection-mode"
                value={optionForm.selectionMode}
                onChange={(e) => {
                  setOptionForm({ ...optionForm, selectionMode: e.target.value as ServiceOptionSelectionMode });
                  setOptionFormError('');
                }}
                className="w-full rounded-xl border border-outline-variant bg-surface p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <option value="multiple">Được chọn nhiều</option>
                <option value="single">Chỉ chọn một</option>
              </select>
            </label>
          </div>
          <FormInput label="Thứ tự hiển thị" name="option-sort-order" type="number" value={optionForm.sortOrder} onChange={(v) => setOptionForm({ ...optionForm, sortOrder: v })} />
          {selectedService?.serviceType === 'fixed_price' ? (
            <FormInput label="Giá (VNĐ)" name="option-price" type="number" required value={optionForm.price} onChange={(v) => setOptionForm({ ...optionForm, price: v })} />
          ) : (
            <p className="rounded-lg bg-surface-container-low px-3 py-2 text-sm text-on-surface-variant">
              Dịch vụ giá linh hoạt không áp dụng giá riêng cho tùy chọn.
            </p>
          )}
          <ToggleRow
            checked={optionForm.allowsQuantity}
            onChange={(v) => setOptionForm({ ...optionForm, allowsQuantity: v })}
            label="Cho phép khách chọn số lượng"
            name="option-allows-quantity"
          />
          <ToggleRow checked={optionForm.isActive} onChange={(v) => setOptionForm({ ...optionForm, isActive: v })} label="Hiển thị tùy chọn" name="option-active" />
          <FormActions busy={busy} onCancel={requestCloseOptionModal} />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(discardTarget)}
        title="Bỏ thay đổi chưa lưu?"
        message="Các nội dung bạn vừa nhập sẽ không được lưu. Bạn có chắc chắn muốn đóng biểu mẫu?"
        variant="danger"
        onCancel={() => setDiscardTarget(null)}
        onConfirm={confirmDiscard}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Xóa ${deleteTarget?.kind === 'service' ? 'dịch vụ' : 'tùy chọn'}`}
        message={`Bạn chắc chắn muốn xóa "${deleteTarget?.name || ''}"?`}
        busy={busy}
        variant="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </DashboardShell>
  );
}
