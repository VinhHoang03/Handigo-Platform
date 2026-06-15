import { useEffect, useState } from 'react';
import { providerApplicationService } from '../services/providerApplication.service';
import type { Category, ProviderApplicationPayload } from '../types/providerApplication.types';

export function useProviderApplication() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    providerApplicationService.loadCategories()
      .then(setCategories)
      .catch(() => setError('Không thể tải lĩnh vực dịch vụ.'))
      .finally(() => setLoading(false));
  }, []);
  const submit = async (payload: ProviderApplicationPayload) => {
    try { setSubmitting(true); setError(''); return await providerApplicationService.submit(payload); }
    catch (e) { setError(e instanceof Error ? e.message : 'Không thể gửi hồ sơ.'); throw e; }
    finally { setSubmitting(false); }
  };
  return { categories, loading, submitting, error, submit };
}
