import { RatingStars } from "@/components/common/RatingStars";
import type { Feedback, PersonRef } from "../types/feedback.types";

const nameOf = (value: string | PersonRef | null) =>
  typeof value === "string" ? "Khách hàng" : value?.fullName || "Khách hàng";

export function FeedbackCard({
  feedback,
  actions,
  headerActions,
  replyLabel = "Phản hồi của tôi",
  compact = false,
  metadata,
  replySummaryOnly = false,
}: {
  feedback: Feedback;
  actions?: React.ReactNode;
  headerActions?: React.ReactNode;
  replyLabel?: string;
  compact?: boolean;
  metadata?: React.ReactNode;
  replySummaryOnly?: boolean;
}) {
  const service =
    typeof feedback.serviceId === "string" ? "" : feedback.serviceId?.name;

  return (
    <article className={`relative rounded-2xl border border-outline-variant/40 bg-surface shadow-sm ${compact ? "flex h-full min-w-0 flex-col p-3 text-sm" : "p-5"}`}>
      {replySummaryOnly && headerActions && <div className="absolute top-3 right-3">{headerActions}</div>}
      <div className={`flex ${compact ? "flex-col gap-2" : "flex-wrap items-start justify-between gap-3"}`}>
        <div className="min-w-0 break-words">
          <p className={`font-semibold ${replySummaryOnly && headerActions ? 'pr-12' : ''}`}>{nameOf(feedback.customerId)}</p>
          <p className="text-sm text-on-surface-variant">
            {service || "Dịch vụ"}{compact ? <br /> : ' · '}
            {compact && 'Ngày đánh giá: '}
            <time dateTime={feedback.createdAt}>
              {compact
                ? new Date(feedback.createdAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })
                : new Date(feedback.createdAt).toLocaleDateString("vi-VN")}
            </time>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {compact && <span className="text-sm font-semibold">{feedback.rating}/5</span>}
          <RatingStars value={feedback.rating} size="sm" />
          {!replySummaryOnly && headerActions}
        </div>
      </div>
      {metadata && <div className="mt-2">{metadata}</div>}

      {feedback.comment && (
        <p className={`${compact ? "mt-2" : "mt-4"} ${replySummaryOnly ? 'line-clamp-3' : ''} whitespace-pre-wrap break-words leading-relaxed`}>{feedback.comment}</p>
      )}
      {feedback.images.length > 0 && (
        <div className={`${compact ? "mt-2" : "mt-4"} flex flex-wrap gap-2`}>
          {(replySummaryOnly ? feedback.images.slice(0, 2) : feedback.images).map((image) => (
            <img
              key={image}
              src={image}
              alt="Ảnh đánh giá"
              className={`${compact ? "h-14 w-14" : "h-20 w-20"} rounded-xl object-cover`}
            />
          ))}
          {replySummaryOnly && feedback.images.length > 2 && <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/5 text-xs text-primary">+{feedback.images.length - 2} ảnh</span>}
        </div>
      )}
      {feedback.providerReply && (replySummaryOnly ? <p className="mt-2 text-xs font-medium text-primary">Có phản hồi từ thợ</p> : (
        <div className={`rounded-xl bg-primary/5 ${compact ? "mt-2 p-2" : "mt-4 p-4"}`}>
          <p className="text-xs font-bold uppercase text-primary">
            {replyLabel}
          </p>
          <p className="mt-1">{feedback.providerReply.content}</p>
        </div>
      ))}
      {actions && (
        <div className={`${compact ? replySummaryOnly ? "mt-auto pt-3" : "mt-3 pt-3" : "mt-4 pt-4"} border-t border-outline-variant/30`}>
          {actions}
        </div>
      )}
    </article>
  );
}
