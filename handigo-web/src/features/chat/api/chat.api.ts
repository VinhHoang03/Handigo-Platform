import api from '@/api/client';
import type { ChatMessage, Conversation, ConversationPage, MessagePage } from '../types/chat.types';

const data = <T>(response: { data: { data: T } }) => response.data.data;
export const chatApi = {
  conversations: async (page = 1, limit = 50) => data<ConversationPage>(await api.get('/chat/conversations', { params: { page, limit } })),
  getOrCreateByOrder: async (orderId: string) => data<Conversation>(await api.get(`/chat/orders/${orderId}/conversation`)),
  messages: async (conversationId: string, page = 1) => data<MessagePage>(await api.get(`/chat/conversations/${conversationId}/messages`, { params: { page, limit: 50 } })),
  send: async (conversationId: string, content: string) => data<ChatMessage>(await api.post(`/chat/conversations/${conversationId}/messages`, { messageType: 'text', content })),
  sendImage: async (conversationId: string, imageUrl: string) => data<ChatMessage>(await api.post(`/chat/conversations/${conversationId}/messages`, { messageType: 'image', imageUrl })),
  updateMessage: async (messageId: string, content: string) => data<ChatMessage>(await api.patch(`/chat/messages/${messageId}`, { content })),
  deleteMessage: async (messageId: string) => data<{ messageId: string }>(await api.delete(`/chat/messages/${messageId}`)),
  uploadImage: async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.post<{ success: boolean; data: { url: string } }>('/orders/attachments', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data.url;
  },
  seen: async (conversationId: string) => data<unknown>(await api.patch(`/chat/conversations/${conversationId}/seen`)),
  report: async (conversationId: string, description: string) =>
    data<unknown>(await api.post(`/chat/conversations/${conversationId}/report`, { description })),
};
