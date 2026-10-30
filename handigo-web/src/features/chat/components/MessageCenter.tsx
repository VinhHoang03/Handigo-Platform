import { useToastFeedback } from "@/components/common/Toast";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { createAuthenticatedSocket } from "@/realtime/authenticatedSocket";
import { chatApi } from "../api/chat.api";
import type { Conversation } from "../types/chat.types";
import { conversationGroupKey, groupConversations } from "../utils/conversationGroups";
import { ChatPopup } from "./ChatPopup";
import { ConversationListItem } from "./ConversationListItem";
import { ConversationListSkeleton } from "./ConversationListSkeleton";
import { MessageCircle, MessagesSquare, RefreshCw } from "lucide-react";

export function MessageCenter() {
  const accountId = useAuthStore((state) => state.user?.id || state.user?._id);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const isUnapprovedProvider = user?.role.toUpperCase() === "PROVIDER" &&
    user.providerOnboardingStatus && user.providerOnboardingStatus !== "APPROVED";
  return isAuthenticated && !isUnapprovedProvider ? <AccountMessageCenter key={accountId} /> : null;
}

function AccountMessageCenter() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useToastFeedback<string>("", "error");
  const rootRef = useRef<HTMLDivElement>(null);
  const requestRevision = useRef(0);
  const invalidateRequests = useCallback(() => { requestRevision.current++; }, []);
  const role = user?.role.toUpperCase();
  const currentUserId = user?.id || user?._id;

  const isUnread = useCallback((conversation: Conversation) => {
    const sentAt = conversation.lastMessage?.sentAt;
    const senderId = conversation.lastMessage?.senderId;
    if (!sentAt || !senderId || senderId === currentUserId) return false;
    const seenAt = role === "PROVIDER"
      ? conversation.providerLastSeenAt
      : conversation.customerLastSeenAt;
    return !seenAt || new Date(sentAt).getTime() > new Date(seenAt).getTime();
  }, [currentUserId, role]);

  const groups = useMemo(() => groupConversations(items), [items]);
  const unreadCount = groups.filter((group) => group.some(isUnread)).length;
  const load = useCallback(async (showLoading = false) => {
    const revision = ++requestRevision.current;
    try {
      if (showLoading) setLoading(true);
      setError("");
      const result = await chatApi.allConversations();
      if (requestRevision.current === revision) setItems(result);
    } catch {
      if (requestRevision.current === revision) setError("Không thể tải danh sách tin nhắn.");
    } finally {
      if (requestRevision.current === revision) setLoading(false);
    }
  }, [setError]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) return load(true); });
    return () => {
      active = false;
      invalidateRequests();
    };
  }, [invalidateRequests, load]);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const { socket, dispose } = createAuthenticatedSocket();
    const refresh = () => void load();
    const refreshVisible = () => { if (document.visibilityState === "visible") refresh(); };
    socket.on("connect", refresh);
    socket.on("message:new", refresh);
    socket.on("message:updated", refresh);
    socket.on("message:deleted", refresh);
    socket.on("message:seen", refresh);
    socket.on("order:updated", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      socket.off("connect", refresh);
      socket.off("message:new", refresh);
      socket.off("message:updated", refresh);
      socket.off("message:deleted", refresh);
      socket.off("message:seen", refresh);
      socket.off("order:updated", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshVisible);
      dispose();
    };
  }, [isAuthenticated, load]);

  const openConversation = (conversation: Conversation) => {
    setSelected(conversation);
    setOpen(false);
  };

  return (
    <>
      <div ref={rootRef} className="relative">
        <button
          type="button"
          aria-label="Tin nhắn"
          aria-expanded={open}
          onClick={() => { if (!open) void load(true); setOpen((value) => !value); }}
          className="relative inline-flex rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
        >
          <MessageCircle aria-hidden="true" size={24} />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-error px-1.5 py-0.5 text-center text-[10px] font-bold leading-4 text-on-error">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {open && (
          <div className="fixed inset-x-4 top-20 z-50 overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-[0_18px_46px_rgba(19,27,46,0.18)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-3 sm:w-[380px]">
            <div className="flex items-center justify-between border-b border-outline-variant/20 px-4 py-3">
              <div>
                <h2 className="font-bold text-on-surface">Tin nhắn</h2>
                <p className="text-xs text-on-surface-variant">{unreadCount} cuộc trò chuyện chưa đọc</p>
              </div>
              <button type="button" onClick={() => void load(true)} className="rounded-full p-2 text-primary hover:bg-primary/10" aria-label="Tải lại tin nhắn">
                <RefreshCw aria-hidden="true" size={20} className="block" />
              </button>
            </div>

            <div className="max-h-[min(520px,70vh)] overflow-y-auto p-2">
              {loading ? (
                <ConversationListSkeleton />
              ) : error ? (
                <div className="p-5 text-center text-sm text-error"><p>{error}</p><button type="button" onClick={() => void load(true)} className="mt-2 font-bold text-primary">Thử lại</button></div>
              ) : items.length === 0 ? (
                <div className="p-8 text-center text-on-surface-variant">
                  <MessagesSquare aria-hidden="true" size={36} />
                  <p className="mt-2 text-sm">Bạn chưa có cuộc trò chuyện nào.</p>
                </div>
              ) : groups.map((group) => {
                const conversation = group[0];
                const customer = typeof conversation.customerId === "object" ? conversation.customerId : undefined;
                const providerUser = typeof conversation.providerId === "object" && typeof conversation.providerId.userId === "object" ? conversation.providerId.userId : undefined;
                const partner = role === "PROVIDER" ? customer : providerUser;
                const partnerName = partner?.fullName || "Người dùng Handigo";
                const unread = group.some(isUnread);
                return (
                  <ConversationListItem
                    key={conversationGroupKey(conversation)}
                    conversation={conversation}
                    partnerName={partnerName}
                    partnerAvatar={partner?.avatar}
                    unread={unread}
                    onOpen={openConversation}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {selected && (
        <ChatPopup
          conversation={selected}
          relatedConversations={groups.find((group) => conversationGroupKey(group[0]) === conversationGroupKey(selected))}
          open
          onClose={() => {
            setSelected(null);
            void load();
          }}
        />
      )}
    </>
  );
}
