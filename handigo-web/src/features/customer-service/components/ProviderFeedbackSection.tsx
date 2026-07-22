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
}

/** Danh sách đánh giá công khai từ khách hàng đã đặt dịch vụ với chuyên gia. */
export function ProviderFeedbackSection({
  feedbacks,
  totalFeedbacks,
}: ProviderFeedbackSectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-on-background">
          Đánh giá từ khách hàng
        </h2>
        <span className="text-sm font-bold text-primary">
          {totalFeedbacks} đánh giá
        </span>
      </div>
      {feedbacks.length === 0 ? (
        <p className="rounded-2xl bg-surface-container-lowest p-5 text-on-surface-variant">
          Chưa có đánh giá công khai cho chuyên gia này.
        </p>
      ) : (
        feedbacks.map((feedback) => (
          <article
            key={feedback.id}
            className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <InitialsAvatar
                  name={feedback.customer.fullName}
                  src={feedback.customer.avatar}
                  className="h-10 w-10"
                  textClassName="text-xs"
                />
                <div>
                  <p className="font-bold">{feedback.customer.fullName}</p>
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
