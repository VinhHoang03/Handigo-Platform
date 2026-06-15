export interface PersonRef { _id?: string; id?: string; fullName?: string; avatar?: string; email?: string }
export interface Feedback {
  _id: string;
  id?: string;
  orderId: string | { _id: string; orderCode?: string; status?: string };
  customerId: string | PersonRef;
  providerId: string | (PersonRef & { userId?: PersonRef });
  serviceId: string | { _id: string; name?: string; image?: string };
  rating: number;
  comment?: string | null;
  images: string[];
  isVisible: boolean;
  providerReply?: { content: string; repliedAt: string; updatedAt: string; repliedBy?: PersonRef } | null;
  createdAt: string;
}
export interface Pagination { page: number; limit: number; total: number; totalPages: number }
export interface FeedbackList {
  items: Feedback[];
  pagination: Pagination;
  summary?: {
    averageRating: number;
    totalFeedbacks: number;
    ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
  };
}
export interface FeedbackQuery {
  page?: number;
  limit?: number;
  rating?: number | '';
  hasImages?: boolean | '';
  replied?: boolean | '';
  keyword?: string;
  isVisible?: boolean | '';
}
export interface FeedbackPayload { orderId: string; rating: number; comment?: string | null; images?: string[] }
