import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Modal } from "@/components/common/Modal";
import { ReliableImage } from "@/components/common/ReliableImage";
import type { ChatMessage } from "../types/chat.types";
import { MessageRow } from "./MessageRow";

const getSenderId = (message: ChatMessage) =>
  typeof message.senderId === "string"
    ? message.senderId
    : message.senderId._id;

interface MessageThreadProps {
  messages: ChatMessage[];
  currentUserId: string;
  onEdit: (messageId: string, content: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
}

export function MessageThread({
  messages,
  currentUserId,
  onEdit,
  onDelete,
}: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [menuMessageId, setMenuMessageId] = useState("");
  const [editingMessageId, setEditingMessageId] = useState("");
  const [editingContent, setEditingContent] = useState("");
  const [deletingMessageId, setDeletingMessageId] = useState("");
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

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
      <div className="flex-1 space-y-3 overflow-y-auto bg-surface-container-low/40 p-4">
        {actionError && (
          <p className="rounded-xl bg-error/10 px-3 py-2 text-xs text-error">
            {actionError}
          </p>
        )}
        {messages.map((message) => {
          const isMine = getSenderId(message) === currentUserId;
          const isEditing = editingMessageId === message._id;
          return (
            <MessageRow
              key={message._id}
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
