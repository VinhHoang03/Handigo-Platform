import { useCallback, useEffect, useState } from 'react';
import { feedbackService } from '../services/feedback.service';
import type { Feedback, FeedbackList, FeedbackPayload, FeedbackQuery } from '../types/feedback.types';

export function useOrderFeedback(orderId: string) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setLoading(true); setError(''); setFeedback(await feedbackService.loadOrderFeedback(orderId)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Không thể tải đánh giá.'); }
    finally { setLoading(false); }
  }, [orderId]);
  useEffect(() => {
    let active = true;
    feedbackService.loadOrderFeedback(orderId)
      .then((value) => { if (active) setFeedback(value); })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : 'Không thể tải đánh giá.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [orderId]);
  const save = async (payload: FeedbackPayload, files: File[]) => {
    setSaving(true); setError('');
    try { setFeedback(await feedbackService.save(feedback?._id, payload, files)); }
    finally { setSaving(false); }
  };
  return { feedback, loading, saving, error, load, save };
}

export function useFeedbackList(mode: 'provider' | 'admin', query: FeedbackQuery) {
  const [result, setResult] = useState<FeedbackList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      setLoading(true); setError('');
      setResult(await (mode === 'provider' ? feedbackService.loadProvider(query) : feedbackService.loadAdmin(query)));
    } catch (e) { setError(e instanceof Error ? e.message : 'Không thể tải danh sách đánh giá.'); }
    finally { setLoading(false); }
  }, [mode, query]);
  useEffect(() => {
    let active = true;
    const request = mode === 'provider' ? feedbackService.loadProvider(query) : feedbackService.loadAdmin(query);
    request
      .then((value) => { if (active) setResult(value); })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : 'Không thể tải danh sách đánh giá.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [mode, query]);
  return { result, loading, error, load };
}
