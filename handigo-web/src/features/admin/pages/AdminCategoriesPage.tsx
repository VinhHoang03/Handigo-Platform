import { useEffect, useState, type FormEvent } from 'react';
import { CategoryIcon } from '@/components/common/CategoryIcon';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DashboardShell } from '@/components/common/DashboardShell';
import { Modal } from '@/components/common/Modal';
import { categoryServiceApi } from '../api/categoryService.api';
import type { Category, CategoryPayload } from '../types/categoryService.types';

// ─── helpers ────────────────────────────────────────────────────────────────

const money = new Intl.NumberFormat('vi-VN');

const fmt = (d: string) =>
  new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

const getError = (err: unknown) => {
  if (typeof err === 'object' && err && 'response' in err) {
    const r = (err as { response?: { data?: { message?: string } } }).response;
    if (r?.data?.message) return r.data.message;
  }
  return err instanceof Error ? err.message : 'Có lỗi xảy ra.';
};

// ─── form state ─────────────────────────────────────────────────────────────

type FormState = { name: string; slug: string; icon: string; description: string; isActive: boolean };
const emptyForm: FormState = { name: '', slug: '', icon: '', description: '', isActive: true };

const toPayload = (f: FormState): CategoryPayload => ({
  name: f.name.trim(),
  slug: f.slug.trim() || undefined,
  icon: f.icon.trim() || undefined,
  description: f.description.trim() || undefined,
  isActive: f.isActive,
});

// ─── sub-components ─────────────────────────────────────────────────────────

