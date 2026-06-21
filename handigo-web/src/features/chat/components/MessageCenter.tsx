import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { chatApi } from "../api/chat.api";
import type { Conversation } from "../types/chat.types";
import { ChatPopup } from "./ChatPopup";

const formatMessageTime = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
};

export function MessageCenter() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
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

  const unreadCount = useMemo(
    () => items.filter(isUnread).length,
    [isUnread, items],
  );
  const conversationIds = useMemo(
    () => items.map((conversation) => conversation._id),
    [items],
  );

  const load = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      setError("");
      const result = await chatApi.conversations();
      setItems(result.items);
    } catch {
      setError("Không thể tải danh sách tin nhắn.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    chatApi.conversations()
      .then((result) => {
        if (active) setItems(result.items);
      })
      .catch(() => {
        if (active) setError("Không thể tải danh sách tin nhắn.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useEffect(() => {
    if (!token || !conversationIds.length) return;
    const socket = io(import.meta.env.VITE_API_BASE_URL || "http://localhost:5000", {
      auth: { token },
    });
    conversationIds.forEach((conversationId) => {
      socket.emit("conversation:join", { conversationId });
    });
    const refresh = () => void load();
    socket.on("message:new", refresh);
    socket.on("message:updated", refresh);
    socket.on("message:deleted", refresh);
    socket.on("message:seen", refresh);
    return () => {
      socket.disconnect();
    };
  }, [conversationIds, load, token]);

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
          onClick={() => setOpen((value) => !value)}
          className="relative inline-flex rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
        >
          <span className="material-symbols-outlined">chat_bubble</span>
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-error px-1.5 py-0.5 text-center text-[10px] font-bold leading-4 text-on-error">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {open && (
          <div className="fixed inset-x-4 top-20 z-50 overflow-hidden rounded-2xl border border-outline-variant/30 bg-white shadow-[0_18px_46px_rgba(19,27,46,0.18)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-3 sm:w-[380px]">
            <div className="flex items-center justify-between border-b border-outline-variant/20 px-4 py-3">
              <div>
                <h2 className="font-bold text-on-surface">Tin nhắn</h2>
                <p className="text-xs text-on-surface-variant">{unreadCount} cuộc trò chuyện chưa đọc</p>
              </div>
              <button type="button" onClick={() => void load(true)} className="rounded-full p-2 text-primary hover:bg-primary/10" aria-label="Tải lại tin nhắn">
                <span className="material-symbols-outlined block text-xl">refresh</span>
              </button>
            </div>

            <div className="max-h-[min(520px,70vh)] overflow-y-auto p-2">
              {loading ? (
                <p className="p-6 text-center text-sm text-on-surface-variant">Đang tải tin nhắn...</p>
              ) : error ? (
                <div className="p-5 text-center text-sm text-error"><p>{error}</p><button type="button" onClick={() => void load(true)} className="mt-2 font-bold text-primary">Thử lại</button></div>
              ) : items.length === 0 ? (
                <div className="p-8 text-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-4xl">forum</span>
                  <p className="mt-2 text-sm">Bạn chưa có cuộc trò chuyện nào.</p>
                </div>
              ) : items.map((conversation) => {
                const customer = typeof conversation.customerId === "object" ? conversation.customerId : undefined;
                const providerUser = typeof conversation.providerId === "object" && typeof conversation.providerId.userId === "object" ? conversation.providerId.userId : undefined;
                const partner = role === "PROVIDER" ? customer : providerUser;
                const partnerName = partner?.fullName || "Người dùng Handigo";
                const avatar = partner?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(partnerName)}&background=4f46e5&color=fff`;
                const unread = isUnread(conversation);
                return (
                  <button key={conversation._id} type="button" onClick={() => openConversation(conversation)} className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-surface-container-low ${unread ? "bg-primary/5" : ""}`}>
                    <img src={avatar} alt={`Ảnh đại diện của ${partnerName}`} className="h-11 w-11 shrink-0 rounded-full object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={`truncate text-sm ${unread ? "font-bold text-on-surface" : "font-semibold text-on-surface"}`}>{partnerName}</span>
                        <span className="shrink-0 text-[11px] text-on-surface-variant">{formatMessageTime(conversation.lastMessage?.sentAt)}</span>
                      </span>
                      <span className="mt-1 flex items-center gap-2">
                        <span className={`truncate text-xs ${unread ? "font-semibold text-on-surface" : "text-on-surface-variant"}`}>
                          {conversation.lastMessage?.messageType === "image" ? "Đã gửi một hình ảnh" : conversation.lastMessage?.content || "Chưa có tin nhắn"}
                        </span>
                        {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {selected && (
        <ChatPopup
          conversation={selected}
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
