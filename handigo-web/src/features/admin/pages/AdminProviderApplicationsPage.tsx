import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { AsyncState } from '@/components/common/AsyncState';
import { DashboardShell } from '@/components/common/DashboardShell';
import { FloatingTextarea } from '@/components/common/FloatingField';
import { Modal } from '@/components/common/Modal';
import { Pagination } from '@/components/common/Pagination';
import type { Category } from '@/features/provider-application/types/providerApplication.types';
import { adminApi } from '../api/admin.api';
import { ApplicationFilters } from '../components/applications/ApplicationFilters';
import { ApplicationList } from '../components/applications/ApplicationList';
import { useAdminList } from '../hooks/useAdminList';
import type { AdminApplication, AdminQuery } from '../types/admin.types';

export default function AdminProviderApplicationsPage() {
  const [query, setQuery] = useState<AdminQuery>({ page: 1, limit: 10 });
  const { result, loading, error, load } = useAdminList('applications', query);
  const items = (result?.items || []) as AdminApplication[];
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<AdminApplication | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminApi.categories().then(setCategories).catch(() => setCategories([]));
  }, []);

  const closeModal = () => {
    setSelected(null);
    setRejecting(false);
    setReason('');
  };

  const review = async (status: 'approved' | 'rejected') => {
    if (!selected || (status === 'rejected' && !reason.trim())) return;
    try {
      setBusy(true);
      await adminApi.review(selected._id, status, reason.trim() || undefined);
      closeModal();
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardShell role="ADMIN">
      <header>
        <h1 className="text-headline-lg font-bold">Duyệt hồ sơ thợ</h1>
        <p className="text-on-surface-variant">
          Xem thông tin chuyên môn và xét duyệt đơn đăng ký.
        </p>
      </header>

      <ApplicationFilters query={query} categories={categories} onChange={setQuery} />

      <AsyncState
        loading={loading}
        error={error}
        empty={!items.length}
        emptyMessage="Chưa có hồ sơ phù hợp với bộ lọc."
        onRetry={load}
      >
        <ApplicationList items={items} onSelect={setSelected} />
      </AsyncState>

      <Pagination
        page={query.page || 1}
        totalPages={result?.pagination.totalPages || 1}
        onChange={(page) => setQuery({ ...query, page })}
      />

      <Modal open={Boolean(selected)} title="Chi tiết hồ sơ thợ" onClose={closeModal} size="lg">
        {selected && (
          <div className="space-y-4">
            <div>
              <p className="font-bold">{selected.userId.fullName}</p>
              <p className="text-on-surface-variant">
                {selected.userId.email} · {selected.userId.phone || 'Chưa có SĐT'}
              </p>
            </div>
            <div><b>Dịch vụ:</b> {selected.serviceIds.map((item) => item.name).join(', ')}</div>
            <div><b>Kinh nghiệm:</b> {selected.experienceYears} năm</div>
            <div><b>Khu vực:</b> {selected.workingAreas.join(', ')}</div>
            <div>
              <b>Giới thiệu:</b>
              <p className="mt-1 rounded-2xl bg-surface-container-low p-3 leading-relaxed">
                {selected.description}
              </p>
            </div>
            {selected.rejectionReason && (
              <p className="rounded-2xl bg-error/10 p-3 text-error">
                Lý do từ chối: {selected.rejectionReason}
              </p>
            )}
            {selected.status === 'pending' && (
              <div className="space-y-3">
                {rejecting && (
                  <FloatingTextarea
                    id="application-rejection-reason"
                    label="Lý do từ chối (bắt buộc)"
                    value={reason}
                    rows={4}
                    onValueChange={setReason}
                  />
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setRejecting(true)}
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-error/10 py-3 font-semibold text-error disabled:opacity-50"
                  >
                    <X size={18} /> Từ chối
                  </button>
                  <button
                    type="button"
                    onClick={() => review(rejecting ? 'rejected' : 'approved')}
                    disabled={busy || (rejecting && !reason.trim())}
                    className="btn-primary"
                  >
                    <Check size={18} /> {busy ? 'Đang xử lý...' : rejecting ? 'Xác nhận từ chối' : 'Phê duyệt'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </DashboardShell>
  );
}
