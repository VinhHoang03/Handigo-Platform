import { Eye, EyeOff } from 'lucide-react';
import { StatusBadge } from '@/components/common/StatusBadge';
import { FeedbackCard } from '@/features/feedback/components/FeedbackCard';
import type { Feedback } from '@/features/feedback/types/feedback.types';

export function AdminFeedbackList({ items, onToggle, onOpen }: { items: Feedback[]; onToggle: (feedback: Feedback) => void; onOpen?: (feedback: Feedback) => void }) {
  return (
    <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {items.map((feedback) => (
        <div key={feedback._id} className="relative min-w-0">
        {onOpen && <button
          type="button"
          onClick={() => onOpen(feedback)}
          aria-label="Xem chi tiết đơn hàng và đánh giá"
          className="absolute inset-0 z-10 cursor-pointer rounded-2xl hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />}
        <FeedbackCard
          feedback={feedback}
          compact
          replyLabel="Phản hồi của thợ"
          metadata={
            <dl className="space-y-1 break-words text-xs text-on-surface-variant">
              <div>
                <dt className="inline font-medium">Mã đơn: </dt>
                <dd className="inline">{typeof feedback.orderId === 'object' ? feedback.orderId?.orderCode || 'Chưa có thông tin' : 'Chưa có thông tin'}</dd>
              </div>
              <div>
                <dt className="inline font-medium">Ngày thực hiện: </dt>
                <dd className="inline">
                  {typeof feedback.orderId === 'object' && feedback.orderId?.performedAt
                    ? <time dateTime={feedback.orderId.performedAt}>{new Date(feedback.orderId.performedAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</time>
                    : 'Chưa có thông tin'}
                </dd>
              </div>
            </dl>
          }
          actions={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap items-center gap-1 text-xs text-on-surface-variant">
                  <span>Trạng thái:</span>
                  <StatusBadge value={feedback.isVisible ? 'visible' : 'hidden'} />
                </div>
                <span className="break-words text-xs text-on-surface-variant">
                  Thợ: {typeof feedback.providerId === 'object' ? feedback.providerId?.userId?.fullName || feedback.providerId?.fullName || 'Chưa có thông tin' : 'Chưa có thông tin'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onToggle(feedback)}
                className="relative z-20 inline-flex min-h-11 items-center gap-2 rounded-lg border border-outline-variant px-3 text-sm text-primary hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {feedback.isVisible ? <EyeOff aria-hidden="true" size={16} /> : <Eye aria-hidden="true" size={16} />}
                {feedback.isVisible ? 'Ẩn đánh giá' : 'Hiện đánh giá'}
              </button>
            </div>
          }
        />
        </div>
      ))}
    </div>
  );
}
