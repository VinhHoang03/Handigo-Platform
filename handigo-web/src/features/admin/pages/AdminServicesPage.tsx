import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DashboardShell } from '@/components/common/DashboardShell';
import { Modal } from '@/components/common/Modal';
import { categoryServiceApi } from '../api/categoryService.api';
import type {
  Category,
  Service,
  ServiceOption,
  ServiceOptionPayload,
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
  name: string; slug: string; image: string; description: string;
  serviceType: 'fixed_price' | 'variable_price';
  depositAmount: string;
  isActive: boolean;
};

const emptyServiceForm: ServiceForm = {
  name: '', slug: '', image: '', description: '',
  serviceType: 'fixed_price', depositAmount: '', isActive: true,
};
type OptionForm = {
  name: string;
  optionType: ServiceOptionType;
  price: string;
  isActive: boolean;
};

const emptyOptionForm: OptionForm = {
  name: '', optionType: 'other', price: '', isActive: true,
};

const toOptionPayload = (f: OptionForm): ServiceOptionPayload => ({
  name: f.name.trim(),
  optionType: f.optionType,
  price: Number(f.price) || 0,
  isActive: f.isActive,
});

const toServicePayload = (f: ServiceForm, categoryId: string): ServicePayload => ({
  categoryId,
  name: f.name.trim(),
  slug: f.slug.trim() || undefined,
  image: f.image.trim() || undefined,
  description: f.description.trim() || undefined,
  serviceType: f.serviceType,
  depositAmount: f.serviceType === 'variable_price' ? Number(f.depositAmount) : null,
  isActive: f.isActive,
});

// ─── shared form components ──────────────────────────────────────────────────

function FormInput({ label, value, onChange, placeholder, type = 'text', required }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <input type={type} required={required} min={type === 'number' ? 0 : undefined}
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30" />
    </label>
  );
}

function FormTextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30" />
    </label>
  );
}

function ToggleRow({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between rounded-xl bg-surface-container-low p-3">
      <span className="font-semibold">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-primary" />
    </label>
  );
}

function FormActions({ busy, onCancel }: { busy: boolean; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <button type="button" onClick={onCancel} disabled={busy}
        className="rounded-xl bg-surface-container-high px-5 py-2.5">Hủy</button>
      <button type="submit" disabled={busy}
        className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-on-primary disabled:opacity-50">
        {busy ? 'Đang lưu...' : 'Lưu'}
      </button>
    </div>
  );
}

// ─── image upload input ───────────────────────────────────────────────────────

function ImageInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
        <span className="text-sm font-semibold">Ảnh dịch vụ</span>
        <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary ${uploading ? 'pointer-events-none opacity-60' : ''}`}>
          <span className="material-symbols-outlined text-[18px]">upload</span>
          {uploading ? 'Đang tải...' : 'Chọn ảnh'}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => void upload(e.target.files?.[0])} />
        </label>
      </div>
      <div className="flex gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-container-low">
          {value && isImageUrl(value)
            ? <img src={value} alt="preview" className="h-full w-full object-cover" />
            : <span className="material-symbols-outlined text-3xl text-on-surface-variant">image</span>}
        </div>
        <div className="min-w-0 flex-1">
          <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://..."
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-2 outline-none focus:ring-2 focus:ring-primary/30" />
          <p className={`mt-1 text-xs ${msg.includes('lỗi') ? 'text-error' : 'text-on-surface-variant'}`}>
            {msg || 'Nhập URL hoặc chọn file từ máy.'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function AdminServicesPage() {
  // list state
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [options, setOptions] = useState<ServiceOption[]>([]);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // modals
  const [serviceModal, setServiceModal] = useState<'create' | 'edit' | null>(null);
  const [optionModal, setOptionModal] = useState<'create' | 'edit' | null>(null);
  const [serviceForm, setServiceForm] = useState<ServiceForm>(emptyServiceForm);
  const [optionForm, setOptionForm] = useState<OptionForm>(emptyOptionForm);
  const [editingOption, setEditingOption] = useState<ServiceOption | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'service' | 'option'; id: string; name: string } | null>(null);

  const visibleServices = useMemo(() => {
    return services.filter((s) => {
      const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase());
      const matchCat = !categoryFilter || getCategoryId(s) === categoryFilter;
      const matchStatus = !statusFilter || String(s.isActive) === statusFilter;
      return matchSearch && matchCat && matchStatus;
    });
  }, [services, search, categoryFilter, statusFilter]);

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
      if (!selectedService && svcResult.items.length > 0) {
        setSelectedService(svcResult.items[0]);
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setServiceForm(emptyServiceForm);
    setServiceModal('create');
  };

  const openEditService = (s: Service) => {
    setServiceForm({
      name: s.name, slug: s.slug, image: s.image || '',
      description: s.description || '', serviceType: s.serviceType,
      depositAmount: s.depositAmount == null ? '' : String(s.depositAmount),
      isActive: s.isActive,
    });
    setServiceModal('edit');
  };

  const saveService = async (e: FormEvent) => {
    e.preventDefault();
    if (!categoryFilter && serviceModal === 'create') {
      setError('Vui lòng chọn danh mục trước khi thêm dịch vụ.'); return;
    }
    const catId = serviceModal === 'edit' && selectedService
      ? getCategoryId(selectedService)
      : categoryFilter;
    setBusy(true); setNotice('');
    try {
      const payload = toServicePayload(serviceForm, catId);
      const saved = serviceModal === 'edit' && selectedService
        ? await categoryServiceApi.updateService(selectedService._id, payload)
        : await categoryServiceApi.createService(payload);
      setServiceModal(null);
      setNotice(serviceModal === 'edit' ? 'Đã cập nhật dịch vụ.' : 'Đã thêm dịch vụ.');
      await loadAll();
      setSelectedService(saved);
    } catch (err) { setError(getError(err)); }
    finally { setBusy(false); }
  };

  // ── option actions ──────────────────────────────────────────────────────────

  const openCreateOption = () => {
    setOptionForm(emptyOptionForm);
    setEditingOption(null);
    setOptionModal('create');
  };

  const openEditOption = (opt: ServiceOption) => {
    setEditingOption(opt);
    setOptionForm({
      name: opt.name,
      optionType: opt.optionType,
      price: String(opt.price),
      isActive: opt.isActive,
    });
    setOptionModal('edit');
  };

  const saveOption = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;
    setBusy(true); setNotice('');
    try {
      if (optionModal === 'edit' && editingOption) {
        await categoryServiceApi.updateServiceOption(editingOption._id, toOptionPayload(optionForm));
        setNotice('Đã cập nhật tùy chọn.');
      } else {
        await categoryServiceApi.createServiceOption(selectedService._id, toOptionPayload(optionForm));
        setNotice('Đã thêm tùy chọn.');
      }
      setOptionModal(null);
      await loadOptions(selectedService._id);
    } catch (err) { setError(getError(err)); }
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
        setSelectedService(null);
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

  const selectedCategoryName = useMemo(() => {
    if (!selectedService) return '';
    const catId = getCategoryId(selectedService);
    return categories.find((c) => c._id === catId)?.name || '';
  }, [selectedService, categories]);

  return (
    <DashboardShell role="ADMIN">
      <div className="flex h-[calc(100vh-80px)] flex-col gap-4">

        {/* Header */}
        <header className="sticky top-0 z-40 flex items-center justify-between rounded-xl bg-surface-glass/80 px-6 py-3 shadow-sm backdrop-blur-md border border-outline-variant/20">
          <div>
            <h1 className="font-headline-md text-headline-md font-bold text-primary leading-none">Quản lý dịch vụ</h1>
            <p className="mt-0.5 text-label-sm text-on-surface-variant">Quản lý dịch vụ và các tùy chọn trên nền tảng Handigo.</p>
          </div>
          <button onClick={openCreateService}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-container px-6 py-2.5 font-bold text-on-primary-container shadow-sm active:scale-95 transition-transform">
            <span className="material-symbols-outlined">add</span>
            Thêm dịch vụ mới
          </button>
        </header>

        {/* Notice / Error */}
        {(notice || error) && (
          <div className={`rounded-xl px-4 py-3 ${error ? 'bg-error/10 text-error' : 'bg-emerald-100 text-emerald-700'}`}
            onClick={() => { setError(''); setNotice(''); }}>
            {error || notice}
          </div>
        )}

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm">
          <div className="relative flex-1 min-w-52">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50">search</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm dịch vụ..."
              className="w-full rounded-lg border-none bg-surface-container-low py-2.5 pl-10 pr-4 focus:ring-2 focus:ring-primary/20 text-label-md" />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            className="min-w-40 rounded-lg border-none bg-surface-container-low px-4 py-2.5 text-label-md focus:ring-2 focus:ring-primary/20">
            <option value="">Tất cả danh mục</option>
            {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="min-w-36 rounded-lg border-none bg-surface-container-low px-4 py-2.5 text-label-md focus:ring-2 focus:ring-primary/20">
            <option value="">Trạng thái</option>
            <option value="true">Hoạt động</option>
            <option value="false">Tạm ngưng</option>
          </select>
          <button onClick={() => void loadAll()}
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high transition-colors" aria-label="Tải lại">
            <span className="material-symbols-outlined">refresh</span>
          </button>
        </div>

        {/* Master-Detail */}
        <div className="flex min-h-0 flex-1 gap-4">

          {/* LEFT: service list */}
          <section className="flex w-[35%] flex-col gap-3 overflow-y-auto pr-1">
            {loading && <div className="rounded-lg bg-surface-container-low p-6 text-center text-on-surface-variant">Đang tải...</div>}
            {!loading && visibleServices.length === 0 && (
              <div className="rounded-lg border border-dashed border-outline-variant p-6 text-center text-on-surface-variant">Chưa có dịch vụ phù hợp.</div>
            )}
            {!loading && visibleServices.map((svc) => {
              const active = selectedService?._id === svc._id;
              return (
                <button key={svc._id} onClick={() => setSelectedService(svc)}
                  className={`w-full rounded-lg p-3 text-left shadow-sm border transition-all cursor-pointer ${active ? 'border-2 border-primary-container ring-1 ring-primary/10' : 'border-outline-variant/30 bg-surface-container-lowest hover:translate-x-1 hover:bg-surface-container-low'}`}>
                  <div className="flex gap-3">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-surface-variant">
                      {svc.image && isImageUrl(svc.image)
                        ? <img src={svc.image} alt={svc.name} className="h-full w-full object-cover" />
                        : <span className="material-symbols-outlined flex h-full w-full items-center justify-center text-on-surface-variant">home_repair_service</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-1">
                        <p className="truncate text-label-md font-bold text-on-surface">{svc.name}</p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold flex items-center gap-1 ${svc.isActive ? 'bg-success-green/10 text-success-green' : 'bg-on-surface-variant/10 text-on-surface-variant'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${svc.isActive ? 'bg-success-green' : 'bg-on-surface-variant'}`} />
                          {svc.isActive ? 'Hoạt động' : 'Tạm ngưng'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-label-sm text-on-surface-variant">
                        {categories.find((c) => c._id === getCategoryId(svc))?.name || '—'}
                      </p>
                      <p className="mt-2 text-label-md font-bold text-primary">
                        {svc.isActive ? 'Hoạt động' : 'Tạm ngưng'}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </section>

          {/* RIGHT: detail + options */}
          <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container-lowest shadow-sm">
            {!selectedService && (
              <div className="flex flex-1 items-center justify-center p-8 text-on-surface-variant">
                Chọn một dịch vụ để xem chi tiết và quản lý tùy chọn.
              </div>
            )}
            {selectedService && (
              <>
                {/* service detail hero */}
                <div className="border-b border-outline-variant/30 p-6">
                  <div className="flex gap-6">
                    <div className="relative shrink-0">
                      <div className="h-48 w-48 overflow-hidden rounded-lg bg-surface-variant shadow-md">
                        {selectedService.image && isImageUrl(selectedService.image)
                          ? <img src={selectedService.image} alt={selectedService.name} className="h-full w-full object-cover" />
                          : <span className="material-symbols-outlined flex h-full w-full items-center justify-center text-[64px] text-on-surface-variant">home_repair_service</span>}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h2 className="font-headline-md text-headline-md font-bold text-on-surface">{selectedService.name}</h2>
                          <p className="text-label-md font-medium text-on-surface-variant">Danh mục: {selectedCategoryName || '—'}</p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button onClick={() => openEditService(selectedService)}
                            className="flex items-center gap-2 rounded-lg border border-outline-variant/50 px-4 py-2 text-label-md font-bold text-on-surface-variant hover:bg-surface-container transition-colors">
                            <span className="material-symbols-outlined text-base">edit</span>Sửa
                          </button>
                          <button onClick={() => setDeleteTarget({ kind: 'service', id: selectedService._id, name: selectedService.name })}
                            className="flex items-center gap-2 rounded-lg border border-error/30 px-4 py-2 text-label-md font-bold text-error hover:bg-error-container/20 transition-colors">
                            <span className="material-symbols-outlined text-base">delete</span>Xóa
                          </button>
                        </div>
                      </div>
                      <p className="max-w-xl leading-relaxed text-on-surface-variant">
                        {selectedService.description || 'Chưa có mô tả.'}
                      </p>
                      <div className="flex flex-wrap gap-4">
                        {[
                          { label: 'Tùy chọn', value: String(options.length) },
                          { label: 'Loại giá', value: selectedService.serviceType === 'fixed_price' ? 'Cố định' : 'Linh hoạt' },
                          ...(selectedService.serviceType === 'variable_price'
                            ? [{ label: 'Tiền đặt cọc', value: money.format(selectedService.depositAmount || 0) }]
                            : []),
                        ].map(({ label, value }) => (
                          <div key={label} className="flex flex-col rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 py-3">
                            <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">{label}</span>
                            <span className="font-headline-md text-headline-md font-bold text-primary">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* options table */}
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-headline-md text-headline-md font-bold text-on-surface">Tùy chọn dịch vụ</h3>
                    <button onClick={openCreateOption}
                      className="flex items-center gap-2 rounded-lg px-4 py-2 font-bold text-primary hover:bg-primary-container/10 transition-colors active:scale-95">
                      <span className="material-symbols-outlined">add_circle</span>
                      Thêm tùy chọn
                    </button>
                  </div>
                  {optionsLoading && <div className="py-6 text-center text-on-surface-variant">Đang tải tùy chọn...</div>}
                  {!optionsLoading && (
                    <div className="overflow-x-auto">
                      <table className="w-full border-separate border-spacing-y-2 text-left">
                        <thead>
                          <tr className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                            <th className="px-4 py-2">Tên tùy chọn</th>
                            <th className="px-4 py-2">Loại</th>
                            <th className="px-4 py-2">Giá</th>
                            <th className="px-4 py-2">Trạng thái</th>
                            <th className="px-4 py-2 text-right">Hành động</th>
                          </tr>
                        </thead>
                        <tbody className="text-label-md">
                          {options.length === 0 && (
                            <tr><td colSpan={5} className="px-4 py-6 text-center text-on-surface-variant">Chưa có tùy chọn nào.</td></tr>
                          )}
                          {options.map((opt) => (
                            <tr key={opt._id} className={`group rounded-lg transition-colors hover:bg-surface-container-low ${!opt.isActive ? 'opacity-60' : ''}`}>
                              <td className="rounded-l-lg border-y border-l border-outline-variant/30 px-4 py-4 font-bold">{opt.name}</td>
                              <td className="border-y border-outline-variant/30 px-4 py-4 text-on-surface-variant">{OPTION_TYPE_LABELS[opt.optionType]}</td>
                              <td className="border-y border-outline-variant/30 px-4 py-4 font-bold text-primary">{money.format(opt.price)}</td>
                              <td className="border-y border-outline-variant/30 px-4 py-4">
                                {opt.isActive
                                  ? <span className="rounded-full bg-success-green/10 px-2.5 py-1 text-[12px] font-bold text-success-green">Hoạt động</span>
                                  : <span className="rounded-full bg-on-surface-variant/10 px-2.5 py-1 text-[12px] font-bold text-on-surface-variant">Tạm ngưng</span>}
                              </td>
                              <td className="rounded-r-lg border-y border-r border-outline-variant/30 px-4 py-4 text-right">
                                <div className="flex justify-end gap-2 opacity-60 transition-opacity group-hover:opacity-100">
                                  <button onClick={() => openEditOption(opt)}
                                    className="rounded p-1.5 text-primary hover:bg-primary/10 transition-colors" aria-label="Sửa">
                                    <span className="material-symbols-outlined text-sm">edit</span>
                                  </button>
                                  <button onClick={() => setDeleteTarget({ kind: 'option', id: opt._id, name: opt.name })}
                                    className="rounded p-1.5 text-error hover:bg-error/10 transition-colors" aria-label="Xóa">
                                    <span className="material-symbols-outlined text-sm">delete</span>
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
      <Modal open={Boolean(serviceModal)} title={serviceModal === 'edit' ? 'Sửa dịch vụ' : 'Thêm dịch vụ mới'} onClose={() => setServiceModal(null)} size="lg">
        <form onSubmit={saveService} className="space-y-4">
          {serviceModal === 'create' && (
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Danh mục <span className="text-error">*</span></span>
              <select required value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">-- Chọn danh mục --</option>
                {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </label>
          )}
          <FormInput label="Tên dịch vụ" required value={serviceForm.name} onChange={(v) => setServiceForm({ ...serviceForm, name: v })} />
          <FormInput label="Slug" value={serviceForm.slug} onChange={(v) => setServiceForm({ ...serviceForm, slug: v })} placeholder="Tự sinh nếu bỏ trống" />
          <ImageInput value={serviceForm.image} onChange={(v) => setServiceForm({ ...serviceForm, image: v })} />
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Loại giá</span>
            <select value={serviceForm.serviceType} onChange={(e) => setServiceForm({ ...serviceForm, serviceType: e.target.value as ServiceForm['serviceType'] })}
              className="w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30">
              <option value="fixed_price">Giá cố định</option>
              <option value="variable_price">Giá linh hoạt</option>
            </select>
          </label>
          {serviceForm.serviceType === 'variable_price' && (
            <>
              <FormInput
                label="Tiền đặt cọc (VNĐ)"
                type="number"
                required
                value={serviceForm.depositAmount}
                onChange={(v) => setServiceForm({ ...serviceForm, depositAmount: v })}
              />
              <p className="rounded-lg bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
                Khoản cọc này được hiển thị trong phần tóm tắt đơn hàng và thu khi khách đặt dịch vụ giá linh hoạt.
              </p>
            </>
          )}
          <FormTextArea label="Mô tả" value={serviceForm.description} onChange={(v) => setServiceForm({ ...serviceForm, description: v })} />
          <ToggleRow checked={serviceForm.isActive} onChange={(v) => setServiceForm({ ...serviceForm, isActive: v })} label="Hiển thị dịch vụ" />
          <FormActions busy={busy} onCancel={() => setServiceModal(null)} />
        </form>
      </Modal>

      {/* Option Modal */}
      <Modal open={Boolean(optionModal)} title={optionModal === 'edit' ? 'Sửa tùy chọn' : 'Thêm tùy chọn dịch vụ'} onClose={() => setOptionModal(null)}>
        <form onSubmit={saveOption} className="space-y-4">
          <FormInput label="Tên tùy chọn" required value={optionForm.name} onChange={(v) => setOptionForm({ ...optionForm, name: v })} />
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Loại tùy chọn</span>
            <select value={optionForm.optionType} onChange={(e) => setOptionForm({ ...optionForm, optionType: e.target.value as ServiceOptionType })}
              className="w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30">
              {Object.entries(OPTION_TYPE_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </label>
          <FormInput label="Giá (VNĐ)" type="number" required value={optionForm.price} onChange={(v) => setOptionForm({ ...optionForm, price: v })} />
          <ToggleRow checked={optionForm.isActive} onChange={(v) => setOptionForm({ ...optionForm, isActive: v })} label="Hiển thị tùy chọn" />
          <FormActions busy={busy} onCancel={() => setOptionModal(null)} />
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Xóa ${deleteTarget?.kind === 'service' ? 'dịch vụ' : 'tùy chọn'}`}
        message={`Bạn chắc chắn muốn xóa "${deleteTarget?.name || ''}"?`}
        busy={busy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </DashboardShell>
  );
}
