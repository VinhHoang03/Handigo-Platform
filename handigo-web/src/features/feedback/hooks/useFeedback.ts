import { useCallback, useEffect, useState } from 'react';
import { feedbackService } from '../services/feedback.service';
import type { FeedbackList, FeedbackPayload, FeedbackQuery, OrderFeedbackContext } from '../types/feedback.types';

export function useOrderFeedback(orderId: string) {
  const isValidOrderId = /^[a-f\d]{24}$/i.test(orderId);
  const [context, setContext] = useState<OrderFeedbackContext | null>(null);
  const [loading, setLoading] = useState(isValidOrderId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(isValidOrderId ? '' : 'Mã đơn hàng không hợp lệ.');

  const load = useCallback(async () => {
    if (!isValidOrderId) {
      setError('Mã đơn hàng không hợp lệ.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError('');
      setContext(await feedbackService.loadOrderContext(orderId));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể tải đánh giá.');
    } finally {
      setLoading(false);
    }
  }, [isValidOrderId, orderId]);

  useEffect(() => {
    let active = true;
    if (!isValidOrderId) return () => { active = false; };
    feedbackService.loadOrderContext(orderId)
      .then((value) => { if (active) setContext(value); })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Không thể tải đánh giá.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isValidOrderId, orderId]);

  const save = async (payload: FeedbackPayload, files: File[]) => {
    setSaving(true);
    setError('');
    try {
      const feedback = await feedbackService.save(context?.feedback?._id, payload, files);
      setContext((current) => current ? { ...current, feedback } : current);
    } finally {
      setSaving(false);
    }
  };

  return {
    context,
    feedback: context?.feedback || null,
    loading,
    saving,
    error,
    load,
    save,
  };
}

export function useFeedbackList(mode: 'provider' | 'admin', query: FeedbackQuery) {
  const [result, setResult] = useState<FeedbackList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setResult(await (mode === 'provider' ? feedbackService.loadProvider(query) : feedbackService.loadAdmin(query)));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể tải danh sách đánh giá.');
    } finally {
      setLoading(false);
    }
  }, [mode, query]);
  useEffect(() => {
    let active = true;
    const request = mode === 'provider'
      ? feedbackService.loadProvider(query)
      : feedbackService.loadAdmin(query);
    request
      .then((value) => { if (active) setResult(value); })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Không thể tải danh sách đánh giá.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [mode, query]);
  return { result, loading, error, load };
}
