export type NotificationType =
  | 'ORDER'
  | 'PAYMENT'
  | 'QUOTATION'
  | 'WITHDRAWAL'
  | 'PROMOTION'
  | 'SYSTEM';

export type NotificationTargetRole = 'CUSTOMER' | 'PROVIDER' | 'ALL';

export interface AppNotification {
  id: string;
  userId: string | { _id?: string; id?: string };
  recipient?: {
    id: string;
    fullName?: string;
    email?: string;
    role?: NotificationTargetRole;
  } | null;
  type: NotificationType;
  title: string;
  content: string;
  data?: Record<string, unknown> | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationQuery {
  page?: number;
  limit?: number;
  isRead?: boolean | '';
  type?: NotificationType | '';
  targetRole?: NotificationTargetRole | '';
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ListResult<T> {
  items: T[];
  pagination: Pagination;
}

export interface UnreadCountResult {
  count: number;
}

export interface MarkAllReadResult {
  modifiedCount: number;
}

export interface SendSystemNotificationPayload {
  targetRole: NotificationTargetRole;
  title: string;
  content: string;
  type: 'SYSTEM';
  data?: Record<string, unknown> | null;
}

export interface SendSystemNotificationResult {
  targetRole: NotificationTargetRole;
  sentCount: number;
}
