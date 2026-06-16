import { useId, useState } from 'react';
import { ImagePlus, Send, X } from 'lucide-react';
import { FloatingTextarea } from '@/components/common/FloatingField';
import { RatingStars } from '@/components/common/RatingStars';
import type { Feedback, FeedbackPayload } from '../types/feedback.types';

interface Props {
  orderId: string;
  feedback: Feedback | null;
  saving: boolean;
  save: (payload: FeedbackPayload, files: File[]) => Promise<void>;
}

export function FeedbackForm({ orderId, feedback, saving, save }: Props) {
  const fileInputId = useId();
  const [rating, setRating] = useState(feedback?.rating || 0);
  const [comment, setComment] = useState(feedback?.comment || '');
  const [existingImages, setExistingImages] = useState<string[]>(feedback?.images || []);
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rating) {
      setMessage('Vui lòng chọn số sao.');
      return;
    }
    if (existingImages.length + files.length > 5) {
      setMessage('Chỉ được tải tối đa 5 ảnh.');
      return;
    }

    try {
      await save({ orderId, rating, comment: comment.trim() || null, images: existingImages }, files);
      setFiles([]);
      setMessage(feedback ? 'Đã cập nhật đánh giá.' : 'Đã gửi đánh giá.');
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : 'Không thể lưu đánh giá.');
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <label className="mb-2 block font-semibold">Mức độ hài lòng</label>
        <RatingStars value={rating} editable onChange={setRating} size="lg" />
      </div>

      <FloatingTextarea
        id="feedback-comment"
        label="Chia sẻ trải nghiệm của bạn"
        value={comment}
        maxLength={1000}
        rows={5}
        onValueChange={setComment}
        hint={`${comment.length}/1000 ký tự`}
      />

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 font-semibold" htmlFor={fileInputId}>
            <ImagePlus size={18} /> Hình ảnh ({existingImages.length + files.length}/5)
          </label>
          <label
            htmlFor={fileInputId}
            className={`btn-secondary min-h-10 px-4 py-2 text-sm ${existingImages.length + files.length >= 5 ? 'pointer-events-none opacity-50' : ''}`}
          >
            Chọn ảnh
          </label>
        </div>
        <input
          id={fileInputId}
          type="file"
          multiple
          accept="image/*"
          className="sr-only"
          disabled={existingImages.length + files.length >= 5}
          onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 5 - existingImages.length))}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {existingImages.map((image) => (
            <button
              type="button"
              key={image}
              onClick={() => setExistingImages((items) => items.filter((item) => item !== image))}
              className="group relative"
              aria-label="Xóa ảnh đánh giá"
            >
              <img src={image} alt="Ảnh đánh giá" className="h-20 w-20 rounded-xl object-cover" />
              <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/65 text-white opacity-0 transition group-hover:opacity-100">
                <X size={13} />
              </span>
            </button>
          ))}
          {files.map((file) => (
            <div
              key={`${file.name}-${file.size}`}
              className="flex h-20 w-20 items-center justify-center rounded-xl bg-surface-container-low p-2 text-center text-xs text-on-surface-variant"
            >
              {file.name}
            </div>
          ))}
        </div>
      </div>

      {message && <p className="rounded-2xl bg-primary/10 p-3 text-primary">{message}</p>}
      <button disabled={saving} className="btn-primary w-full">
        <Send size={18} /> {saving ? 'Đang lưu...' : feedback ? 'Cập nhật đánh giá' : 'Gửi đánh giá'}
      </button>
    </form>
  );
}
