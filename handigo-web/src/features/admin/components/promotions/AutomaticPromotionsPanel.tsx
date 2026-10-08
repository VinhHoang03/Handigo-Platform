import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/common/Modal';
import { AsyncState } from '@/components/common/AsyncState';
import { promotionApi, type AutomaticPromotion, type PromotionPayload } from '../../api/promotion.api';
import { categoryServiceApi } from '../../api/categoryService.api';
import type { Service } from '../../types/categoryService.types';

const empty: PromotionPayload = { name: '', description: '', discountType: 'PERCENT', discountValue: 10,
  maxDiscountAmount: null, minOrderAmount: null, usageLimit: null, startAt: '', endAt: '', status: 'INACTIVE', serviceIds: [], priority: 0, allowVoucher: false };
const localDate = (value: string) => value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
export function AutomaticPromotionsPanel() {
  const [items, setItems] = useState<AutomaticPromotion[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PromotionPayload>(empty);
  const [deleting, setDeleting] = useState<AutomaticPromotion | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [rows, catalog] = await Promise.all([promotionApi.list(), categoryServiceApi.listServices({ limit: 100 })]);
      const remaining = await Promise.all(Array.from({ length: Math.max(0, catalog.pagination.totalPages - 1) }, (_, index) => categoryServiceApi.listServices({ page: index + 2, limit: 100 })));
      setItems(rows); setServices([catalog, ...remaining].flatMap(page => page.items));
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tải chương trình khuyến mãi.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await promotionApi.save({ ...form, startAt: new Date(form.startAt).toISOString(), endAt: new Date(form.endAt).toISOString() }, editing ?? undefined); setOpen(false); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể lưu chương trình.'); }
    finally { setBusy(false); }
  };
  return <div className="space-y-4">
    <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">Chương trình khuyến mãi tự động</h1><p className="text-sm text-on-surface-variant">Khách không cần nhập mã. Chương trình được chọn theo ưu tiên và điều kiện của đơn.</p></div>
      <button type="button" onClick={() => { setForm(empty); setEditing(null); setOpen(true); }} className="rounded-xl bg-primary p-3 text-on-primary">Tạo chương trình</button></div>
    <AsyncState loading={loading} error={!open ? error : undefined} onRetry={load}>
      {items.length === 0 && <p className="rounded-xl border p-6">Chưa có chương trình khuyến mãi.</p>}
      {items.map(item => <article key={item._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant p-4">
        <div><h2 className="font-bold">{item.name}</h2><p>{item.discountType === 'PERCENT' ? `${item.discountValue}%` : `${item.discountValue.toLocaleString('vi-VN')} đ`} · {item.status === 'ACTIVE' ? 'Đã bật' : 'Đã tắt'} · {item.usedCount} / {item.usageLimit ?? 'Không giới hạn'} đơn</p>
          <p className="text-sm">{new Date(item.startAt).toLocaleString('vi-VN')} – {new Date(item.endAt).toLocaleString('vi-VN')}</p></div>
        <div className="flex gap-2"><button type="button" className="p-2 text-primary" onClick={() => { setEditing(item._id); setForm({ ...empty, ...Object.fromEntries(Object.keys(empty).map(key => [key, item[key as keyof AutomaticPromotion]])), startAt: localDate(item.startAt), endAt: localDate(item.endAt) }); setOpen(true); }}>Chỉnh sửa</button><button type="button" className="p-2 text-error" onClick={() => setDeleting(item)}>Xóa</button></div>
      </article>)}
    </AsyncState>
    <Modal open={open} title={editing ? 'Sửa chương trình' : 'Tạo chương trình'} onClose={() => { if (!busy) setOpen(false); }}>
      <form onSubmit={save} className="space-y-4">
        {error && <p role="alert" className="text-error">{error}</p>}
        <label className="block">Tên chương trình<input required maxLength={120} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className="mt-1 w-full rounded-lg border p-3" /></label>
        <label className="block">Mô tả<textarea value={form.description ?? ''} onChange={event => setForm({ ...form, description: event.target.value })} className="mt-1 w-full rounded-lg border p-3" /></label>
        <label className="block">Loại giảm giá<select value={form.discountType} onChange={event => setForm({ ...form, discountType: event.target.value as 'AMOUNT' | 'PERCENT' })} className="ml-3 rounded-lg border p-2"><option value="PERCENT">Phần trăm</option><option value="AMOUNT">Số tiền</option></select></label>
        <label className="block">Giá trị giảm<input required type="number" min={1} max={form.discountType === 'PERCENT' ? 100 : undefined} value={form.discountValue} onChange={event => setForm({ ...form, discountValue: Number(event.target.value) })} className="mt-1 w-full rounded-lg border p-3" /></label>
        {(['minOrderAmount', 'maxDiscountAmount', 'usageLimit', 'priority'] as const).map(key => <label key={key} className="block">{{ minOrderAmount: 'Giá trị đơn tối thiểu', maxDiscountAmount: 'Giảm tối đa', usageLimit: 'Giới hạn số đơn', priority: 'Độ ưu tiên' }[key]}<input type="number" min={0} value={form[key] ?? ''} onChange={event => setForm({ ...form, [key]: event.target.value === '' ? (key === 'priority' ? 0 : null) : Number(event.target.value) })} className="mt-1 w-full rounded-lg border p-3" /></label>)}
        {(['startAt', 'endAt'] as const).map(key => <label key={key} className="block">{key === 'startAt' ? 'Bắt đầu' : 'Kết thúc'}<input required type="datetime-local" value={form[key]} onChange={event => setForm({ ...form, [key]: event.target.value })} className="mt-1 w-full rounded-lg border p-3" /></label>)}
        <fieldset><legend className="font-semibold">Phạm vi dịch vụ — bỏ trống áp dụng toàn hệ thống</legend><div className="max-h-48 overflow-auto">{services.map(service => <label key={service._id} className="flex items-center gap-2 py-2"><input type="checkbox" checked={form.serviceIds.includes(service._id)} onChange={event => setForm({ ...form, serviceIds: event.target.checked ? [...form.serviceIds, service._id] : form.serviceIds.filter(id => id !== service._id) })} />{service.name}</label>)}</div></fieldset>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.allowVoucher} onChange={event => setForm({ ...form, allowVoucher: event.target.checked })} />Cho phép cộng dồn với voucher</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.status === 'ACTIVE'} onChange={event => setForm({ ...form, status: event.target.checked ? 'ACTIVE' : 'INACTIVE' })} />Bật chương trình</label>
        <button disabled={busy} className="rounded-xl bg-primary p-3 text-on-primary">{busy ? 'Đang lưu…' : 'Lưu chương trình'}</button>
      </form>
    </Modal>
    <Modal open={Boolean(deleting)} title="Xóa chương trình khuyến mãi" onClose={() => { if (!busy) setDeleting(null); }}><p>Ngừng và xóa chương trình “{deleting?.name}”? Ưu đãi trên đơn đã tạo được giữ nguyên.</p><button type="button" disabled={busy} className="mt-4 rounded-lg bg-error p-3 text-white" onClick={async () => { if (!deleting) return; setBusy(true); try { await promotionApi.remove(deleting._id); setDeleting(null); await load(); } catch { setError('Không thể xóa chương trình.'); } finally { setBusy(false); } }}>Xác nhận xóa</button></Modal>
  </div>;
}
