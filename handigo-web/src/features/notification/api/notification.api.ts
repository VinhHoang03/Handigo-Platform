import api from '@/api/client';
import { unwrap } from '@/api/response';
import type {
  AppNotification,
  ListResult,
  MarkAllReadResult,
  NotificationQuery,
  SendSystemNotificationPayload,
  SendSystemNotificationResult,
  UnreadCountResult,
} from '../types/notification.types';

const toQueryParams = (query: NotificationQuery) => ({
  ...query,
  type: query.type || undefined,
  isRead: query.isRead === '' ? undefined : query.isRead,
  targetRole: query.targetRole || undefined,
});

export const notificationApi = {
  list: async (query: NotificationQuery) =>
    unwrap<ListResult<AppNotification>>(
      await api.get('/notifications', { params: toQueryParams(query) }),
    ),

  unreadCount: async () =>
    unwrap<UnreadCountResult>(await api.get('/notifications/unread-count')),

  adminList: async (query: NotificationQuery) =>
    unwrap<ListResult<AppNotification>>(
      await api.get('/notifications/admin', { params: toQueryParams(query) }),
    ),

  markAsRead: async (id: string) =>
    unwrap<AppNotification>(await api.patch(`/notifications/${id}/read`)),

  markAllAsRead: async () =>
    unwrap<MarkAllReadResult>(await api.patch('/notifications/read-all')),

  sendSystem: async (payload: SendSystemNotificationPayload) =>
    unwrap<SendSystemNotificationResult>(
      await api.post('/notifications/send', payload),
    ),
};
