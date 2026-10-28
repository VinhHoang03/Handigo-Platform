import { useToastFeedback } from "@/components/common/Toast";
import { useCallback, useEffect, useRef, useState } from 'react';
import { feedbackService } from '../services/feedback.service';
import type { FeedbackList, FeedbackPayload, FeedbackQuery, OrderFeedbackContext } from '../types/feedback.types';

export function useOrderFeedback(orderId: string) {
  const isValidOrderId = /^[a-f\d]{24}$/i.test(orderId);
  const [context, setContext] = useState<OrderFeedbackContext | null>(null);
  const [loading, setLoading] = useState(isValidOrderId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(isValidOrderId ? '' : 'Mã đơn hàng không hợp lệ.');
  const requestRevision = useRef(0);
  const invalidateRequests = useCallback(() => { requestRevision.current++; }, []);
  const currentContext = context?.order._id === orderId ? context : null;

  const load = useCallback(async () => {
    const revision = ++requestRevision.current;
    const isCurrent = () => requestRevision.current === revision;
    if (!isValidOrderId) {
      setError('Mã đơn hàng không hợp lệ.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError('');
      const value = await feedbackService.loadOrderContext(orderId);
      if (isCurrent()) setContext(value);
    } catch (requestError) {
      if (isCurrent()) setError(requestError instanceof Error ? requestError.message : 'Không thể tải đánh giá.');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [isValidOrderId, orderId]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) return load(); });
    return () => { active = false; invalidateRequests(); };
  }, [invalidateRequests, load]);

  const save = async (payload: FeedbackPayload, files: File[]) => {
    if (!currentContext || !currentContext.canReview || loading || payload.orderId !== orderId) {
      throw new Error('Thông tin đánh giá chưa khớp đơn hàng. Vui lòng tải lại.');
    }
    const revision = requestRevision.current;
    const isCurrent = () => requestRevision.current === revision;
    setSaving(true);
    setError('');
    try {
      const feedback = await feedbackService.save(currentContext.feedback?._id, payload, files, isCurrent);
      if (isCurrent()) setContext((current) => current?.order._id === orderId ? { ...current, feedback } : current);
    } finally {
      if (isCurrent()) setSaving(false);
    }
  };

  return {
    context: currentContext,
    feedback: currentContext?.feedback || null,
    loading: loading || (isValidOrderId && !currentContext && !error),
    saving,
    error: isValidOrderId ? error : 'Mã đơn hàng không hợp lệ.',
    load,
    save,
  };
}

export function useFeedbackList(mode: 'provider' | 'admin', query: FeedbackQuery, onLoaded?: (result: FeedbackList) => void) {
  const [result, setResult] = useState<FeedbackList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useToastFeedback<string>('', "error");
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const value = await (mode === 'provider' ? feedbackService.loadProvider(query) : feedbackService.loadAdmin(query));
      setResult(value);
      onLoaded?.(value);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể tải danh sách đánh giá.');
    } finally {
      setLoading(false);
    }
  }, [mode, query, setError, onLoaded]);
  useEffect(() => {
    let active = true;
    const request = mode === 'provider'
      ? feedbackService.loadProvider(query)
      : feedbackService.loadAdmin(query);
    request
      .then((value) => {
        if (active) {
          setResult(value);
          onLoaded?.(value);
        }
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Không thể tải danh sách đánh giá.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [mode, query, setError, onLoaded]);
  return { result, loading, error, load };
}
