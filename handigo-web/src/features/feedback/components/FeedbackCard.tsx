import { RatingStars } from '@/components/common/RatingStars';
import type { Feedback, PersonRef } from '../types/feedback.types';

const nameOf = (value: string | PersonRef) =>
  typeof value === 'string' ? 'Khách hàng' : value.fullName || 'Khách hàng';

export function FeedbackCard({
  feedback,
  actions,
}: {
  feedback: Feedback;
  actions?: React.ReactNode;
}) {
  const service = typeof feedback.serviceId === 'string' ? '' : feedback.serviceId.name;

  return (
    <article className="rounded-2xl border border-outline-variant/40 bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{nameOf(feedback.customerId)}</p>
          <p className="text-sm text-on-surface-variant">
            {service || 'Dịch vụ'} · {new Date(feedback.createdAt).toLocaleDateString('vi-VN')}
          </p>
        </div>
        <RatingStars value={feedback.rating} size="sm" />
      </div>

      {feedback.comment && <p className="mt-4 leading-relaxed">{feedback.comment}</p>}
      {feedback.images.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {feedback.images.map((image) => (
            <img key={image} src={image} alt="Ảnh đánh giá" className="h-20 w-20 rounded-xl object-cover" />
          ))}
        </div>
      )}
      {feedback.providerReply && (
        <div className="mt-4 rounded-xl bg-primary/5 p-4">
          <p className="text-xs font-bold uppercase text-primary">Phản hồi của thợ</p>
          <p className="mt-1">{feedback.providerReply.content}</p>
        </div>
      )}
      {actions && <div className="mt-4 border-t border-outline-variant/30 pt-4">{actions}</div>}
    </article>
  );
}
