import { useEffect } from 'react';
import { createAuthenticatedSocket } from '@/realtime/authenticatedSocket';
import type { ChatMessage } from '../types/chat.types';

export function useChatSocket(
  conversationId: string | null,
  onMessage: (message: ChatMessage) => void,
  onMessageUpdated: (message: ChatMessage) => void,
  onMessageDeleted: (messageId: string) => void,
) {
  useEffect(() => {
    if (!conversationId) return;
    const { socket, dispose } = createAuthenticatedSocket();
    const joinConversation = () => {
      socket.emit('conversation:join', { conversationId });
    };
    const handleDeletedMessage = (payload: { messageId: string }) =>
      onMessageDeleted(payload.messageId);

    socket.on('connect', joinConversation);
    socket.on('message:new', onMessage);
    socket.on('message:updated', onMessageUpdated);
    socket.on('message:deleted', handleDeletedMessage);
    return () => {
      socket.off('connect', joinConversation);
      socket.off('message:new', onMessage);
      socket.off('message:updated', onMessageUpdated);
      socket.off('message:deleted', handleDeletedMessage);
      dispose();
    };
  }, [conversationId, onMessage, onMessageDeleted, onMessageUpdated]);
}
