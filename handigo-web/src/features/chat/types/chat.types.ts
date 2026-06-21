export interface ChatMessage {
  _id: string;
  conversationId: string;
  senderId: string | { _id: string; fullName?: string; avatar?: string };
  messageType: 'text' | 'image';
  content?: string | null;
  imageUrl?: string | null;
  status?: 'sent' | 'seen';
  createdAt: string;
}
export interface Conversation {
  _id: string;
  orderId: string | { _id: string; orderCode?: string; status?: string };
  customerId?: string | { _id: string; fullName?: string; avatar?: string | null };
  providerId?: string | {
    _id: string;
    userId?: string | { _id: string; fullName?: string; avatar?: string | null };
  };
  customerLastSeenAt?: string | null;
  providerLastSeenAt?: string | null;
  lastMessage?: {
    senderId?: string;
    messageType?: 'text' | 'image';
    content?: string;
    sentAt?: string;
  } | null;
}
export interface ConversationPage {
  items: Conversation[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
export interface MessagePage {
  items: ChatMessage[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
