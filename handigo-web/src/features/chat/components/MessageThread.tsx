import { useToast, useToastFeedback } from "@/components/common/Toast";
import { Fragment, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Modal } from "@/components/common/Modal";
import { ReliableImage } from "@/components/common/ReliableImage";
import type { ChatMessage, Conversation } from "../types/chat.types";
import { conversationOrderLabel, conversationOrderStatus, orderConversationMessages } from "../utils/conversationGroups";
import { MessageRow } from "./MessageRow";

const getSenderId = (message: ChatMessage) =>
  typeof message.senderId === "string"
    ? message.senderId
    : message.senderId._id;

interface MessageThreadProps {
  messages: ChatMessage[];
  conversations?: Conversation[];
  currentUserId: string;
  onEdit: (messageId: string, content: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
  hasMore?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
}

export function MessageThread({
  messages,
  conversations = [],
  currentUserId,
  onEdit,
  onDelete,
  hasMore,
  loadingOlder,
  onLoadOlder,
}: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollBeforeLoad = useRef<{ height: number; top: number } | null>(null);
  const orderedMessages = orderConversationMessages(messages, conversations);
  const lastMessageId = orderedMessages.at(-1)?._id;
  const { addToast } = useToast();
  const [menuMessageId, setMenuMessageId] = useState("");
  const [editingMessageId, setEditingMessageId] = useState("");
  const [editingContent, setEditingContent] = useState("");
  const [deletingMessageId, setDeletingMessageId] = useState("");
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [, setActionError] = useToastFeedback<string>("", "error");

  useEffect(() => {
    if (!scrollBeforeLoad.current) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [lastMessageId]);

  useEffect(() => {
    const before = scrollBeforeLoad.current;
    if (!loadingOlder && before && scrollRef.current) {
      scrollRef.current.scrollTop = before.top + scrollRef.current.scrollHeight - before.height;
      scrollBeforeLoad.current = null;
    }
  }, [loadingOlder, messages]);

  const submitEdit = async () => {
    const content = editingContent.trim();
    if (!content) {
      setActionError("Tin nhắn không được để trống.");
      return;
    }
    try {
      setBusy(true);
      setActionError("");
      await onEdit(editingMessageId, content);
      addToast("Đã chỉnh sửa tin nhắn.", "success");
      setEditingMessageId("");
    } catch {
      setActionError("Không thể chỉnh sửa tin nhắn. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    try {
      setBusy(true);
      setActionError("");
      await onDelete(deletingMessageId);
      addToast("Đã xóa tin nhắn.", "success");
      setDeletingMessageId("");
    } catch {
      setActionError("Không thể xóa tin nhắn. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  };

  if (!messages.length)
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-on-surface-variant">
        Chưa có tin nhắn.
      </div>
    );

  return (
    <>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-surface-container-low/40 p-4">
        {hasMore && <button type="button" disabled={loadingOlder} className="w-full py-2 text-sm font-semibold text-primary" onClick={() => {
          if (scrollRef.current) scrollBeforeLoad.current = { height: scrollRef.current.scrollHeight, top: scrollRef.current.scrollTop };
          onLoadOlder?.();
        }}>{loadingOlder ? "Đang tải..." : "Tải tin nhắn cũ hơn"}</button>}
        {orderedMessages.map((message, index) => {
          const isMine = getSenderId(message) === currentUserId;
          const isEditing = editingMessageId === message._id;
          const conversation = conversations.find((item) => item._id === message.conversationId);
          const showOrder = conversation && orderedMessages[index - 1]?.conversationId !== message.conversationId;
          return (
            <Fragment key={message._id}>
            {showOrder && <div className="flex items-center gap-3 py-2" role="separator" aria-label={conversationOrderLabel(conversation)}>
              <span className="h-px flex-1 bg-outline-variant/50" />
              <span className="rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-center text-xs text-on-surface-variant"><span className="block font-semibold">{conversationOrderLabel(conversation)}</span><span className="mt-0.5 block">{conversationOrderStatus(conversation)}</span></span>
              <span className="h-px flex-1 bg-outline-variant/50" />
            </div>}
            <MessageRow
              message={message}
              isMine={isMine}
              isEditing={isEditing}
              editingContent={editingContent}
              onEditingContentChange={setEditingContent}
              onCancelEdit={() => setEditingMessageId("")}
              onSaveEdit={() => void submitEdit()}
              busy={busy}
              menuOpen={menuMessageId === message._id}
              onToggleMenu={() =>
                setMenuMessageId((current) =>
                  current === message._id ? "" : message._id,
                )
              }
              onStartEdit={() => {
                setEditingMessageId(message._id);
                setEditingContent(message.content || "");
                setMenuMessageId("");
              }}
              onRequestDelete={() => {
                setDeletingMessageId(message._id);
                setMenuMessageId("");
              }}
              onPreviewImage={setPreviewImageUrl}
            />
            </Fragment>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <Modal
        open={Boolean(previewImageUrl)}
        title="Ảnh trong cuộc trò chuyện"
        onClose={() => setPreviewImageUrl("")}
        size="lg"
      >
        <ReliableImage
          src={previewImageUrl}
          alt="Ảnh xem kích thước lớn"
          className="mx-auto max-h-[70dvh] max-w-full rounded-2xl object-contain"
        />
      </Modal>
      <ConfirmDialog
        open={Boolean(deletingMessageId)}
        title="Xóa tin nhắn?"
        message="Tin nhắn sẽ bị xóa khỏi cuộc trò chuyện và không thể khôi phục."
        busy={busy}
        onCancel={() => setDeletingMessageId("")}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
