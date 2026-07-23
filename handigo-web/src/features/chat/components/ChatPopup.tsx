import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AsyncState } from '@/components/common/AsyncState';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { chatApi } from '../api/chat.api';
import { useChatSocket } from '../hooks/useChatSocket';
import type { ChatMessage, Conversation } from '../types/chat.types';
import { ChatHeaderMenu } from './ChatHeaderMenu';
import { ChatReportDialog } from './ChatReportDialog';
import { MessageComposer } from './MessageComposer';
import { MessageThread } from './MessageThread';
import { normalizeImageUrl } from '@/utils/imageUrl';
import { MessageCircle, Minus, Wrench, X } from "lucide-react";

const sortMessages = (items: ChatMessage[]) => [...items].sort((a, b) => {
  const timeDifference = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  return timeDifference || a._id.localeCompare(b._id);
});

export function ChatPopup({ orderId, conversation: initialConversation, open, onClose }: { orderId?: string; conversation?: Conversation; open: boolean; onClose: () => void }) {
  const currentUser = useAuthStore((state) => state.user);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [minimized, setMinimized] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [partner, setPartner] = useState<{ fullName: string; avatar?: string | null } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const addMessage = useCallback((message: ChatMessage) => {
    setMessages((items) => items.some((item) => item._id === message._id) ? items : sortMessages([...items, message]));
  }, []);
  const updateMessage = useCallback((message: ChatMessage) => {
    setMessages((items) => sortMessages(items.map((item) => item._id === message._id ? message : item)));
  }, []);
  const removeMessage = useCallback((messageId: string) => {
    setMessages((items) => items.filter((item) => item._id !== messageId));
  }, []);

  useChatSocket(open ? conversationId : null, addMessage, updateMessage, removeMessage);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => { setLoading(true); setError(''); });
    const conversationRequest = initialConversation
      ? Promise.resolve(initialConversation)
      : orderId
        ? chatApi.getOrCreateByOrder(orderId)
        : Promise.reject(new Error('Không tìm thấy cuộc trò chuyện.'));
    conversationRequest
      .then(async (conversation) => {
        setConversationId(conversation._id);
        const role = currentUser?.role.toUpperCase();
        const customer = typeof conversation.customerId === 'object' ? conversation.customerId : null;
        const providerUser = typeof conversation.providerId === 'object' && typeof conversation.providerId.userId === 'object'
          ? conversation.providerId.userId
          : null;
        const otherUser = role === 'PROVIDER' ? customer : providerUser;
        setPartner(otherUser ? { fullName: otherUser.fullName || 'Người dùng Handigo', avatar: otherUser.avatar } : null);
        const page = await chatApi.messages(conversation._id);
        setMessages((current) => {
          const merged = new Map([...page.items, ...current].map((message) => [message._id, message]));
          return sortMessages([...merged.values()]);
        });
        await chatApi.seen(conversation._id);
      })
      .catch(() => setError('Đơn dịch vụ chưa sẵn sàng để trò chuyện.'))
      .finally(() => setLoading(false));
  }, [open, orderId, initialConversation, currentUser?.role]);

  const currentUserId = currentUser?.id || currentUser?._id || '';
  const partnerName = partner?.fullName || 'Đối tác dịch vụ';

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', closeMenu);
    return () => document.removeEventListener('mousedown', closeMenu);
  }, []);

  if (!open) return null;

  const send = async (content: string) => {
    if (!conversationId) return;
    addMessage(await chatApi.send(conversationId, content));
  };

  const sendImage = async (file: File) => {
    if (!conversationId) return;
    const imageUrl = normalizeImageUrl(await chatApi.uploadImage(file));
    if (!imageUrl) throw new Error('URL ảnh không hợp lệ.');
    addMessage(await chatApi.sendImage(conversationId, imageUrl));
  };

  const editMessage = async (messageId: string, content: string) => {
    updateMessage(await chatApi.updateMessage(messageId, content));
  };

  const deleteMessage = async (messageId: string) => {
    await chatApi.deleteMessage(messageId);
    removeMessage(messageId);
  };

  const closeChat = () => {
    setMinimized(false);
    setMenuOpen(false);
    setReportOpen(false);
    onClose();
  };

  const markAsRead = async () => {
    if (!conversationId) return;
    try {
      await chatApi.seen(conversationId);
      setMessages((items) => items.map((item) => ({ ...item, status: 'seen' })));
      setNotice('Đã đánh dấu cuộc trò chuyện là đã đọc.');
      setMenuOpen(false);
    } catch {
      setNotice('Không thể đánh dấu đã đọc. Vui lòng thử lại.');
    }
  };

  const submitReport = async (description: string) => {
    if (!conversationId) return;
    await chatApi.report(conversationId, description);
    setReportOpen(false);
    setNotice('Báo cáo đã được gửi.');
  };

  if (minimized) {
    return createPortal(
      <aside className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[120] flex w-[min(360px,calc(100vw-32px))] items-center gap-3 rounded-2xl border border-outline-variant/40 bg-surface p-3 shadow-2xl">
        <button type="button" onClick={() => setMinimized(false)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <MessageCircle aria-hidden="true" size={24} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-on-surface">{partnerName}</span>
            <span className="block truncate text-xs text-on-surface-variant">Nhấn để tiếp tục trò chuyện</span>
          </span>
        </button>
        <button type="button" onClick={closeChat} aria-label="Đóng trò chuyện" className="rounded-full p-2 hover:bg-surface-container-low">
          <X aria-hidden="true" size={20} className="block" />
        </button>
      </aside>,
      document.body,
    );
  }

  return createPortal(
    <aside className="fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-[120] flex h-[min(620px,calc(100dvh-16px))] flex-col overflow-hidden rounded-3xl border border-outline-variant/50 bg-surface shadow-2xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:h-[min(600px,calc(100dvh-32px))] sm:w-[400px]">
      <header className="flex items-center justify-between gap-3 bg-primary p-4 text-on-primary shadow-md">
        <div className="flex min-w-0 items-center gap-3">
          <InitialsAvatar name={partnerName} src={partner?.avatar} className="h-11 w-11 border-2 border-white/40" />
          <div className="min-w-0">
            <p className="truncate font-bold">{partnerName}</p>
            <p className="flex items-center gap-1.5 truncate text-xs opacity-85"><Wrench aria-hidden="true" size={14} />Đơn dịch vụ</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ChatHeaderMenu
            open={menuOpen}
            menuRef={menuRef}
            onToggle={() => setMenuOpen((value) => !value)}
            onMarkAsRead={() => void markAsRead()}
            onReport={() => { setReportOpen(true); setMenuOpen(false); }}
          />
          <button type="button" onClick={() => setMinimized(true)} aria-label="Thu gọn trò chuyện" className="rounded-full p-2 hover:bg-white/15"><Minus aria-hidden="true" size={20} className="block" /></button>
          <button type="button" onClick={closeChat} aria-label="Đóng cửa sổ trò chuyện" className="rounded-full p-2 hover:bg-white/15"><X aria-hidden="true" size={20} className="block" /></button>
        </div>
      </header>
      {notice && <div className="bg-primary/10 px-4 py-2 text-xs text-primary">{notice}</div>}
      <AsyncState loading={loading} error={error}><MessageThread messages={messages} currentUserId={currentUserId} onEdit={editMessage} onDelete={deleteMessage} /></AsyncState>
      {!loading && !error && <MessageComposer onSend={send} onSendImage={sendImage} />}
      {reportOpen && <ChatReportDialog onClose={() => setReportOpen(false)} onSubmit={submitReport} />}
    </aside>,
    document.body,
  );
}
