import { useToastFeedback } from "@/components/common/Toast";
import { useCallback, useEffect, useRef, useState } from 'react';
import { providerApplicationService } from '../services/providerApplication.service';
import type {
  Category,
  ProviderApplication,
  ProviderApplicationPayload,
  ProviderApplicationDraftPayload,
} from '../types/providerApplication.types';

export function useProviderApplication(applicationId?: string | null) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [application, setApplication] = useState<ProviderApplication | null>(null);
  const [loadedApplication, setLoadedApplication] = useState<ProviderApplication | null>(null);
  const loadVersion = useRef(0);
  const draftQueue = useRef<Promise<unknown>>(Promise.resolve());
  const submitLocked = useRef(false);
  const submitted = useRef(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [loadError, setLoadError] = useToastFeedback<string>('', "error");
  const [submitError, setSubmitError] = useToastFeedback<string>('', "error");
  const [draftError, setDraftError] = useToastFeedback<string>('', "error");

  const loadData = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setLoadError('');
    try {
      const [categoryValue, applicationValue] = await Promise.all([
        providerApplicationService.loadCategories(),
        applicationId
          ? providerApplicationService.loadDetail(applicationId)
          : providerApplicationService.loadMine(),
      ]);
      if (version !== loadVersion.current) return;
      setCategories(categoryValue);
      setApplication(applicationValue);
      setLoadedApplication(applicationValue);
    } catch {
      if (version === loadVersion.current) {
        setLoadError('Không thể tải dịch vụ hoặc hồ sơ. Vui lòng thử lại.');
      }
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [applicationId, setLoadError]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => {
      window.clearTimeout(timer);
      loadVersion.current += 1;
    };
  }, [loadData]);

  const submit = async (payload: ProviderApplicationPayload) => {
    if (submitLocked.current || submitted.current ||
      application?.status === 'pending' || application?.status === 'resubmitted') {
      throw new Error('Hồ sơ đang được gửi hoặc đang chờ xét duyệt.');
    }
    submitLocked.current = true;
    try {
      setSubmitting(true);
      setSubmitError('');
      await draftQueue.current;
      const resubmitId =
        application?.status === 'rejected' ? application._id : null;
      const result = await (resubmitId
        ? providerApplicationService.resubmit(resubmitId, payload)
        : providerApplicationService.submit(payload));
      submitted.current = true;
      setApplication(result);
      return result;
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Không thể gửi hồ sơ.',
      );
      throw error;
    } finally {
      submitLocked.current = false;
      setSubmitting(false);
    }
  };

  const saveDraft = useCallback((payload: ProviderApplicationDraftPayload) => {
    const save = draftQueue.current.then(async () => {
      if (submitLocked.current || submitted.current) return;
      try {
        setSavingDraft(true);
        setDraftError('');
        const draft = await providerApplicationService.saveDraft(payload);
        setApplication(draft);
        return draft;
      } catch (error) {
        setDraftError(
          error instanceof Error ? error.message : 'Không thể lưu nháp hồ sơ.',
        );
        throw error;
      } finally {
        setSavingDraft(false);
      }
    });
    draftQueue.current = save.catch(() => undefined);
    return save;
  }, [setDraftError]);

  return {
    categories,
    application,
    loadedApplication,
    loading,
    submitting,
    savingDraft,
    loadError,
    submitError,
    draftError,
    loadData,
    submit,
    saveDraft,
    uploadImage: providerApplicationService.uploadImage,
  };
}
