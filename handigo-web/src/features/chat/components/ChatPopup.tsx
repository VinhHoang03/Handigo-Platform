import { useToast, useToastFeedback } from "@/components/common/Toast";
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AsyncState } from '@/components/common/AsyncState';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { createAuthenticatedSocket } from '@/realtime/authenticatedSocket';
import { chatApi } from '../api/chat.api';
import { useChatMessages } from '../hooks/useChatMessages';
import type { Conversation } from '../types/chat.types';
import { ChatHeaderMenu } from './ChatHeaderMenu';
import { ChatReportDialog } from './ChatReportDialog';
import { MessageComposer } from './MessageComposer';
import { MessageThread } from './MessageThread';
import { normalizeImageUrl } from '@/utils/imageUrl';
import { useChatUiStore } from '../store/chatUi.store';
import { activeOrderConversation, conversationGroupKey, conversationOrderLabel, sortOrderConversations } from '../utils/conversationGroups';
import { MessageCircle, Minus, Wrench, X } from 'lucide-react';

type ChatPopupProps = { orderId?: string; conversation?: Conversation; relatedConversations?: Conversation[]; open: boolean; onClose: () => void };

export function ChatPopup(props: ChatPopupProps) {
  const accountId = useAuthStore((state) => state.user?.id || state.user?._id);
  return <ChatPopupContent key={`${accountId}:${props.conversation?._id ?? props.orderId}:${props.open}`} {...props} />;
}

