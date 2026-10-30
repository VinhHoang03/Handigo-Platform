import { Eye, Flag, MessageSquare, Star } from 'lucide-react';
import type { FeedbackList, FeedbackQuery } from '@/features/feedback/types/feedback.types';

export function AdminFeedbackStats({ stats, query, onChange }: {
  stats?: FeedbackList['moderationStats']; query: FeedbackQuery; onChange: (query: FeedbackQuery) => void;
}) {
  const cards = [
    { label: 'Tổng đánh giá', value: stats?.total.toLocaleString('vi-VN'), note: 'Toàn bộ đánh giá', icon: MessageSquare, active: !query.rating && !query.ratingBelow && query.isVisible === undefined, filter: {} },
    { label: 'Điểm chất lượng', value: stats?.averageRating.toLocaleString('vi-VN', { maximumFractionDigits: 1 }), note: `${stats?.fiveStars ?? '—'} đánh giá 5 sao · Bấm để xem`, icon: Star, active: query.rating === 5, filter: { rating: 5 } },
    { label: 'Đang hiển thị', value: stats?.visible.toLocaleString('vi-VN'), note: `${stats?.hidden ?? '—'} đánh giá đã ẩn`, icon: Eye, active: query.isVisible === true, filter: { isVisible: true } },
    { label: 'Cần chú ý', value: stats?.lowRating.toLocaleString('vi-VN'), note: 'Đánh giá dưới 4 sao', icon: Flag, active: query.ratingBelow === 4, filter: { ratingBelow: 4 } },
  ];
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Thống kê và lọc đánh giá">
    {cards.map(({ label, value, note, icon: Icon, active, filter }) => <button key={label} type="button" aria-pressed={active}
      onClick={() => onChange({ page: 1, limit: 30, ...filter })}
      className={`flex items-center justify-between gap-3 rounded-2xl border bg-surface-container-lowest p-4 text-left transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary ${active ? 'border-primary' : 'border-outline-variant/40'}`}>
      <span><span className="block text-xs text-on-surface-variant">{label}</span><strong className="mt-1 block text-2xl">{value ?? '—'}</strong><span className="mt-1 block text-xs text-on-surface-variant">{note}</span></span>
      <Icon size={22} aria-hidden="true" className={label === 'Cần chú ý' ? 'text-rose-600' : label === 'Điểm chất lượng' ? 'text-amber-500' : 'text-primary'} />
    </button>)}
  </div>;
}
