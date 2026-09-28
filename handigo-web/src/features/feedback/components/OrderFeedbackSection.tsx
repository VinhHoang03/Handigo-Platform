import { AsyncState } from "@/components/common/AsyncState";
import { useState } from "react";
import { useOrderFeedback } from "../hooks/useFeedback";
import { FeedbackForm } from "./FeedbackForm";
import { FeedbackCard } from "./FeedbackCard";
import type { FeedbackPayload } from "../types/feedback.types";
import { Pencil, Star } from "lucide-react";

export function OrderFeedbackSection({ orderId }: { orderId: string }) {
  const { context, feedback, loading, saving, error, load, save } =
    useOrderFeedback(orderId);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const isEditing = editingOrderId === orderId;
  const saveFeedback = async (payload: FeedbackPayload, files: File[]) => {
    await save(payload, files);
    setEditingOrderId(null);
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-outline-variant bg-surface-container-lowest p-md shadow-sm sm:p-lg">
      <div className="mb-lg flex items-start gap-3">
        <Star aria-hidden="true" size={24} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-tertiary/10 text-tertiary" />
        <div className="flex-1">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            {feedback ? "Đánh giá của bạn" : "Đánh giá dịch vụ"}
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Chia sẻ trải nghiệm thực tế để Handigo cải thiện chất lượng dịch vụ.
          </p>
        </div>
        {feedback && context?.canReview && !loading && !error && (
          isEditing ? (
            <button type="button" disabled={saving} onClick={() => setEditingOrderId(null)} className="btn-secondary">
              Hủy chỉnh sửa
            </button>
          ) : (
            <button
              type="button"
              aria-label="Chỉnh sửa đánh giá"
              title="Chỉnh sửa đánh giá"
              onClick={() => setEditingOrderId(orderId)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-primary hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <Pencil size={18} aria-hidden="true" />
            </button>
          )
        )}
      </div>

      <AsyncState loading={loading} error={error} onRetry={() => void load()}>
        {feedback && (!isEditing || !context?.canReview) ? (
          <FeedbackCard feedback={feedback} replyLabel="Phản hồi của thợ" />
        ) : context?.canReview ? (
          <FeedbackForm
            key={feedback?._id || orderId}
            orderId={orderId}
            feedback={feedback}
            saving={saving}
            save={saveFeedback}
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
