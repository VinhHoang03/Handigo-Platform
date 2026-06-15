import { useEffect, useState } from 'react';
import { AsyncState } from '@/components/common/AsyncState';
import { DashboardShell } from '@/components/common/DashboardShell';
import { Modal } from '@/components/common/Modal';
import { Pagination } from '@/components/common/Pagination';
import { StatusBadge } from '@/components/common/StatusBadge';
import { adminApi } from '../api/admin.api';
import { useAdminList } from '../hooks/useAdminList';
import type { AdminApplication, AdminQuery } from '../types/admin.types';
import type { Category } from '@/features/provider-application/types/providerApplication.types';

export default function AdminProviderApplicationsPage() {
  const [query, setQuery] = useState<AdminQuery>({ page: 1, limit: 10 });
  const { result, loading, error, load } = useAdminList('applications', query);
  const items = (result?.items || []) as AdminApplication[];
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<AdminApplication | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { adminApi.categories().then(setCategories).catch(() => setCategories([])); }, []);
  const review = async (status: 'approved' | 'rejected') => {
    if (!selected || (status === 'rejected' && !reason.trim())) return;
    try { setBusy(true); await adminApi.review(selected._id, status, reason.trim() || undefined); setSelected(null); setRejecting(false); setReason(''); await load(); }
    finally { setBusy(false); }
  };
  return (
    <DashboardShell role="ADMIN">
      <div><h1 className="text-headline-lg font-bold">Duyệt hồ sơ thợ</h1><p className="text-on-surface-variant">Xem thông tin chuyên môn và xét duyệt đơn đăng ký.</p></div>
      <div className="glass-card flex flex-wrap gap-3 rounded-2xl p-4"><input value={query.keyword || ''} onChange={(e) => setQuery({ ...query, keyword: e.target.value, page: 1 })} className="min-w-56 flex-1 rounded-xl border border-outline-variant p-3" placeholder="Tên hoặc email..." /><select value={query.status || ''} onChange={(e) => setQuery({ ...query, status: e.target.value, page: 1 })} className="rounded-xl border border-outline-variant p-3"><option value="">Tất cả trạng thái</option><option value="pending">Chờ duyệt</option><option value="approved">Đã duyệt</option><option value="rejected">Từ chối</option></select><select value={query.categoryId || ''} onChange={(e) => setQuery({ ...query, categoryId: e.target.value, page: 1 })} className="rounded-xl border border-outline-variant p-3"><option value="">Tất cả lĩnh vực</option>{categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select></div>
      <AsyncState loading={loading} error={error} empty={!items.length} emptyMessage="Không có hồ sơ phù hợp." onRetry={load}>
        <div className="grid gap-4 lg:grid-cols-2">{items.map((item) => <button key={item._id} onClick={() => setSelected(item)} className="glass-card rounded-2xl p-5 text-left"><div className="flex justify-between gap-3"><div><p className="font-bold">{item.userId.fullName}</p><p className="text-sm text-on-surface-variant">{item.userId.email}</p></div><StatusBadge value={item.status} /></div><p className="mt-4 line-clamp-2">{item.description}</p><p className="mt-3 text-sm text-primary">{item.experienceYears} năm kinh nghiệm · {item.serviceCategoryIds.length} lĩnh vực</p></button>)}</div>
      </AsyncState>
      <Pagination page={query.page || 1} totalPages={result?.pagination.totalPages || 1} onChange={(page) => setQuery({ ...query, page })} />
      <Modal open={Boolean(selected)} title="Chi tiết hồ sơ thợ" onClose={() => { setSelected(null); setRejecting(false); }}>{selected && <div className="space-y-4"><div><p className="font-bold">{selected.userId.fullName}</p><p className="text-on-surface-variant">{selected.userId.email} · {selected.userId.phone || 'Chưa có SĐT'}</p></div><div><b>Lĩnh vực:</b> {selected.serviceCategoryIds.map((item) => item.name).join(', ')}</div><div><b>Kinh nghiệm:</b> {selected.experienceYears} năm</div><div><b>Khu vực:</b> {selected.workingAreas.join(', ')}</div><div><b>Giới thiệu:</b><p className="mt-1 rounded-xl bg-surface-container-low p-3">{selected.description}</p></div>{selected.rejectionReason && <p className="rounded-xl bg-error/10 p-3 text-error">Lý do từ chối: {selected.rejectionReason}</p>}{selected.status === 'pending' && <>{rejecting && <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} className="w-full rounded-xl border border-outline-variant p-3" placeholder="Lý do từ chối (bắt buộc)" />}<div className="flex gap-3"><button onClick={() => setRejecting(true)} disabled={busy} className="flex-1 rounded-xl bg-error/10 py-3 font-semibold text-error">Từ chối</button><button onClick={() => review(rejecting ? 'rejected' : 'approved')} disabled={busy || (rejecting && !reason.trim())} className="flex-1 rounded-xl bg-primary py-3 font-semibold text-on-primary disabled:opacity-50">{busy ? 'Đang xử lý...' : rejecting ? 'Xác nhận từ chối' : 'Phê duyệt'}</button></div></>}</div>}</Modal>
    </DashboardShell>
  );
}
