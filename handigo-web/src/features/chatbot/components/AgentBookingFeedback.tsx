import { useEffect, useState, type FormEvent } from "react";
import { feedbackApi } from "@/features/feedback/api/feedback.api";
import type { OrderFeedbackContext } from "@/features/feedback/types/feedback.types";
import { getErrorMessage } from "@/utils/apiError";
import type { AgentSend } from "../types/agent.types";

export function AgentBookingFeedback({ orderId, disabled, onSend, onClose }: {
  orderId: string; disabled: boolean; onSend: AgentSend; onClose: () => void;
}) {
  const [context, setContext] = useState<OrderFeedbackContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const [rating, setRating] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    feedbackApi.getOrderContext(orderId).then((result) => {
      if (!active) return;
      setContext(result); setRating(result.feedback ? String(result.feedback.rating) : ""); setComment(result.feedback?.comment ?? "");
    }).catch((failure) => { if (active) setError(getErrorMessage(failure, "Chưa kiểm tra được đánh giá của đơn.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [orderId, retry]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (disabled || saving || loading || !context?.canReview || !rating) return;
    setSaving(true); setError("");
    try {
      await onSend(`${context.feedback ? "Sửa" : "Gửi"} đánh giá đơn ${context.order.orderCode}: ${rating} sao.`, undefined,
        { type: "feedback", feedback: { orderId, mode: context.feedback ? "update" : "create", rating: Number(rating), comment } });
      onClose();
    } catch (failure) { setError(getErrorMessage(failure, "Chưa chuẩn bị được bản xác nhận đánh giá.")); }
    finally { setSaving(false); }
  };
  return <section aria-label="Đánh giá dịch vụ qua trợ lý" className="border-t border-outline-variant/40 bg-surface-container-lowest p-4">
    <h3 className="font-semibold text-on-surface">{context?.feedback ? "Sửa đánh giá dịch vụ" : "Đánh giá dịch vụ"}</h3>
    {loading ? <p role="status">Đang kiểm tra điều kiện đánh giá…</p> : error && !context ? <div role="alert"><p>{error}</p>
      <button type="button" onClick={() => { setError(""); setLoading(true); setRetry((value) => value + 1); }}>Thử lại</button></div>
      : !context?.canReview ? <p>{context?.reason ?? "Đơn chưa đủ điều kiện đánh giá."}</p> : <form onSubmit={submit} className="mt-3 space-y-3">
        <p className="text-xs">Đơn {context.order.orderCode}. Kiểm tra bản xác nhận trước khi gửi đánh giá.</p>
        <label className="block text-sm">Số sao
          <select aria-label="Số sao đánh giá" value={rating} onChange={(event) => setRating(event.target.value)} required disabled={disabled || saving}
            className="mt-1 min-h-11 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3">
            <option value="">Chọn số sao</option>{[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((value) => <option key={value} value={value}>{value.toLocaleString("vi-VN")} sao</option>)}
          </select>
        </label>
        <label className="block text-sm">Nhận xét
          <textarea aria-label="Nhận xét đánh giá" value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} disabled={disabled || saving}
            className="mt-1 w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-3" />
        </label>
        {error && <p role="alert" className="text-error">{error}</p>}
        <button type="submit" disabled={disabled || saving || !rating} className="min-h-11 rounded-xl bg-primary px-4 text-on-primary disabled:opacity-50">{saving ? "Đang chuẩn bị…" : "Xem trước đánh giá"}</button>
      </form>}
    <button type="button" onClick={onClose} disabled={saving} className="mt-2 min-h-11 px-3 text-sm text-primary">Đóng</button>
  </section>;
}
