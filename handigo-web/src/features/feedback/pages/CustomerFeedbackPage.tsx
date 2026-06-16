import { AlertCircle, ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { AsyncState } from '@/components/common/AsyncState';
import { DashboardShell } from '@/components/common/DashboardShell';
import { FeedbackForm } from '../components/FeedbackForm';
import { OrderFeedbackSummary } from '../components/OrderFeedbackSummary';
import { useOrderFeedback } from '../hooks/useFeedback';

export default function CustomerFeedbackPage() {
  const { orderId = '' } = useParams();
  const navigate = useNavigate();
  const { context, feedback, loading, saving, error, load, save } = useOrderFeedback(orderId);

  return (
    <DashboardShell role="CUSTOMER">
      <div className="mx-auto max-w-3xl">
        <button type="button" onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-2 text-primary"><ArrowLeft size={18} /> Quay lại</button>
        <div className="glass-card rounded-lg p-6 md:p-10">
          <h1 className="text-headline-lg font-bold">{feedback ? 'Chỉnh sửa đánh giá' : 'Đánh giá dịch vụ'}</h1>
          <p className="mb-6 mt-2 text-on-surface-variant">Đánh giá được liên kết trực tiếp với đơn hàng của bạn.</p>
          <AsyncState loading={loading} error={error} onRetry={load}>
            {context && (
              <>
                <OrderFeedbackSummary order={context.order} />
                {context.canReview ? (
                  <FeedbackForm key={feedback?._id || 'new'} orderId={orderId} feedback={feedback} saving={saving} save={save} />
                ) : (
                  <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-800"><AlertCircle className="shrink-0" size={20} /><p>{context.reason}</p></div>
                )}
              </>
            )}
          </AsyncState>
        </div>
      </div>
    </DashboardShell>
  );
}
