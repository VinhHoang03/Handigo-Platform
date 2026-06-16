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
  orderId: string;
  lastMessage?: { content?: string; sentAt?: string } | null;
}
export interface MessagePage {
  items: ChatMessage[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