function FormInput({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <input
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30"
      />
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
      <button type="button" onClick={onCancel} disabled={busy} className="rounded-xl bg-surface-container-high px-5 py-2.5">Hủy</button>
      <button type="submit" disabled={busy} className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-on-primary disabled:opacity-50">
        {busy ? 'Đang lưu...' : 'Lưu'}
      </button>
    </div>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [serviceCounts, setServiceCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 10;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  // ── stats ──
  const activeCount = categories.filter((c) => c.isActive).length;
  const totalServices = Object.values(serviceCounts).reduce((a, b) => a + b, 0);

  const load = async (overridePage = page) => {
    setLoading(true);
    setError('');
    try {
      const [catResult, svcResult] = await Promise.all([
        categoryServiceApi.listCategories({
          page: overridePage,
          limit: LIMIT,
          search: search.trim() || undefined,
          isActive: statusFilter || undefined,
        }),
        categoryServiceApi.listServices({ page: 1, limit: 200 }),
      ]);
      setCategories(catResult.items);
      setTotal(catResult.pagination.total);
      setTotalPages(catResult.pagination.totalPages);
      setPage(overridePage);
      const counts = svcResult.items.reduce<Record<string, number>>((acc, s) => {
        const cid = typeof s.categoryId === 'string' ? s.categoryId : s.categoryId?._id ?? '';
        if (cid) acc[cid] = (acc[cid] || 0) + 1;
        return acc;
      }, {});
      setServiceCounts(counts);
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = window.setTimeout(() => void load(1), 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  const changePage = (p: number) => {
    setPage(p);
    void load(p);
  };

  const openCreate = () => {
    setForm(emptyForm);
    setEditing(null);
    setModal('create');
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setForm({ name: cat.name, slug: cat.slug, icon: cat.icon || '', description: cat.description || '', isActive: cat.isActive });
    setModal('edit');
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      if (modal === 'edit' && editing) {
        await categoryServiceApi.updateCategory(editing._id, toPayload(form));
        setNotice('Đã cập nhật danh mục.');
      } else {
        await categoryServiceApi.createCategory(toPayload(form));
        setNotice('Đã thêm danh mục.');
      }
      setModal(null);
      void load();
    } catch (err) {
      setError(getError(err));
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
      setError(getError(err));
    } finally {
      setBusy(false);
    }
  };

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const shown = pages.filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1);

  return (
    <DashboardShell role="ADMIN">
      <div className="space-y-6">

        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">Quản lý danh mục dịch vụ</h1>
            <p className="mt-1 text-on-surface-variant">Quản lý các danh mục dịch vụ trên nền tảng Handigo.</p>
          </div>
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-container px-6 py-3 font-bold text-on-primary-container shadow-md hover:opacity-90 active:scale-95 transition-all">
            <span className="material-symbols-outlined">add</span>
            Thêm danh mục
          </button>
        </header>

        {/* Notice / Error */}
        {(notice || error) && (
          <div className={`rounded-xl px-4 py-3 ${error ? 'bg-error/10 text-error' : 'bg-emerald-100 text-emerald-700'}`}>
            {error || notice}
          </div>
        )}

        {/* Stats row */}
        <div className="grid gap-gutter sm:grid-cols-3">
          <StatCard icon="construction" label="Tổng dịch vụ hoạt động" value={money.format(totalServices)} trend="+12% so với tháng trước" trendUp />
          <StatCard icon="notifications_active" label="Danh mục đang hoạt động" value={String(activeCount)} />
          <StatCard icon="category" label="Tổng danh mục" value={String(total)} />
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-outline-variant/30 bg-surface-glass p-gutter shadow-sm backdrop-blur-md">
          <div className="relative flex-1 min-w-60">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm danh mục..."
              className="w-full rounded-xl border-none bg-surface-container-low py-3 pl-12 pr-4 focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="relative">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none rounded-xl border-none bg-surface-container-low py-3 pl-4 pr-10 text-label-md font-medium text-on-surface-variant focus:ring-2 focus:ring-primary/50">
              <option value="">Tất cả trạng thái</option>
              <option value="true">Hoạt động</option>
              <option value="false">Tạm ngưng</option>
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant">expand_more</span>
          </div>
          <button onClick={() => void load()} className="rounded-xl p-3 text-on-surface-variant hover:bg-surface-container-high transition-colors" aria-label="Tải lại">
            <span className="material-symbols-outlined">refresh</span>
          </button>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-lowest shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-container-low/50 text-left">
                  {['Danh mục', 'Mô tả', 'Số dịch vụ', 'Trạng thái', 'Ngày tạo', ''].map((h) => (
                    <th key={h} className="px-6 py-4 text-label-md font-bold uppercase tracking-wider text-on-surface-variant">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {loading && (
                  <tr><td colSpan={6} className="px-6 py-10 text-center text-on-surface-variant">Đang tải danh mục...</td></tr>
                )}
                {!loading && categories.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-10 text-center text-on-surface-variant">Chưa có danh mục phù hợp.</td></tr>
                )}
                {!loading && categories.map((cat) => (
                  <tr key={cat._id} className="group transition-colors hover:bg-surface-container-low/30">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-fixed-dim/30 text-primary">
                          <CategoryIcon icon={cat.icon} name={cat.name} className="h-7 w-7" />
                        </div>
                        <span className="font-bold text-on-surface">{cat.name}</span>
                      </div>
                    </td>
                    <td className="max-w-xs truncate px-6 py-5 text-on-surface-variant">{cat.description || '—'}</td>
                    <td className="px-6 py-5">
                      <span className="rounded-full bg-surface-container-high px-3 py-1 text-label-md font-medium text-on-surface-variant">
                        {serviceCounts[cat._id] || 0} dịch vụ
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      {cat.isActive ? (
                        <div className="flex items-center gap-2 text-label-md font-bold text-success-green">
                          <span className="h-2 w-2 rounded-full bg-success-green" /> Hoạt động
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-label-md font-bold text-error">
                          <span className="h-2 w-2 rounded-full bg-error" /> Tạm ngưng
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-5 text-on-surface-variant">{fmt(cat.createdAt)}</td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-60 transition-opacity group-hover:opacity-100">
                        <button onClick={() => openEdit(cat)}
                          className="rounded-lg p-2 transition-colors hover:bg-primary-container/10 hover:text-primary" aria-label="Sửa">
                          <span className="material-symbols-outlined">edit</span>
                        </button>
                        <button onClick={() => setDeleteTarget(cat)}
                          className="rounded-lg p-2 transition-colors hover:bg-error-container/20 hover:text-error" aria-label="Xóa">
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-outline-variant/10 bg-surface-container-low/20 px-6 py-4">
            <span className="text-label-md text-on-surface-variant">
              Hiển thị {categories.length} / {total} danh mục
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => changePage(page - 1)} disabled={page === 1}
                  className="rounded-lg p-2 hover:bg-surface-container-high disabled:opacity-30">
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                {shown.map((p, i) => {
                  const prev = shown[i - 1];
                  return (
                    <>
                      {prev && p - prev > 1 && <span key={`gap-${p}`} className="px-2">...</span>}
                      <button key={p} onClick={() => changePage(p)}
                        className={`flex h-10 w-10 items-center justify-center rounded-lg font-medium ${p === page ? 'bg-primary text-on-primary font-bold shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
                        {p}
                      </button>
                    </>
                  );
                })}
                <button onClick={() => changePage(page + 1)} disabled={page === totalPages}
                  className="rounded-lg p-2 hover:bg-surface-container-high disabled:opacity-30">
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Category Modal */}
      <Modal open={Boolean(modal)} title={modal === 'edit' ? 'Sửa danh mục' : 'Thêm danh mục'} onClose={() => setModal(null)}>
        <form onSubmit={save} className="space-y-4">
          <FormInput label="Tên danh mục" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <FormInput label="Slug" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} placeholder="Tự sinh nếu bỏ trống" />
          <div>
            <span className="mb-1 block text-sm font-semibold">Mã icon danh mục hoặc URL ảnh</span>
            <div className="flex gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CategoryIcon icon={form.icon} name={form.name} className="h-7 w-7" />
              </div>
              <input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })}
                placeholder="electrical, cleaning, plumbing hoặc https://..."
                className="flex-1 rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <FormTextArea label="Mô tả" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
          <ToggleRow checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label="Hiển thị danh mục" />
          <FormActions busy={busy} onCancel={() => setModal(null)} />
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa danh mục"
        message={`Bạn chắc chắn muốn xóa danh mục "${deleteTarget?.name}"? Hành động này không thể khôi phục.`}
        busy={busy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </DashboardShell>
  );
}

// ─── stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, trend, trendUp }: { icon: string; label: string; value: string; trend?: string; trendUp?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/10 bg-primary-container/5 p-6">
      <div className="relative z-10">
        <p className="font-label-md uppercase tracking-wide text-on-surface-variant">{label}</p>
        <p className="mt-2 font-headline-md text-headline-md font-bold">{value}</p>
        {trend && (
          <div className={`mt-4 flex items-center gap-2 text-label-sm ${trendUp ? 'text-success-green' : 'text-on-surface-variant'}`}>
            {trendUp && <span className="material-symbols-outlined text-[18px]">trending_up</span>}
            <span>{trend}</span>
          </div>
        )}
      </div>
      <div className="absolute -bottom-4 -right-4 opacity-5">
        <span className="material-symbols-outlined text-[120px]"
          style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
      </div>
    </div>
  );
}
