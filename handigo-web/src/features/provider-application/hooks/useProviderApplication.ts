import { useCallback, useEffect, useState } from 'react';
import { providerApplicationService } from '../services/providerApplication.service';
import type {
  Category,
  ProviderApplication,
  ProviderApplicationPayload,
} from '../types/providerApplication.types';

export function useProviderApplication(applicationId?: string | null) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [application, setApplication] = useState<ProviderApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [draftError, setDraftError] = useState('');

  const loadCategories = () => {
    setLoading(true);
    setLoadError('');
    providerApplicationService
      .loadCategories()
      .then(setCategories)
      .catch(() =>
        setLoadError('Không thể tải lĩnh vực dịch vụ. Vui lòng thử lại.'),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      providerApplicationService.loadCategories(),
      applicationId
        ? providerApplicationService.loadDetail(applicationId)
        : providerApplicationService.loadMine(),
    ])
      .then(([categoryValue, applicationValue]) => {
        if (!active) return;
        setCategories(categoryValue);
        setApplication(applicationValue);
      })
      .catch(() => {
        if (active) {
          setLoadError('Không thể tải lĩnh vực dịch vụ. Vui lòng thử lại.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [applicationId]);

  const submit = async (payload: ProviderApplicationPayload) => {
    try {
      setSubmitting(true);
      setSubmitError('');
      return await (applicationId
        ? providerApplicationService.resubmit(applicationId, payload)
        : providerApplicationService.submit(payload));
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Không thể gửi hồ sơ.',
      );
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  const saveDraft = useCallback(async (payload: ProviderApplicationPayload) => {
    try {
      setSavingDraft(true);
      setDraftError('');
      const draft = await providerApplicationService.saveDraft(payload);
      setApplication(draft);
      return draft;
    } catch (error) {
      setDraftError(
        error instanceof Error ? error.message : 'KhÃ´ng thá»ƒ lÆ°u nhÃ¡p há»“ sÆ¡.',
      );
      throw error;
    } finally {
      setSavingDraft(false);
    }
  }, []);

  return {
    categories,
    application,
    loading,
    submitting,
    savingDraft,
    loadError,
    submitError,
    draftError,
    loadCategories,
    submit,
    saveDraft,
    uploadImage: providerApplicationService.uploadImage,
  };
}
