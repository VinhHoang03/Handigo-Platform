import { useEffect } from 'react';
import { createAuthenticatedSocket } from '@/realtime/authenticatedSocket';
import type { ChatMessage } from '../types/chat.types';

export function useChatSocket(
  conversationId: string | null,
  onMessage: (message: ChatMessage) => void,
  onMessageUpdated: (message: ChatMessage) => void,
  onMessageDeleted: (messageId: string) => void,
  onReconnect?: () => void,
) {
  useEffect(() => {
    if (!conversationId) return;
    const conversationIds = conversationId.split(',');
    const { socket, dispose } = createAuthenticatedSocket();
    const joinConversation = () => {
      for (const id of conversationIds) socket.emit('conversation:join', { conversationId: id });
      onReconnect?.();
    };
    const handleMessage = (message: ChatMessage) => {
      if (conversationIds.includes(message.conversationId)) onMessage(message);
    };
    const handleUpdatedMessage = (message: ChatMessage) => {
      if (conversationIds.includes(message.conversationId)) onMessageUpdated(message);
    };
    const handleDeletedMessage = (payload: { messageId: string }) =>
      onMessageDeleted(payload.messageId);

    socket.on('connect', joinConversation);
    socket.on('message:new', handleMessage);
    socket.on('message:updated', handleUpdatedMessage);
    socket.on('message:deleted', handleDeletedMessage);
    return () => {
      socket.off('connect', joinConversation);
      socket.off('message:new', handleMessage);
      socket.off('message:updated', handleUpdatedMessage);
      socket.off('message:deleted', handleDeletedMessage);
      dispose();
    };
  }, [conversationId, onMessage, onMessageDeleted, onMessageUpdated, onReconnect]);
}
