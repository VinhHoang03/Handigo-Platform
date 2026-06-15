import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AsyncState } from '@/components/common/AsyncState';
import { DashboardShell } from '@/components/common/DashboardShell';
import { RatingStars } from '@/components/common/RatingStars';
import { useOrderFeedback } from '../hooks/useFeedback';

export default function CustomerFeedbackPage() {
  const { orderId = '' } = useParams();
  const navigate = useNavigate();
  const { feedback, loading, saving, error, load, save } = useOrderFeedback(orderId);

  return (
    <DashboardShell role="CUSTOMER">
      <div className="mx-auto max-w-3xl">
        <button onClick={() => navigate(-1)} className="mb-4 text-primary">← Quay lại</button>
        <div className="glass-card rounded-3xl p-6 md:p-10">
          <h1 className="text-headline-lg font-bold">{feedback ? 'Chỉnh sửa đánh giá' : 'Đánh giá dịch vụ'}</h1>
          <p className="mt-2 text-on-surface-variant">Đánh giá này được liên kết trực tiếp với đơn hàng của bạn.</p>
          <AsyncState loading={loading} error={error} onRetry={load}>
            <FeedbackForm key={feedback?._id || 'new'} orderId={orderId} feedback={feedback} saving={saving} save={save} />
          </AsyncState>
        </div>
      </div>
    </DashboardShell>
  );
}

function FeedbackForm({ orderId, feedback, saving, save }: {
  orderId: string;
  feedback: ReturnType<typeof useOrderFeedback>['feedback'];
  saving: boolean;
  save: ReturnType<typeof useOrderFeedback>['save'];
}) {
  const [rating, setRating] = useState(feedback?.rating || 0);
  const [comment, setComment] = useState(feedback?.comment || '');
  const [existingImages, setExistingImages] = useState<string[]>(feedback?.images || []);
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rating) { setMessage('Vui lòng chọn số sao.'); return; }
    if (existingImages.length + files.length > 5) { setMessage('Chỉ được tải tối đa 5 ảnh.'); return; }
    try {
      await save({ orderId, rating, comment: comment.trim() || null, images: existingImages }, files);
      setFiles([]);
      setMessage(feedback ? 'Đã cập nhật đánh giá.' : 'Đã gửi đánh giá.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Không thể lưu đánh giá.'); }
  };
  return <form onSubmit={submit} className="mt-8 space-y-6">
    <div><label className="mb-2 block font-semibold">Mức độ hài lòng</label><RatingStars value={rating} editable onChange={setRating} size="lg" /></div>
    <div><label className="mb-2 block font-semibold">Nhận xét</label><textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} rows={5} className="w-full rounded-2xl border border-outline-variant bg-surface p-4 outline-none focus:border-primary" placeholder="Chia sẻ trải nghiệm của bạn..." /></div>
    <div><label className="mb-2 block font-semibold">Hình ảnh ({existingImages.length + files.length}/5)</label><input type="file" multiple accept="image/*" disabled={existingImages.length + files.length >= 5} onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 5 - existingImages.length))} /><div className="mt-3 flex flex-wrap gap-2">{existingImages.map((image) => <button type="button" key={image} onClick={() => setExistingImages((items) => items.filter((item) => item !== image))}><img src={image} className="h-20 w-20 rounded-xl object-cover" /></button>)}{files.map((file) => <div key={`${file.name}-${file.size}`} className="flex h-20 w-20 items-center justify-center rounded-xl bg-surface-container-low p-2 text-center text-xs">{file.name}</div>)}</div></div>
    {message && <p className="rounded-xl bg-primary/10 p-3 text-primary">{message}</p>}
    <button disabled={saving} className="w-full rounded-2xl bg-primary py-3.5 font-bold text-on-primary disabled:opacity-50">{saving ? 'Đang lưu...' : feedback ? 'Cập nhật đánh giá' : 'Gửi đánh giá'}</button>
  </form>;
}