function ChatPopupContent({ orderId, conversation: initialConversation, relatedConversations, open, onClose }: ChatPopupProps) {
  const { addToast } = useToast();
  const currentUser = useAuthStore((state) => state.user);
  const [loadedConversations, setLoadedConversations] = useState<Conversation[]>([]);
  const conversations = relatedConversations ?? loadedConversations;
  const groupKey = loadedConversations[0] ? conversationGroupKey(loadedConversations[0]) : null;
  const conversationKey = conversations.map((item) => item._id).sort().join(',');
  const history = useChatMessages(open && conversationKey ? conversationKey : null);
  const activeConversation = activeOrderConversation(conversations);
  const conversationId = activeConversation?._id ?? null;
  const reportConversationId = conversationId ?? sortOrderConversations(conversations).at(-1)?._id;
  const { messages, setMessages, addMessage, updateMessage, removeMessage } = history;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useToastFeedback<string>('', "error");
  const [minimized, setMinimized] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [partner, setPartner] = useState<{ fullName: string; avatar?: string | null } | null>(null);
  const registerOpenPopup = useChatUiStore((state) => state.registerOpenPopup);
  const unregisterOpenPopup = useChatUiStore((state) => state.unregisterOpenPopup);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    registerOpenPopup();
    return unregisterOpenPopup;
  }, [open, registerOpenPopup, unregisterOpenPopup]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    queueMicrotask(() => { if (active) { setLoading(true); setError(''); } });
    const conversationRequest = initialConversation
      ? Promise.resolve(initialConversation)
      : orderId
        ? chatApi.getOrCreateByOrder(orderId)
        : Promise.reject(new Error('Không tìm thấy cuộc trò chuyện.'));
    conversationRequest
      .then(async (conversation) => {
        const all = await chatApi.allConversations();
        if (!active) return;
        setLoadedConversations([...new Map([conversation, ...all.filter((item) =>
          conversationGroupKey(item) === conversationGroupKey(conversation))].map((item) => [item._id, item])).values()]);
        const role = currentUser?.role.toUpperCase();
        const customer = typeof conversation.customerId === 'object' ? conversation.customerId : null;
        const providerUser = typeof conversation.providerId === 'object' && typeof conversation.providerId.userId === 'object'
          ? conversation.providerId.userId
          : null;
        const otherUser = role === 'PROVIDER' ? customer : providerUser;
        setPartner(otherUser ? { fullName: otherUser.fullName || 'Người dùng Handigo', avatar: otherUser.avatar } : null);
      })
      .catch(() => { if (active) setError('Đơn dịch vụ chưa sẵn sàng để trò chuyện.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, orderId, initialConversation, currentUser?.role, setError]);

  useEffect(() => {
    if (!open || relatedConversations || !groupKey) return;
    let active = true;
    let revision = 0;
    const refresh = async () => {
      const current = ++revision;
      try {
        const all = await chatApi.allConversations();
        if (active && current === revision) setLoadedConversations(all.filter((item) => conversationGroupKey(item) === groupKey));
      } catch {
        if (active) setNotice('Không thể cập nhật danh sách đơn trong cuộc trò chuyện. Vui lòng mở lại để thử lại.');
      }
    };
    const { socket, dispose } = createAuthenticatedSocket();
    const handleNewMessage = (message: { conversationId: string }) => {
      if (!conversationKey.split(',').includes(message.conversationId)) void refresh();
    };
    const handleFocus = () => { void refresh(); };
    socket.on('connect', handleFocus);
    socket.on('message:new', handleNewMessage);
    socket.on('order:updated', handleFocus);
    window.addEventListener('focus', handleFocus);
    return () => {
      active = false;
      window.removeEventListener('focus', handleFocus);
      socket.off('connect', handleFocus);
      socket.off('message:new', handleNewMessage);
      socket.off('order:updated', handleFocus);
      dispose();
    };
  }, [open, relatedConversations, groupKey, conversationKey]);

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
    if (!conversations.length) return;
    try {
      await Promise.all(conversations.map((item) => chatApi.seen(item._id)));
      setMessages((items) => items.map((item) => ({ ...item, status: 'seen' })));
      setNotice('Đã đánh dấu cuộc trò chuyện là đã đọc.');
      addToast('Đã đánh dấu cuộc trò chuyện là đã đọc.', 'success');
      setMenuOpen(false);
    } catch {
      setNotice('Không thể đánh dấu đã đọc. Vui lòng thử lại.');
      addToast('Không thể đánh dấu đã đọc. Vui lòng thử lại.', 'error');
    }
  };

  const submitReport = async (description: string) => {
    if (!reportConversationId) return;
    await chatApi.report(reportConversationId, description);
    setReportOpen(false);
    setNotice('Báo cáo đã được gửi.');
    addToast('Báo cáo đã được gửi.', 'success');
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
            <p className="flex items-center gap-1.5 truncate text-xs opacity-85"><Wrench aria-hidden="true" size={14} />{conversations.length} đơn dịch vụ</p>
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
      {history.error && messages.length > 0 && <div role="alert" className="px-4 py-2 text-sm text-error">{history.error}<button type="button" onClick={history.retry} disabled={history.loading} className="ml-2 font-semibold underline">Thử lại</button></div>}
      <AsyncState loading={loading || (history.loading && !messages.length)} error={error || (!messages.length ? history.error : '')} onRetry={history.retry}><MessageThread messages={messages} conversations={conversations} currentUserId={currentUserId} onEdit={editMessage} onDelete={deleteMessage} hasMore={history.hasMore} loadingOlder={history.loading} onLoadOlder={() => void history.loadOlder()} /></AsyncState>
      {!loading && !error && conversations.length > 0 && <>
        {activeConversation && <p className="border-t border-outline-variant/30 px-4 py-2 text-xs text-on-surface-variant">Đang trao đổi: {conversationOrderLabel(activeConversation)}</p>}
        {conversationId ? <MessageComposer key={conversationId} onSend={send} onSendImage={sendImage} /> : <p className="border-t border-outline-variant/30 px-4 py-3 text-sm text-on-surface-variant">Các đơn đã kết thúc. Tin nhắn được lưu tại đây; cuộc trò chuyện sẽ tiếp tục khi có đơn mới được thợ nhận.</p>}
      </>}
      {reportOpen && <ChatReportDialog onClose={() => setReportOpen(false)} onSubmit={submitReport} />}
    </aside>,
    document.body,
  );
}
