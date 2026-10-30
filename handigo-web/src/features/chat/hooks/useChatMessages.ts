import { useCallback, useEffect, useRef, useState } from 'react';
import { chatApi } from '../api/chat.api';
import type { ChatMessage } from '../types/chat.types';
import { loadChatHistory, mergeChatHistory, type MessageChange } from '../utils/chatHistory';
import { useChatSocket } from './useChatSocket';

export function useChatMessages(conversationKey: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const request = useRef(0);
  const pages = useRef<Record<string, number>>({});
  const oldest = useRef<ChatMessage | undefined>(undefined);
  const changes = useRef<MessageChange[]>([]);
  const invalidate = useCallback(() => { request.current++; }, []);

  const changeMessage = useCallback((change: MessageChange) => {
    changes.current.push(change);
    setMessages((current) => mergeChatHistory(current, [change]));
  }, []);
  const addMessage = useCallback((message: ChatMessage) => {
    if (conversationKey?.split(',').includes(message.conversationId)) changeMessage({ message });
  }, [changeMessage, conversationKey]);
  const removeMessage = useCallback((deletedId: string) => changeMessage({ deletedId }), [changeMessage]);

  const synchronize = useCallback(async (loadOlder = false) => {
    if (!conversationKey) return;
    const conversationIds = conversationKey.split(',');
    const revision = ++request.current;
    const isCurrent = () => revision === request.current;
    changes.current = [];
    setLoading(true);
    setError('');
    try {
      const results = await Promise.all(conversationIds.map(async (id) => {
        const result = await loadChatHistory((page) => chatApi.messages(id, page),
          (pages.current[id] ?? 1) + (loadOlder ? 1 : 0), oldest.current, isCurrent);
        return { id, result };
      }));
      if (!isCurrent() || results.some(({ result }) => !result)) return;
      // Chỉ hiển thị khoảng thời gian đã tải đủ ở tất cả các đơn.
      const boundaries = results.flatMap(({ result }) => result?.hasMore && result.items[0] ? [result.items[0].createdAt] : []);
      const boundary = boundaries.length ? Math.max(...boundaries.map((date) => new Date(date).getTime())) : -Infinity;
      const items = results.flatMap(({ result }) => result?.items ?? [])
        .filter((message) => new Date(message.createdAt).getTime() >= boundary);
      const merged = mergeChatHistory(items, changes.current);
      setMessages(merged);
      oldest.current = merged[0];
      for (const { id, result } of results) if (result) pages.current[id] = result.pages;
      setHasMore(results.some(({ result }) => result?.hasMore));
      changes.current = [];
      await Promise.all(conversationIds.map((id) => chatApi.seen(id)));
    } catch {
      if (isCurrent()) setError('Không thể tải tin nhắn. Vui lòng thử lại.');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [conversationKey]);
  const reconnect = useCallback(() => { void synchronize(); }, [synchronize]);
  useChatSocket(conversationKey, addMessage, addMessage, removeMessage, reconnect);

  useEffect(() => {
    pages.current = {};
    oldest.current = undefined;
    changes.current = [];
    const timer = window.setTimeout(() => { setMessages([]); void synchronize(); }, 0);
    return () => { window.clearTimeout(timer); invalidate(); };
  }, [synchronize, invalidate]);

  return { messages, setMessages, addMessage, updateMessage: addMessage, removeMessage,
    loading, error, hasMore, loadOlder: () => synchronize(true), retry: reconnect };
}
