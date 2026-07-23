import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { ReliableImage } from '@/components/common/ReliableImage';
import { feedbackApi } from '@/features/feedback/api/feedback.api';
import type { Feedback, PersonRef } from '@/features/feedback/types/feedback.types';
import { FeedbackImageGallery } from './orders/FeedbackImageGallery';
import { FeedbackReplyForm } from './orders/FeedbackReplyForm';
import { CircleAlert, Hammer, Star, X } from "lucide-react";

const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_REPLY_LENGTH = 1000;

const formatDate = (value: string) =>
  new Date(value).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });

const customerOf = (feedback: Feedback) =>
  typeof feedback.customerId === 'string' ? undefined : feedback.customerId;

export function ProviderOrderFeedbackThread({ orderId }: { orderId: string }) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previewImage, setPreviewImage] = useState('');

  const previewUrls = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files],
  );

  useEffect(() => () => previewUrls.forEach(({ url }) => URL.revokeObjectURL(url)), [previewUrls]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (!cancelled) {
        setLoading(true);
        setLoadError('');
      }
      try {
        const result = await feedbackApi.getProviderFeedbackByOrder(orderId);
        if (!cancelled) setFeedback(result);
      } catch {
        if (!cancelled) setLoadError('Không thể tải đánh giá của đơn hàng.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [orderId]);

  const handleFiles = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    setSubmitError('');
    const incoming = Array.from(selectedFiles);
    const invalidType = incoming.find((file) => !file.type.startsWith('image/'));
    const oversized = incoming.find((file) => file.size > MAX_IMAGE_SIZE);
    if (invalidType) {
      setSubmitError('Chỉ hỗ trợ tệp hình ảnh.');
      return;
    }
    if (oversized) {
      setSubmitError('Mỗi ảnh không được vượt quá 5 MB.');
      return;
    }
    if (files.length + incoming.length > MAX_IMAGES) {
      setSubmitError(`Chỉ được tải tối đa ${MAX_IMAGES} ảnh.`);
      return;
    }
    setFiles((current) => [...current, ...incoming]);
  };

  const submitReply = async () => {
    if (!feedback || feedback.providerReply || !content.trim()) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const images = files.length ? await feedbackApi.uploadReplyImages(files) : [];
      const updated = await feedbackApi.reply(feedback._id, content.trim(), images);
      setFeedback(updated);
      setContent('');
      setFiles([]);
    } catch (error) {
      const message = axios.isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message
        : undefined;
      setSubmitError(message || 'Không thể gửi phản hồi. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const customer = feedback ? customerOf(feedback) as PersonRef | undefined : undefined;

  return (
    <section className="overflow-hidden rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-md sm:p-lg">
      <div className="mb-md">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Trao đổi sau dịch vụ</p>
        <h2 className="mt-1 font-headline-md text-headline-md text-on-surface">Đánh giá của khách hàng</h2>
        <p className="mt-1 text-sm text-on-surface-variant">Xem đánh giá và gửi một phản hồi chính thức cho khách hàng.</p>
      </div>

      {loading ? (
        <div className="space-y-3" aria-label="Đang tải đánh giá" aria-busy="true">
          <div className="h-28 animate-pulse rounded-2xl bg-surface-container-low" />
          <div className="ml-0 h-20 animate-pulse rounded-2xl bg-primary/5 sm:ml-10" />
        </div>
      ) : loadError ? (
        <div className="flex items-center gap-3 rounded-2xl bg-error/10 p-4 text-sm text-error">
          <CircleAlert aria-hidden="true" size={24} />
          {loadError}
        </div>
      ) : !feedback ? (
        <div className="rounded-2xl border-2 border-dashed border-outline-variant/40 bg-surface-container-low/40 px-5 py-10 text-center">
          <Star aria-hidden="true" size={36} className="text-outline" />
          <p className="mt-2 font-bold text-on-surface">Chưa có đánh giá</p>
          <p className="mt-1 text-sm text-on-surface-variant">Đánh giá của khách hàng sẽ xuất hiện tại đây sau khi được gửi.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <article className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <InitialsAvatar
                  name={customer?.fullName || 'Khách hàng'}
                  src={customer?.avatar}
                  className="h-11 w-11 shrink-0"
                />
                <div className="min-w-0">
                  <p className="truncate font-bold text-on-surface">{customer?.fullName || 'Khách hàng'}</p>
                  <p className="text-xs text-on-surface-variant">{formatDate(feedback.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-0.5" aria-label={`${feedback.rating} trên 5 sao`}>
                {Array.from({ length: 5 }, (_, index) => (
                  <span key={index} className={`material-symbols-outlined text-xl ${index < feedback.rating ? 'text-amber-500' : 'text-outline-variant'}`} style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                ))}
              </div>
            </div>
            <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-on-surface">
              {feedback.comment || 'Khách hàng đã đánh giá dịch vụ nhưng không để lại nhận xét.'}
            </p>
            <FeedbackImageGallery images={feedback.images || []} onPreview={setPreviewImage} />
          </article>

          <div className="relative pl-0 sm:pl-10">
            <span className="absolute left-5 top-[-16px] hidden h-6 w-px bg-outline-variant sm:block" />
            {feedback.providerReply ? (
              <article className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-primary">
                    <Hammer aria-hidden="true" size={24} />
                    <p className="font-bold">Phản hồi của bạn</p>
                  </div>
                  <time className="text-xs text-on-surface-variant">{formatDate(feedback.providerReply.repliedAt)}</time>
                </div>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-on-surface">{feedback.providerReply.content}</p>
                <FeedbackImageGallery images={feedback.providerReply.images || []} onPreview={setPreviewImage} />
              </article>
            ) : (
              <FeedbackReplyForm
                content={content}
                onContentChange={setContent}
                maxContentLength={MAX_REPLY_LENGTH}
                previewUrls={previewUrls}
                onRemoveFile={(index) => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                onFilesSelected={handleFiles}
                maxImages={MAX_IMAGES}
                submitting={submitting}
                submitError={submitError}
                onSubmit={() => void submitReply()}
              />
            )}
          </div>
        </div>
      )}

      {previewImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label="Xem ảnh đánh giá" onClick={() => setPreviewImage('')}>
          <button type="button" onClick={() => setPreviewImage('')} className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-container-lowest/90 text-on-surface" aria-label="Đóng ảnh">
            <X aria-hidden="true" size={24} />
          </button>
          <ReliableImage src={previewImage} alt="Ảnh đánh giá phóng lớn" className="max-h-[90vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl" onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </section>
  );
}
