import { InitialsAvatar } from "@/components/common/InitialsAvatar";
import { RatingStars } from "@/components/common/RatingStars";
import type { PublicProviderProfile } from "../api/customerService.api";

const formatDate = (value?: string) => {
  if (!value) return "";
  return new Date(value).toLocaleDateString("vi-VN");
};

interface ProviderFeedbackSectionProps {
  feedbacks: PublicProviderProfile["feedbacks"];
  totalFeedbacks: number;
  compact?: boolean;
}

/** Danh sách đánh giá công khai từ khách hàng đã đặt dịch vụ với thợ. */
export function ProviderFeedbackSection({
  feedbacks,
  totalFeedbacks,
  compact = false,
}: ProviderFeedbackSectionProps) {
  return (
    <section className={compact ? 'space-y-2.5 text-[15px] leading-6' : 'space-y-4'}>
      <div className="flex items-center justify-between gap-2">
        <h2 className={`font-bold text-on-background ${compact ? 'text-base leading-6' : 'text-2xl'}`}>
          Đánh giá từ khách hàng
        </h2>
        <span className={`shrink-0 font-bold text-primary ${compact ? 'text-[13px]' : 'text-sm'}`}>
          {totalFeedbacks} đánh giá
        </span>
      </div>
      {feedbacks.length === 0 ? (
        <p className={`bg-surface-container-lowest text-on-surface-variant ${compact ? 'rounded-xl p-3' : 'rounded-2xl p-5'}`}>
          Chưa có đánh giá công khai cho thợ này.
        </p>
      ) : (
        feedbacks.map((feedback) => (
          <article
            key={feedback.id}
            className={`border border-outline-variant/20 bg-surface-container-lowest shadow-sm ${compact ? 'rounded-xl p-3' : 'rounded-2xl p-5'}`}
          >
            <div className={`flex items-center justify-between ${compact ? 'mb-2 flex-wrap gap-2' : 'mb-3 gap-3'}`}>
              <div className={`flex min-w-0 items-center ${compact ? 'gap-2' : 'gap-3'}`}>
                <InitialsAvatar
                  name={feedback.customer.fullName}
                  src={feedback.customer.avatar}
                  className={compact ? 'h-8 w-8 shrink-0' : 'h-10 w-10'}
                  textClassName="text-xs"
                />
                <div className="min-w-0">
                  <p className="break-words font-bold">{feedback.customer.fullName}</p>
                  <p className="text-xs uppercase text-on-surface-variant">
                    {formatDate(feedback.createdAt)}
                  </p>
                </div>
              </div>
              <RatingStars value={feedback.rating} size="sm" />
            </div>
            <p className="text-on-surface-variant">{feedback.comment}</p>
          </article>
        ))
      )}
    </section>
  );
}
