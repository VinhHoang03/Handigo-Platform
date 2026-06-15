import { useState } from 'react';
import { AsyncState } from '@/components/common/AsyncState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DashboardShell } from '@/components/common/DashboardShell';
import { Pagination } from '@/components/common/Pagination';
import { StatusBadge } from '@/components/common/StatusBadge';
import { FeedbackCard } from '../components/FeedbackCard';
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
    try { setBusy(true); await feedbackService.setVisibility(target._id, !target.isVisible); setTarget(null); await load(); }
    finally { setBusy(false); }
  };
  return (
    <DashboardShell role="ADMIN">
      <div><h1 className="text-headline-lg font-bold">Kiểm duyệt đánh giá</h1><p className="text-on-surface-variant">Theo dõi và ẩn nội dung không phù hợp.</p></div>
      <div className="glass-card flex flex-wrap gap-3 rounded-2xl p-4">
        <input value={query.keyword || ''} onChange={(e) => setQuery({ ...query, keyword: e.target.value, page: 1 })} className="min-w-56 flex-1 rounded-xl border border-outline-variant p-3" placeholder="Tìm nội dung đánh giá..." />
        <select value={query.rating || ''} onChange={(e) => setQuery({ ...query, rating: e.target.value ? Number(e.target.value) : '', page: 1 })} className="rounded-xl border border-outline-variant p-3"><option value="">Tất cả số sao</option>{[1,2,3,4,5].map((v) => <option key={v} value={v}>{v} sao</option>)}</select>
        <select value={String(query.isVisible ?? '')} onChange={(e) => setQuery({ ...query, isVisible: e.target.value === '' ? '' : e.target.value === 'true', page: 1 })} className="rounded-xl border border-outline-variant p-3"><option value="">Tất cả trạng thái</option><option value="true">Đang hiển thị</option><option value="false">Đã ẩn</option></select>
      </div>
      <AsyncState loading={loading} error={error} empty={!result?.items.length} emptyMessage="Không có đánh giá phù hợp." onRetry={load}>
        <div className="space-y-4">{result?.items.map((feedback) => <FeedbackCard key={feedback._id} feedback={feedback} actions={<div className="flex items-center justify-between"><StatusBadge value={feedback.isVisible ? 'visible' : 'hidden'} /><button onClick={() => setTarget(feedback)} className="font-semibold text-primary">{feedback.isVisible ? 'Ẩn đánh giá' : 'Hiện đánh giá'}</button></div>} />)}</div>
      </AsyncState>
      <Pagination page={query.page || 1} totalPages={result?.pagination.totalPages || 1} onChange={(page) => setQuery({ ...query, page })} />
      <ConfirmDialog open={Boolean(target)} title={target?.isVisible ? 'Ẩn đánh giá' : 'Hiện đánh giá'} message="Thao tác này sẽ cập nhật điểm tổng hợp của thợ." busy={busy} onCancel={() => setTarget(null)} onConfirm={confirm} />
    </DashboardShell>
  );
}
