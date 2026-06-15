import { feedbackApi } from '../api/feedback.api';
import type { FeedbackPayload, FeedbackQuery } from '../types/feedback.types';

export const feedbackService = {
  loadOrderFeedback: feedbackApi.getByOrder,
  save: async (feedbackId: string | undefined, payload: FeedbackPayload, newImages: File[]) => {
    const uploaded = newImages.length ? await feedbackApi.uploadImages(newImages) : [];
    const finalPayload = { ...payload, images: [...(payload.images || []), ...uploaded] };
    return feedbackId
      ? feedbackApi.update(feedbackId, finalPayload)
      : feedbackApi.create(finalPayload);
  },
  loadProvider: (query: FeedbackQuery) => feedbackApi.providerList(query),
  loadAdmin: (query: FeedbackQuery) => feedbackApi.adminList(query),
  reply: feedbackApi.reply,
  setVisibility: feedbackApi.setVisibility,
};
