import { useEffect, useMemo, useState } from "react";
import { SectionHeader } from "../common/SectionHeader";
import { TestimonialCardSkeleton } from "./HomeSkeletons";
import { homeApi, type LatestFeedback } from "@/features/home/api/home.api";
import { InitialsAvatar } from "../common/InitialsAvatar";
import { Star } from "lucide-react";

/**
 * Nhận xét ngắn hơn ngưỡng này không nói được gì ("sạch, đẹp") mà lại chiếm trọn
 * một thẻ, khiến trang trông như có đánh giá mà thực ra không có nội dung.
 */
const MIN_COMMENT_LENGTH = 40;
const MIN_TESTIMONIALS = 3;

/** "duc trung" → "Duc Trung". Dữ liệu do khách tự nhập nên hoa/thường tuỳ ý. */
const toTitleCase = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

interface QuoteProps {
  feedback: LatestFeedback;
  large?: boolean;
}

const Quote = ({ feedback, large }: QuoteProps) => {
  const name = toTitleCase(feedback.customerId?.fullName || "Khách hàng");

  return (
    <figure
      className={`flex h-full flex-col rounded-3xl border border-outline-variant/40 bg-surface-container-lowest ${large ? "p-8 lg:p-10" : "p-7"}`}
    >
      <div
        className="flex gap-0.5"
        role="img"
        aria-label={`${feedback.rating} trên 5 sao`}
      >
        {[0, 1, 2, 3, 4].map((star) => (
          <Star
            key={star}
            aria-hidden="true"
            size={16}
            className={star < feedback.rating ? "text-tertiary" : "text-outline-variant"}
            fill={star < feedback.rating ? "currentColor" : "none"}
          />
        ))}
      </div>

      <blockquote
        className={`mt-5 line-clamp-3 text-pretty text-on-surface ${large ? "font-headline-md text-xl leading-relaxed lg:text-2xl" : "text-body-md"}`}
      >
        {feedback.comment?.trim()}
      </blockquote>

      <figcaption className="mt-auto flex items-center gap-3 pt-7">
        <InitialsAvatar
          name={name}
          src={feedback.customerId?.avatar}
          className="h-11 w-11"
          textClassName="text-xs"
        />
        <span className="min-w-0">
          <span className="block truncate text-label-md font-semibold text-on-surface">
            {name}
          </span>
          <span className="block truncate text-label-sm text-on-surface-variant">
            {feedback.serviceId?.name || "Dịch vụ tại nhà"}
          </span>
        </span>
      </figcaption>
    </figure>
  );
};

/**
 * Bố cục bất đối xứng: một trích dẫn lớn chiếm 7 cột, hai trích dẫn nhỏ xếp dọc
 * ở 5 cột còn lại. Ba thẻ đều nhau là khuôn đã dùng ở nơi khác trên trang.
 *
 * Không đủ đánh giá đạt chuẩn thì **ẩn cả section**: hiện một trích dẫn hai chữ
 * còn tệ hơn không hiện gì.
 */
export const TestimonialsSection = () => {
  const [feedbacks, setFeedbacks] = useState<LatestFeedback[]>([]);
  const [loading, setLoading] = useState(true);

  const quality = useMemo(
    () =>
      feedbacks.filter(
        (feedback) =>
          (feedback.comment?.trim().length ?? 0) >= MIN_COMMENT_LENGTH,
      ),
    [feedbacks],
  );

  useEffect(() => {
    homeApi
      .latestFeedbacks()
      .then(setFeedbacks)
      .catch(() => setFeedbacks([]))
      .finally(() => setLoading(false));
  }, []);

  if (!loading && quality.length < MIN_TESTIMONIALS) return null;

  return (
    <section
      aria-labelledby="testimonials-heading"
      className="mx-auto mt-lg max-w-7xl px-4 md:px-8"
    >
      <SectionHeader
        id="testimonials-heading"
        title="Khách hàng nói gì"
        description="Nhận xét được ghi lại sau khi công việc hoàn tất"
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <TestimonialCardSkeleton />
          </div>
          <div className="grid gap-6 lg:col-span-5">
            <TestimonialCardSkeleton />
            <TestimonialCardSkeleton />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Quote feedback={quality[0]} large />
          </div>
          <div className="grid gap-6 lg:col-span-5">
            {quality.slice(1, 3).map((feedback) => (
              <Quote key={feedback._id} feedback={feedback} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
