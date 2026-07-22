import { InitialsAvatar } from "@/components/common/InitialsAvatar";
import type { Conversation } from "../types/chat.types";

const formatMessageTime = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
};

interface ConversationListItemProps {
  conversation: Conversation;
  partnerName: string;
  partnerAvatar?: string | null;
  unread: boolean;
  onOpen: (conversation: Conversation) => void;
}

export function ConversationListItem({
  conversation,
  partnerName,
  partnerAvatar,
  unread,
  onOpen,
}: ConversationListItemProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(conversation)}
      className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-surface-container-low ${unread ? "bg-primary/5" : ""}`}
    >
      <InitialsAvatar name={partnerName} src={partnerAvatar} className="h-11 w-11" />
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
}
