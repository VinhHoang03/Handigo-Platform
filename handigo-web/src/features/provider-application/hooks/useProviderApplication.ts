import { useEffect, useState } from 'react';
import { providerApplicationService } from '../services/providerApplication.service';
import type { Category, ProviderApplicationPayload } from '../types/providerApplication.types';

export function useProviderApplication() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');

  const loadCategories = () => {
    setLoading(true);
    setLoadError('');
    providerApplicationService.loadCategories()
      .then(setCategories)
      .catch(() => setLoadError('Không thể tải lĩnh vực dịch vụ. Vui lòng thử lại.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let active = true;
    providerApplicationService.loadCategories()
      .then((value) => { if (active) setCategories(value); })
      .catch(() => { if (active) setLoadError('Không thể tải lĩnh vực dịch vụ. Vui lòng thử lại.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const submit = async (payload: ProviderApplicationPayload) => {
    try {
      setSubmitting(true);
      setSubmitError('');
      return await providerApplicationService.submit(payload);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Không thể gửi hồ sơ.');
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  return { categories, loading, submitting, loadError, submitError, loadCategories, submit };
}
