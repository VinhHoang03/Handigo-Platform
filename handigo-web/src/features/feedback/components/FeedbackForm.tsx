import { useEffect, useId, useMemo, useState } from 'react';
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
  const previews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files],
  );

  useEffect(
    () => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)),
    [previews],
  );

  const selectFiles = (selectedFiles: File[]) => {
    const remaining = 5 - existingImages.length;
    const invalidFile = selectedFiles.find(
      (file) => !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024,
    );
    if (invalidFile) {
      setMessage('Mỗi tệp phải là hình ảnh và có dung lượng không quá 5 MB.');
      return;
    }
    if (selectedFiles.length > remaining) {
      setMessage(`Bạn chỉ có thể chọn thêm tối đa ${remaining} ảnh.`);
    } else {
      setMessage('');
    }
    setFiles(selectedFiles.slice(0, remaining));
  };

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
          onChange={(event) => {
            selectFiles(Array.from(event.target.files || []));
            event.target.value = '';
          }}
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
          {previews.map(({ file, url }) => (
            <button
              type="button"
              key={`${file.name}-${file.size}-${file.lastModified}`}
              onClick={() => setFiles((items) => items.filter((item) => item !== file))}
              className="group relative"
              aria-label={`Bỏ ảnh ${file.name}`}
            >
              <img src={url} alt={`Ảnh xem trước ${file.name}`} className="h-20 w-20 rounded-xl object-cover" />
              <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/65 text-white opacity-0 transition group-hover:opacity-100 group-focus:opacity-100">
                <X size={13} />
              </span>
            </button>
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
