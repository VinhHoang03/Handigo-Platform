import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../api/admin.api';
import type { AdminApplication, AdminQuery, AdminUser, ListResult } from '../types/admin.types';

export function useAdminList(mode: 'users' | 'applications', query: AdminQuery) {
  const [result, setResult] = useState<ListResult<AdminUser | AdminApplication> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      setLoading(true); setError('');
      setResult(mode === 'users' ? await adminApi.users(query) : await adminApi.applications(query));
    } catch (e) { setError(e instanceof Error ? e.message : 'Không thể tải dữ liệu.'); }
    finally { setLoading(false); }
  }, [mode, query]);
  useEffect(() => {
    let active = true;
    const request = mode === 'users' ? adminApi.users(query) : adminApi.applications(query);
    request
      .then((value) => { if (active) setResult(value); })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : 'Không thể tải dữ liệu.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [mode, query]);
  return { result, loading, error, load };
}
