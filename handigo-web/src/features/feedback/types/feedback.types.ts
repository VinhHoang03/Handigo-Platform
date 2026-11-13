export interface PersonRef { _id?: string; id?: string; fullName?: string; avatar?: string; email?: string }
export interface Feedback {
  _id: string;
  id?: string;
  orderId: string | { _id: string; orderCode?: string; status?: string; scheduledAt?: string; createdAt?: string; performedAt?: string | null };
  customerId: string | PersonRef;
  providerId: string | (PersonRef & { userId?: PersonRef });
  serviceId: string | { _id: string; name?: string; image?: string };
  rating: number;
  comment?: string | null;
  images: string[];
  isVisible: boolean;
  providerReply?: { content: string; images?: string[]; repliedAt: string; updatedAt: string; repliedBy?: PersonRef } | null;
  createdAt: string;
  updatedAt?: string;
}
export interface Pagination { page: number; limit: number; total: number; totalPages: number }
export interface FeedbackModerationItem {
  _id: string;
  kind: 'comment' | 'reply';
  resourceId: string;
  content: string;
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
  createdAt: string;
  updatedAt: string;
}
export interface FeedbackModerationList { items: FeedbackModerationItem[]; pagination: Pagination }
export interface ModerationReportQuery {
  days: '7' | '30' | '90' | 'all';
  view: 'attention' | 'blocked' | 'all';
  page: number;
  limit: number;
}
export interface ModerationReport {
  period: { start: string | null; end: string; days: ModerationReportQuery['days'] };
  summary: { total: number; allowed: number; blocked: number; savedHidden: number; hidden: number;
    needsReview: number; unavailable: number; approvedByAdmin: number; rulesBlocked: number };
  items: Array<FeedbackModerationItem & {
    decision: 'allow' | 'block' | 'review';
    source: 'rules' | 'ai' | 'unavailable' | 'unknown';
    needsReview: boolean;
    isCurrent: boolean;
    feedback?: { _id: string; isVisible: boolean; rating: number; updatedAt?: string };
    reviewedAt?: string;
  }>;
  pagination: Pagination;
}
export interface FeedbackList {
  moderationStats?: {
    total: number; averageRating: number; visible: number; hidden: number;
    lowRating: number; hasImages: number; replied: number; fiveStars: number;
  };
  items: Feedback[];
  pagination: Pagination;
  summary?: {
    averageRating: number;
    totalFeedbacks: number;
    ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
  };
}
export interface FeedbackQuery {
  categoryId?: string;
  sort?: 'attention' | 'newest';
  page?: number;
  limit?: number;
  rating?: number | '';
  ratingBelow?: number;
  hasImages?: boolean | '';
  replied?: boolean | '';
  keyword?: string;
  isVisible?: boolean | '';
}
export interface FeedbackPayload { orderId: string; rating: number; comment?: string | null; images?: string[] }
export interface FeedbackOrder {
  _id: string;
  orderCode: string;
  status: string;
  createdAt: string;
  serviceId: string | { _id: string; name?: string; image?: string };
  providerId?: string | (PersonRef & { userId?: PersonRef }) | null;
}
export interface OrderFeedbackContext {
  order: FeedbackOrder;
  feedback: Feedback | null;
  canReview: boolean;
  reason?: string | null;
}
