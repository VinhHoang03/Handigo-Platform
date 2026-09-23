import { useState } from 'react';
import { AsyncState } from '@/components/common/AsyncState';
import { DashboardShell } from '@/components/common/DashboardShell';
import { FloatingInput, FloatingTextarea } from '@/components/common/FloatingField';
import { FormSelect } from '@/components/common/FormSelect';
import { Modal } from '@/components/common/Modal';
import { Pagination } from '@/components/common/Pagination';
import { RatingStars } from '@/components/common/RatingStars';
import { feedbackService } from '../services/feedback.service';
import { FeedbackCard } from '../components/FeedbackCard';
import { useFeedbackList } from '../hooks/useFeedback';
import type { Feedback, FeedbackQuery } from '../types/feedback.types';

export default function ProviderFeedbackPage() {
  const [query, setQuery] = useState<FeedbackQuery>({ page: 1, limit: 10, keyword: '' });
  const { result, loading, error, load } = useFeedbackList('provider', query);
  const [selected, setSelected] = useState<Feedback | null>(null);
  const [reply, setReply] = useState('');
  const [saving, setSaving] = useState(false);

  const openReply = (feedback: Feedback) => {
    setSelected(feedback);
    setReply(feedback.providerReply?.content || '');
  };

  const submitReply = async () => {
    if (!selected || !reply.trim()) return;
    try {
      setSaving(true);
      await feedbackService.reply(selected._id, reply.trim());
      setSelected(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardShell role="PROVIDER">
      <div>
        <h1 className="text-headline-lg font-bold">Đánh giá từ khách hàng</h1>
        <p className="text-on-surface-variant">
          Tổng hợp phản hồi từ tất cả dịch vụ và đơn hàng của bạn.
        </p>
      </div>

      {result?.summary && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
            <p className="text-sm text-on-surface-variant">Điểm trung bình</p>
            <p className="text-4xl font-bold text-primary">{result.summary.averageRating.toFixed(1)}</p>
            <RatingStars value={Math.round(result.summary.averageRating)} size="sm" />
          </div>
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
            <p className="text-sm text-on-surface-variant">Tổng đánh giá</p>
            <p className="text-4xl font-bold">{result.summary.totalFeedbacks}</p>
          </div>
          <div className="space-y-2 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
            {[5, 4, 3, 2, 1].map((rating) => (
              <div key={rating} className="flex items-center gap-2 text-sm">
                <span>{rating}★</span>
                <div className="h-2 flex-1 rounded bg-surface-container-high">
                  <div
                    className="h-2 rounded bg-tertiary"
                    style={{
                      width: `${result.summary!.totalFeedbacks
                        ? ((result.summary!.ratingDistribution[rating as 1 | 2 | 3 | 4 | 5] || 0) / result.summary!.totalFeedbacks) * 100
                        : 0}%`,
                    }}
                  />
                </div>
                <span>{result.summary!.ratingDistribution[rating as 1 | 2 | 3 | 4 | 5] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 md:grid-cols-[minmax(14rem,1fr)_12rem_13rem]">
        <FloatingInput
          id="provider-feedback-keyword"
          label="Tìm trong nhận xét"
          value={query.keyword || ''}
          onValueChange={(value) => setQuery({ ...query, keyword: value, page: 1 })}
        />
        <FormSelect
          id="provider-feedback-rating"
          label="Số sao"
          value={query.rating || ''}
          onValueChange={(value) => setQuery({ ...query, rating: value ? Number(value) : '', page: 1 })}
        >
          <option value="">Tất cả số sao</option>
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>{value} sao</option>
          ))}
        </FormSelect>
        <FormSelect
          id="provider-feedback-replied"
          label="Phản hồi"
          value={String(query.replied ?? '')}
          onValueChange={(value) => setQuery({ ...query, replied: value === '' ? '' : value === 'true', page: 1 })}
        >
          <option value="">Tất cả phản hồi</option>
          <option value="true">Đã phản hồi</option>
          <option value="false">Chưa phản hồi</option>
        </FormSelect>
      </div>

      <AsyncState
        loading={loading}
        error={error}
        empty={!result?.items.length}
        emptyMessage="Chưa có đánh giá nào."
        onRetry={load}
      >
        <div className="space-y-4">
          {result?.items.map((feedback) => (
            <FeedbackCard
              key={feedback._id}
              feedback={feedback}
              actions={(
                <button onClick={() => openReply(feedback)} className="font-semibold text-primary">
                  {feedback.providerReply ? 'Sửa phản hồi' : 'Phản hồi'}
                </button>
              )}
            />
          ))}
        </div>
      </AsyncState>

      <Pagination
        page={query.page || 1}
        totalPages={result?.pagination.totalPages || 1}
        onChange={(page) => setQuery({ ...query, page })}
      />

      <Modal
        open={Boolean(selected)}
        title={selected?.providerReply ? 'Sửa phản hồi' : 'Phản hồi đánh giá'}
        onClose={() => setSelected(null)}
        size="md"
      >
        <FloatingTextarea
          id="provider-feedback-reply"
          label="Nội dung phản hồi"
          value={reply}
          rows={5}
          maxLength={1000}
          onValueChange={setReply}
          hint={`${reply.length}/1000 ký tự`}
        />
        <button onClick={submitReply} disabled={saving || !reply.trim()} className="btn-primary mt-4 w-full">
          {saving ? 'Đang lưu...' : 'Lưu phản hồi'}
        </button>
      </Modal>
    </DashboardShell>
  );
}
