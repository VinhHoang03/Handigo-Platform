import { useState } from 'react';
import { AsyncState } from '@/components/common/AsyncState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DashboardShell } from '@/components/common/DashboardShell';
import { Pagination } from '@/components/common/Pagination';
import { AdminFeedbackFilters } from '@/features/admin/components/feedback/AdminFeedbackFilters';
import { AdminFeedbackList } from '@/features/admin/components/feedback/AdminFeedbackList';
import { useFeedbackList } from '../hooks/useFeedback';
import { feedbackService } from '../services/feedback.service';
import type { Feedback, FeedbackQuery } from '../types/feedback.types';

export default function AdminFeedbackPage() {
  const [query, setQuery] = useState<FeedbackQuery>({ page: 1, limit: 10 });
  const { result, loading, error, load } = useFeedbackList('admin', query);
  const [target, setTarget] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    if (!target) return;
    try {
      setBusy(true);
      await feedbackService.setVisibility(target._id, !target.isVisible);
      setTarget(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardShell role="ADMIN">
      <header><h1 className="text-headline-lg font-bold">Kiểm duyệt đánh giá</h1><p className="text-on-surface-variant">Theo dõi và ẩn nội dung không phù hợp.</p></header>
      <AdminFeedbackFilters query={query} onChange={setQuery} />
      <AsyncState loading={loading} error={error} empty={!result?.items.length} emptyMessage="Chưa có đánh giá phù hợp với bộ lọc." onRetry={load}><AdminFeedbackList items={result?.items || []} onToggle={setTarget} /></AsyncState>
      <Pagination page={query.page || 1} totalPages={result?.pagination.totalPages || 1} onChange={(page) => setQuery({ ...query, page })} />
      <ConfirmDialog open={Boolean(target)} title={target?.isVisible ? 'Ẩn đánh giá' : 'Hiện đánh giá'} message="Thao tác này sẽ cập nhật điểm tổng hợp của thợ." busy={busy} onCancel={() => setTarget(null)} onConfirm={confirm} />
    </DashboardShell>
  );
}
