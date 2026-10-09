import { useState } from 'react';
import { AlertCircle, ArrowLeft, Pencil } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { AsyncState } from '@/components/common/AsyncState';
import { DashboardShell } from '@/components/common/DashboardShell';
import { FeedbackForm } from '../components/FeedbackForm';
import { FeedbackCard } from '../components/FeedbackCard';
import type { FeedbackPayload } from '../types/feedback.types';
import { OrderFeedbackSummary } from '../components/OrderFeedbackSummary';
import { useOrderFeedback } from '../hooks/useFeedback';

export default function CustomerFeedbackPage() {
  const { orderId = '' } = useParams();
  const navigate = useNavigate();
  const { context, feedback, loading, saving, error, load, save } = useOrderFeedback(orderId);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const isEditing = editingOrderId === orderId;

  const saveFeedback = async (payload: FeedbackPayload, files: File[]) => {
    await save(payload, files);
    setEditingOrderId(null);
  };

  return (
    <DashboardShell role="CUSTOMER">
      <div className="mx-auto max-w-3xl">
        <button type="button" onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-2 text-primary"><ArrowLeft size={18} /> Quay lại</button>
        <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-6 md:p-10">
          <h1 className="text-headline-lg font-bold">{feedback ? isEditing ? 'Chỉnh sửa đánh giá' : 'Đánh giá của bạn' : 'Đánh giá dịch vụ'}</h1>
          <p className="mb-6 mt-2 text-on-surface-variant">Đánh giá được liên kết trực tiếp với đơn hàng của bạn.</p>
          <AsyncState loading={loading} error={error} onRetry={load}>
            {context && (
              <>
                <OrderFeedbackSummary order={context.order} />
                {feedback && (!isEditing || !context.canReview) && (
                  <FeedbackCard
                    feedback={feedback}
                    replyLabel="Phản hồi của thợ"
                    headerActions={context.canReview ? (
                      <button
                        type="button"
                        aria-label="Chỉnh sửa đánh giá"
                        title="Chỉnh sửa đánh giá"
                        onClick={() => setEditingOrderId(orderId)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-primary hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        <Pencil size={18} aria-hidden="true" />
                      </button>
                    ) : undefined}
                  />
                )}
                {context.canReview && (!feedback || isEditing) && (
                  <FeedbackForm key={feedback?._id || orderId} orderId={orderId} feedback={feedback} saving={saving} save={saveFeedback} onCancel={feedback ? () => setEditingOrderId(null) : undefined} />
                )}
                {!context.canReview && (
                  <div className="flex gap-3 rounded-lg border border-warning/30 bg-warning-container p-4 text-on-warning-container"><AlertCircle className="shrink-0" size={20} /><p>{context.reason}</p></div>
                )}
              </>
            )}
          </AsyncState>
        </div>
      </div>
    </DashboardShell>
  );
}
