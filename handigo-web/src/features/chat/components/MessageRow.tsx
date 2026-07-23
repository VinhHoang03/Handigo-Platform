import { ReliableImage } from "@/components/common/ReliableImage";
import { normalizeImageUrl } from "@/utils/imageUrl";
import type { ChatMessage } from "../types/chat.types";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

interface MessageRowProps {
  message: ChatMessage;
  isMine: boolean;
  isEditing: boolean;
  editingContent: string;
  onEditingContentChange: (value: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  busy: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onStartEdit: () => void;
  onRequestDelete: () => void;
  onPreviewImage: (url: string) => void;
}

export function MessageRow({
  message,
  isMine,
  isEditing,
  editingContent,
  onEditingContentChange,
  onCancelEdit,
  onSaveEdit,
  busy,
  menuOpen,
  onToggleMenu,
  onStartEdit,
  onRequestDelete,
  onPreviewImage,
}: MessageRowProps) {
  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div className="group relative max-w-[82%]">
        <div
          className={`relative rounded-2xl px-4 py-2.5 shadow-sm ${isMine ? "rounded-br-md bg-primary text-on-primary" : "rounded-bl-md border border-outline-variant/30 bg-surface-container-lowest text-on-surface"}`}
        >
          {isEditing ? (
            <div className="w-[min(260px,65vw)] space-y-2">
              <textarea
                value={editingContent}
                onChange={(event) => onEditingContentChange(event.target.value)}
                maxLength={2000}
                rows={3}
                autoFocus
                className="w-full resize-none rounded-xl border border-outline-variant bg-surface-container-lowest p-2 text-sm text-on-surface outline-none focus:border-primary"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onCancelEdit}
                  disabled={busy}
                  className="rounded-lg px-3 py-1.5 text-xs text-on-primary hover:bg-white/10"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={onSaveEdit}
                  disabled={busy}
                  className="rounded-lg bg-surface-container-lowest px-3 py-1.5 text-xs font-bold text-primary disabled:opacity-50"
                >
                  Lưu
                </button>
              </div>
            </div>
          ) : (
            <>
              {message.content && (
                <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
              )}
              {message.imageUrl && (
                <button
                  type="button"
                  onClick={() => onPreviewImage(normalizeImageUrl(message.imageUrl))}
                  className="block overflow-hidden rounded-xl focus:outline-none focus:ring-2 focus:ring-white/70"
                >
                  <ReliableImage
                    src={message.imageUrl}
                    alt="Ảnh trong cuộc trò chuyện"
                    className="max-h-60 max-w-full rounded-xl object-cover"
                  />
                </button>
              )}
              <p
                className={`mt-1 text-right text-[10px] ${isMine ? "text-on-primary/75" : "text-on-surface-variant"}`}
              >
                {new Date(message.createdAt).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </>
          )}
        </div>

        {isMine && !isEditing && (
          <div className="absolute right-full top-1/2 z-10 mr-2 -translate-y-1/2">
            <button
              type="button"
              onClick={onToggleMenu}
              aria-label="Thao tác với tin nhắn"
              className="grid h-8 w-8 place-items-center rounded-full bg-surface-container-lowest text-on-surface-variant opacity-100 shadow-md transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
            >
              <MoreHorizontal aria-hidden="true" size={18} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-9 w-40 overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest py-1 text-on-surface shadow-xl">
                {message.messageType === "text" && (
                  <button
                    type="button"
                    onClick={onStartEdit}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-surface-container-low"
                  >
                    <Pencil aria-hidden="true" size={18} />
                    Chỉnh sửa
                  </button>
                )}
                <button
                  type="button"
                  onClick={onRequestDelete}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-error hover:bg-error/5"
                >
                  <Trash2 aria-hidden="true" size={18} />
                  Xóa
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
