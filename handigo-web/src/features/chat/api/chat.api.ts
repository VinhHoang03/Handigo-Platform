import api from '@/api/client';
import type { ChatMessage, Conversation, MessagePage } from '../types/chat.types';

const data = <T>(response: { data: { data: T } }) => response.data.data;
export const chatApi = {
  getOrCreateByOrder: async (orderId: string) => data<Conversation>(await api.get(`/chat/orders/${orderId}/conversation`)),
  messages: async (conversationId: string, page = 1) => data<MessagePage>(await api.get(`/chat/conversations/${conversationId}/messages`, { params: { page, limit: 50 } })),
  send: async (conversationId: string, content: string) => data<ChatMessage>(await api.post(`/chat/conversations/${conversationId}/messages`, { messageType: 'text', content })),
  seen: async (conversationId: string) => data<unknown>(await api.patch(`/chat/conversations/${conversationId}/seen`)),
};
