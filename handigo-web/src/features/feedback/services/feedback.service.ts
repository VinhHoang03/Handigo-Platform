import axios from 'axios';
import { feedbackApi } from '../api/feedback.api';
import type { FeedbackPayload, FeedbackQuery } from '../types/feedback.types';

export const feedbackService = {
  loadOrderContext: feedbackApi.getOrderContext,
  loadOrderFeedback: feedbackApi.getByOrder,
  save: async (feedbackId: string | undefined, payload: FeedbackPayload, newImages: File[]) => {
    try {
      const uploaded = newImages.length ? await feedbackApi.uploadImages(newImages) : [];
      const finalPayload = { ...payload, images: [...(payload.images || []), ...uploaded] };
      return feedbackId
        ? feedbackApi.update(feedbackId, finalPayload)
        : feedbackApi.create(finalPayload);
    } catch (error) {
      if (axios.isAxiosError<{ message?: string }>(error)) {
        throw new Error(error.response?.data?.message || 'Không thể tải ảnh hoặc lưu đánh giá.', { cause: error });
      }
      throw new Error('Không thể tải ảnh hoặc lưu đánh giá.', { cause: error });
    }
  },
  loadProvider: (query: FeedbackQuery) => feedbackApi.providerList(query),
  loadAdmin: (query: FeedbackQuery) => feedbackApi.adminList(query),
  reply: feedbackApi.reply,
  setVisibility: feedbackApi.setVisibility,
};
