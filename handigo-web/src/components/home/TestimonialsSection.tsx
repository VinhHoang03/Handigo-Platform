import { useEffect, useState } from "react";
import { SectionHeader } from "../common/SectionHeader";
import { TestimonialCard } from "../common/TestimonialCard";
import { HomeEmptyState, TestimonialCardSkeleton } from "./HomeSkeletons";
import { homeApi, type LatestFeedback } from "@/features/home/api/home.api";

export const TestimonialsSection = () => {
  const [feedbacks, setFeedbacks] = useState<LatestFeedback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    homeApi
      .latestFeedbacks()
      .then(setFeedbacks)
      .catch(() => setFeedbacks([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section
      aria-labelledby="testimonials-heading"
      className="mx-auto mt-lg max-w-7xl px-4 md:px-8"
    >
      <SectionHeader
        id="testimonials-heading"
        title="Đánh giá từ khách hàng"
        description="Nhận xét được ghi lại sau khi công việc hoàn tất"
        centered
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
          {[0, 1, 2].map((item) => (
            <TestimonialCardSkeleton key={item} />
          ))}
        </div>
      ) : feedbacks.length ? (
        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-3 md:gap-8">
          {feedbacks.map((feedback) => (
            <TestimonialCard
              key={feedback._id}
              quote={feedback.comment?.trim() || undefined}
              name={feedback.customerId?.fullName || "Khách hàng"}
              loc={feedback.serviceId?.name || "Dịch vụ tại nhà"}
              img={feedback.customerId?.avatar}
              rating={feedback.rating}
              providerReply={feedback.providerReply?.content}
            />
          ))}
        </div>
      ) : (
        <HomeEmptyState message="Chưa có đánh giá để hiển thị." />
      )}
    </section>
  );
};
