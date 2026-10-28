import { useCallback, useEffect, useRef, useState } from 'react';
import { chatApi } from '../api/chat.api';
import type { ChatMessage } from '../types/chat.types';
import { loadChatHistory, mergeChatHistory, type MessageChange } from '../utils/chatHistory';
import { useChatSocket } from './useChatSocket';

export function useChatMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const request = useRef(0);
  const pages = useRef(1);
  const oldest = useRef<ChatMessage | undefined>(undefined);
  const changes = useRef<MessageChange[]>([]);
  const invalidate = useCallback(() => { request.current++; }, []);

  const changeMessage = useCallback((change: MessageChange) => {
    changes.current.push(change);
    setMessages((current) => mergeChatHistory(current, [change]));
  }, []);
  const addMessage = useCallback((message: ChatMessage) => {
    if (message.conversationId === conversationId) changeMessage({ message });
  }, [changeMessage, conversationId]);
  const removeMessage = useCallback((deletedId: string) => changeMessage({ deletedId }), [changeMessage]);

  const synchronize = useCallback(async (loadOlder = false) => {
    if (!conversationId) return;
    const revision = ++request.current;
    const isCurrent = () => revision === request.current;
    const minimumPages = pages.current + (loadOlder ? 1 : 0);
    changes.current = [];
    setLoading(true);
    setError('');
    try {
      const result = await loadChatHistory((page) => chatApi.messages(conversationId, page),
        minimumPages, oldest.current, isCurrent);
      if (!result || !isCurrent()) return;
      const merged = mergeChatHistory(result.items, changes.current);
      setMessages(merged);
      oldest.current = merged[0];
      pages.current = result.pages;
      setHasMore(result.hasMore);
      changes.current = [];
      await chatApi.seen(conversationId);
    } catch {
      if (isCurrent()) setError('Không thể tải tin nhắn. Vui lòng thử lại.');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [conversationId]);
  const reconnect = useCallback(() => { void synchronize(); }, [synchronize]);
  useChatSocket(conversationId, addMessage, addMessage, removeMessage, reconnect);

  useEffect(() => {
    pages.current = 1;
    oldest.current = undefined;
    changes.current = [];
    const timer = window.setTimeout(() => { setMessages([]); void synchronize(); }, 0);
    return () => { window.clearTimeout(timer); invalidate(); };
  }, [synchronize, invalidate]);

  return { messages, setMessages, addMessage, updateMessage: addMessage, removeMessage,
    loading, error, hasMore, loadOlder: () => synchronize(true), retry: reconnect };
}
