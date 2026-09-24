import { AsyncState } from "@/components/common/AsyncState";
import { useOrderFeedback } from "../hooks/useFeedback";
import { FeedbackForm } from "./FeedbackForm";
import { Star } from "lucide-react";

export function OrderFeedbackSection({ orderId }: { orderId: string }) {
  const { context, feedback, loading, saving, error, load, save } =
    useOrderFeedback(orderId);

  return (
    <section className="overflow-hidden rounded-3xl border border-outline-variant bg-surface-container-lowest p-md shadow-sm sm:p-lg">
      <div className="mb-lg flex items-start gap-3">
        <Star aria-hidden="true" size={24} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-tertiary/10 text-tertiary" />
        <div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            {feedback ? "Đánh giá của bạn" : "Đánh giá dịch vụ"}
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Chia sẻ trải nghiệm thực tế để Handigo cải thiện chất lượng dịch vụ.
          </p>
        </div>
      </div>

      <AsyncState loading={loading} error={error} onRetry={() => void load()}>
        {context?.canReview ? (
          <FeedbackForm
            key={feedback?._id || "new"}
            orderId={orderId}
            feedback={feedback}
            saving={saving}
            save={save}
          />
        ) : (
          <p className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
            {context?.reason || "Đơn hàng này chưa đủ điều kiện để đánh giá."}
          </p>
        )}
      </AsyncState>
    </section>
  );
}
