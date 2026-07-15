import api from '@/api/client';
import { unwrap } from '@/api/response';
import type {
  SystemConfig,
  SystemConfigPayload,
  SystemConfigQuery,
  UpdateSystemConfigPayload,
} from '../types/systemConfig.types';

const toParams = (query: SystemConfigQuery) => ({
  ...query,
  type: query.type || undefined,
  isPublic: query.isPublic === '' ? undefined : query.isPublic,
  search: query.search?.trim() || undefined,
});

export const systemConfigApi = {
  list: async (query: SystemConfigQuery) =>
    unwrap<SystemConfig[]>(await api.get('/system-configs', { params: toParams(query) })),

  getByKey: async (key: string) =>
    unwrap<SystemConfig>(await api.get(`/system-configs/${encodeURIComponent(key)}`)),

  create: async (payload: SystemConfigPayload) =>
    unwrap<SystemConfig>(await api.post('/system-configs', payload)),

  update: async (key: string, payload: UpdateSystemConfigPayload) =>
    unwrap<SystemConfig>(await api.patch(`/system-configs/${encodeURIComponent(key)}`, payload)),
};
