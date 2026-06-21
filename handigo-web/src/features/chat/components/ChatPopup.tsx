import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { AsyncState } from '@/components/common/AsyncState';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { chatApi } from '../api/chat.api';
import { useChatSocket } from '../hooks/useChatSocket';
import type { ChatMessage, Conversation } from '../types/chat.types';
import { MessageComposer } from './MessageComposer';
import { MessageThread } from './MessageThread';
import { normalizeImageUrl } from '@/utils/imageUrl';

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
  const [reportDescription, setReportDescription] = useState('');
  const [reportError, setReportError] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
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
  const partnerInitial = partnerName.trim().charAt(0).toUpperCase() || 'H';

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

  const submitReport = async (event: FormEvent) => {
    event.preventDefault();
    const description = reportDescription.trim();
    if (description.length < 10) {
      setReportError('Nội dung báo cáo phải có ít nhất 10 ký tự.');
      return;
    }
    if (!conversationId) return;
    try {
      setReportBusy(true);
      setReportError('');
      await chatApi.report(conversationId, description);
      setReportOpen(false);
      setReportDescription('');
      setNotice('Báo cáo đã được gửi.');
    } catch {
      setReportError('Không thể gửi báo cáo. Vui lòng thử lại.');
    } finally {
      setReportBusy(false);
    }
  };

  if (minimized) {
    return createPortal(
      <aside className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[120] flex w-[min(360px,calc(100vw-32px))] items-center gap-3 rounded-2xl border border-outline-variant/40 bg-surface p-3 shadow-2xl">
        <button type="button" onClick={() => setMinimized(false)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="material-symbols-outlined flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">chat_bubble</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-on-surface">{partnerName}</span>
            <span className="block truncate text-xs text-on-surface-variant">Nhấn để tiếp tục trò chuyện</span>
          </span>
        </button>
        <button type="button" onClick={closeChat} aria-label="Đóng trò chuyện" className="rounded-full p-2 hover:bg-surface-container-low">
          <span className="material-symbols-outlined block text-xl">close</span>
        </button>
      </aside>,
      document.body,
    );
  }

  return createPortal(
    <aside className="fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-[120] flex h-[min(620px,calc(100dvh-16px))] flex-col overflow-hidden rounded-3xl border border-outline-variant/50 bg-surface shadow-2xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:h-[min(600px,calc(100dvh-32px))] sm:w-[400px]">
      <header className="flex items-center justify-between gap-3 bg-primary p-4 text-on-primary shadow-md">
        <div className="flex min-w-0 items-center gap-3">
          {partner?.avatar ? (
            <img src={partner.avatar} alt={`Ảnh đại diện của ${partnerName}`} className="h-11 w-11 shrink-0 rounded-full border-2 border-white/40 object-cover" />
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20 text-base font-bold">{partnerInitial}</span>
          )}
          <div className="min-w-0">
            <p className="truncate font-bold">{partnerName}</p>
            <p className="flex items-center gap-1.5 truncate text-xs opacity-85"><span className="material-symbols-outlined text-sm">home_repair_service</span>Đơn dịch vụ</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <div ref={menuRef} className="relative">
            <button type="button" onClick={() => setMenuOpen((value) => !value)} aria-label="Thao tác khác" className="rounded-full p-2 hover:bg-white/15">
              <span className="material-symbols-outlined block text-xl">more_vert</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-11 z-10 w-56 overflow-hidden rounded-2xl border border-outline-variant/40 bg-white py-2 text-on-surface shadow-xl">
                <button type="button" onClick={() => void markAsRead()} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-surface-container-low">
                  <span className="material-symbols-outlined text-xl text-primary">done_all</span>Đánh dấu đã đọc
                </button>
                <button type="button" onClick={() => { setReportOpen(true); setMenuOpen(false); }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-error hover:bg-error/5">
                  <span className="material-symbols-outlined text-xl">flag</span>Báo cáo đoạn chat
                </button>
              </div>
            )}
          </div>
          <button type="button" onClick={() => setMinimized(true)} aria-label="Thu gọn trò chuyện" className="rounded-full p-2 hover:bg-white/15"><span className="material-symbols-outlined block text-xl">remove</span></button>
          <button type="button" onClick={closeChat} aria-label="Đóng cửa sổ trò chuyện" className="rounded-full p-2 hover:bg-white/15"><span className="material-symbols-outlined block text-xl">close</span></button>
        </div>
      </header>
      {notice && <div className="bg-primary/10 px-4 py-2 text-xs text-primary">{notice}</div>}
      <AsyncState loading={loading} error={error}><MessageThread messages={messages} currentUserId={currentUserId} onEdit={editMessage} onDelete={deleteMessage} /></AsyncState>
      {!loading && !error && <MessageComposer onSend={send} onSendImage={sendImage} />}
      {reportOpen && (
        <div className="absolute inset-0 z-20 flex items-end bg-on-surface/35 p-3 sm:items-center">
          <form onSubmit={submitReport} className="w-full rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="font-bold text-on-surface">Báo cáo đoạn chat</h3><p className="mt-1 text-sm text-on-surface-variant">Mô tả rõ nội dung cần được kiểm tra.</p></div>
              <button type="button" onClick={() => setReportOpen(false)} aria-label="Đóng báo cáo" className="rounded-full p-1 hover:bg-surface-container-low"><span className="material-symbols-outlined block">close</span></button>
            </div>
            <textarea value={reportDescription} onChange={(event) => setReportDescription(event.target.value)} maxLength={1000} rows={5} className="mt-4 w-full resize-none rounded-2xl border border-outline-variant p-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" placeholder="Nhập nội dung báo cáo..." />
            <div className="mt-1 flex justify-between gap-2 text-xs"><span className="text-error">{reportError}</span><span className="text-on-surface-variant">{reportDescription.length}/1000</span></div>
            <button type="submit" disabled={reportBusy} className="btn-primary mt-4 w-full disabled:opacity-50">{reportBusy ? 'Đang gửi...' : 'Gửi báo cáo'}</button>
          </form>
        </div>
      )}
    </aside>,
    document.body,
  );
}
