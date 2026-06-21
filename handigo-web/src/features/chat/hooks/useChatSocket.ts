import { useEffect } from 'react';
import { io } from 'socket.io-client';
import type { ChatMessage } from '../types/chat.types';

export function useChatSocket(
  conversationId: string | null,
  onMessage: (message: ChatMessage) => void,
  onMessageUpdated: (message: ChatMessage) => void,
  onMessageDeleted: (messageId: string) => void,
) {
  useEffect(() => {
    if (!conversationId) return;
    const socket = io(import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000', {
      auth: { token: localStorage.getItem('token') },
    });
    socket.emit('conversation:join', { conversationId });
    socket.on('message:new', onMessage);
    socket.on('message:updated', onMessageUpdated);
    socket.on('message:deleted', (payload: { messageId: string }) => onMessageDeleted(payload.messageId));
    return () => {
      socket.off('message:new', onMessage);
      socket.off('message:updated', onMessageUpdated);
      socket.off('message:deleted');
      socket.disconnect();
    };
  }, [conversationId, onMessage, onMessageDeleted, onMessageUpdated]);
}
