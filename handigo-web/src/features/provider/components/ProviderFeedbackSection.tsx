import { useEffect, useState } from "react";
import { TestimonialCard } from "@/components/home/HomeCards";
import { feedbackApi } from "@/features/feedback/api/feedback.api";
import type { Feedback, PersonRef } from "@/features/feedback/types/feedback.types";

const DEFAULT_AVATAR = "https://ui-avatars.com/api/?name=Khach+hang&background=E8DEF8&color=21005D";

const customerOf = (feedback: Feedback) =>
  typeof feedback.customerId === "string" ? undefined : feedback.customerId;

const serviceOf = (feedback: Feedback) =>
  typeof feedback.serviceId === "string" ? "Dịch vụ" : feedback.serviceId.name || "Dịch vụ";

const performedAtOf = (feedback: Feedback) => {
  if (typeof feedback.orderId === "string") return feedback.createdAt;
  return feedback.orderId.performedAt || feedback.orderId.scheduledAt || feedback.orderId.createdAt || feedback.createdAt;
};

export function ProviderFeedbackSection({ enabled = true }: { enabled?: boolean }) {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled) {
      const timeoutId = window.setTimeout(() => setLoading(false), 0);
      return () => window.clearTimeout(timeoutId);
    }

    let cancelled = false;
    feedbackApi.providerList({ page: 1, limit: 50 })
      .then((result) => { if (!cancelled) setFeedbacks(result.items); })
      .catch(() => { if (!cancelled) setError("Không thể tải đánh giá khách hàng."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enabled]);

  return (
    <section className="rounded-xl border border-outline-variant/20 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h3 className="font-headline-md text-headline-md text-on-surface">Đánh giá khách hàng</h3>
        <p className="mt-1 text-sm text-on-surface-variant">Phản hồi từ khách hàng đã sử dụng dịch vụ của bạn.</p>
      </div>
      {loading ? (
        <p className="rounded-xl bg-surface-container-low p-5 text-center text-sm text-on-surface-variant">Đang tải đánh giá...</p>
      ) : error ? (
        <p className="rounded-xl bg-error/10 p-4 text-sm text-error">{error}</p>
      ) : feedbacks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-outline-variant p-6 text-center text-on-surface-variant">Chưa có đánh giá từ khách hàng.</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-1 2xl:grid-cols-2">
          {feedbacks.map((feedback) => {
            const customer = customerOf(feedback) as PersonRef | undefined;
            const performedAt = performedAtOf(feedback);
            return <TestimonialCard
              key={feedback._id}
              quote={feedback.comment || "Khách hàng đã đánh giá dịch vụ."}
              name={customer?.fullName || "Khách hàng"}
              loc={`${feedback.rating}/5 điểm`}
              img={customer?.avatar || DEFAULT_AVATAR}
              rating={feedback.rating}
              service={serviceOf(feedback)}
              performedAt={new Date(performedAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}
              providerReply={feedback.providerReply?.content}
            />;
          })}
        </div>
      )}
    </section>
  );
}
