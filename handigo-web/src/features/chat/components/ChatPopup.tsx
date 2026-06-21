import { useCallback, useEffect, useState } from 'react';
import { AsyncState } from '@/components/common/AsyncState';
import { chatApi } from '../api/chat.api';
import { useChatSocket } from '../hooks/useChatSocket';
import type { ChatMessage } from '../types/chat.types';
import { MessageComposer } from './MessageComposer';
import { MessageThread } from './MessageThread';

export function ChatPopup({ orderId, open, onClose }: { orderId: string; open: boolean; onClose: () => void }) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const addMessage = useCallback((message: ChatMessage) => {
    setMessages((items) => items.some((item) => item._id === message._id) ? items : [...items, message]);
  }, []);

  useChatSocket(open ? conversationId : null, addMessage);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => { setLoading(true); setError(''); });
    chatApi.getOrCreateByOrder(orderId)
      .then(async (conversation) => {
        setConversationId(conversation._id);
        const page = await chatApi.messages(conversation._id);
        setMessages([...page.items].reverse());
        await chatApi.seen(conversation._id);
      })
      .catch(() => setError('Đơn dịch vụ chưa sẵn sàng để trò chuyện.'))
      .finally(() => setLoading(false));
  }, [open, orderId]);

  if (!open) return null;

  const send = async (content: string) => {
    if (!conversationId) return;
    addMessage(await chatApi.send(conversationId, content));
  };

  return (
    <aside className="fixed bottom-4 right-4 z-[90] flex h-[min(560px,calc(100vh-32px))] w-[min(390px,calc(100vw-32px))] flex-col overflow-hidden rounded-3xl border border-outline-variant bg-surface shadow-2xl">
      <header className="flex items-center justify-between bg-primary p-4 text-on-primary">
        <div><p className="font-bold">Trao đổi về đơn dịch vụ</p><p className="text-xs opacity-80">Tin nhắn trực tiếp với đối tác</p></div>
        <button type="button" onClick={onClose} aria-label="Đóng cửa sổ trò chuyện"><span className="material-symbols-outlined">close</span></button>
      </header>
      <AsyncState loading={loading} error={error}><MessageThread messages={messages} /></AsyncState>
      {!loading && !error && <MessageComposer onSend={send} />}
    </aside>
  );
}
