import { useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Modal } from '@/components/common/Modal';
import { ReliableImage } from '@/components/common/ReliableImage';
import { normalizeImageUrl } from '@/utils/imageUrl';
import type { ChatMessage } from '../types/chat.types';

const getSenderId = (message: ChatMessage) =>
  typeof message.senderId === 'string' ? message.senderId : message.senderId._id;

interface MessageThreadProps {
  messages: ChatMessage[];
  currentUserId: string;
  onEdit: (messageId: string, content: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
}

export function MessageThread({ messages, currentUserId, onEdit, onDelete }: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [menuMessageId, setMenuMessageId] = useState('');
  const [editingMessageId, setEditingMessageId] = useState('');
  const [editingContent, setEditingContent] = useState('');
  const [deletingMessageId, setDeletingMessageId] = useState('');
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const submitEdit = async () => {
    const content = editingContent.trim();
    if (!content) {
      setActionError('Tin nhắn không được để trống.');
      return;
    }
    try {
      setBusy(true);
      setActionError('');
      await onEdit(editingMessageId, content);
      setEditingMessageId('');
    } catch {
      setActionError('Không thể chỉnh sửa tin nhắn. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    try {
      setBusy(true);
      setActionError('');
      await onDelete(deletingMessageId);
      setDeletingMessageId('');
    } catch {
      setActionError('Không thể xóa tin nhắn. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  if (!messages.length) return <div className="flex flex-1 items-center justify-center text-sm text-on-surface-variant">Chưa có tin nhắn.</div>;

  return (
    <>
      <div className="flex-1 space-y-3 overflow-y-auto bg-surface-container-low/40 p-4">
        {actionError && <p className="rounded-xl bg-error/10 px-3 py-2 text-xs text-error">{actionError}</p>}
        {messages.map((message) => {
          const isMine = getSenderId(message) === currentUserId;
          const isEditing = editingMessageId === message._id;
          return (
            <div key={message._id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className="group relative max-w-[82%]">
              <div className={`relative rounded-2xl px-4 py-2.5 shadow-sm ${isMine ? 'rounded-br-md bg-primary text-on-primary' : 'rounded-bl-md border border-outline-variant/30 bg-white text-on-surface'}`}>
                {isEditing ? (
                  <div className="w-[min(260px,65vw)] space-y-2">
                    <textarea value={editingContent} onChange={(event) => setEditingContent(event.target.value)} maxLength={2000} rows={3} autoFocus className="w-full resize-none rounded-xl border border-outline-variant bg-white p-2 text-sm text-on-surface outline-none focus:border-primary" />
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setEditingMessageId('')} disabled={busy} className="rounded-lg px-3 py-1.5 text-xs text-on-primary hover:bg-white/10">Hủy</button>
                      <button type="button" onClick={() => void submitEdit()} disabled={busy} className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-primary disabled:opacity-50">Lưu</button>
                    </div>
                  </div>
                ) : (
                  <>
                    {message.content && <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>}
                    {message.imageUrl && (
                      <button type="button" onClick={() => setPreviewImageUrl(normalizeImageUrl(message.imageUrl))} className="block overflow-hidden rounded-xl focus:outline-none focus:ring-2 focus:ring-white/70">
                        <ReliableImage src={message.imageUrl} alt="Ảnh trong cuộc trò chuyện" className="max-h-60 max-w-full rounded-xl object-cover" />
                      </button>
                    )}
                    <p className={`mt-1 text-right text-[10px] ${isMine ? 'text-on-primary/75' : 'text-on-surface-variant'}`}>
                      {new Date(message.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </>
                )}
              </div>

              {isMine && !isEditing && (
                <div className="absolute right-full top-1/2 z-10 mr-2 -translate-y-1/2">
                  <button type="button" onClick={() => setMenuMessageId((current) => current === message._id ? '' : message._id)} aria-label="Thao tác với tin nhắn" className="grid h-8 w-8 place-items-center rounded-full bg-white text-on-surface-variant opacity-100 shadow-md transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100">
                    <span className="material-symbols-outlined text-lg">more_horiz</span>
                  </button>
                  {menuMessageId === message._id && (
                    <div className="absolute right-0 top-9 w-40 overflow-hidden rounded-2xl border border-outline-variant/40 bg-white py-1 text-on-surface shadow-xl">
                      {message.messageType === 'text' && (
                        <button type="button" onClick={() => { setEditingMessageId(message._id); setEditingContent(message.content || ''); setMenuMessageId(''); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-surface-container-low"><span className="material-symbols-outlined text-lg">edit</span>Chỉnh sửa</button>
                      )}
                      <button type="button" onClick={() => { setDeletingMessageId(message._id); setMenuMessageId(''); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-error hover:bg-error/5"><span className="material-symbols-outlined text-lg">delete</span>Xóa</button>
                    </div>
                  )}
                </div>
              )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <Modal open={Boolean(previewImageUrl)} title="Ảnh trong cuộc trò chuyện" onClose={() => setPreviewImageUrl('')} size="lg">
        <ReliableImage src={previewImageUrl} alt="Ảnh xem kích thước lớn" className="mx-auto max-h-[70dvh] max-w-full rounded-2xl object-contain" />
      </Modal>
      <ConfirmDialog open={Boolean(deletingMessageId)} title="Xóa tin nhắn?" message="Tin nhắn sẽ bị xóa khỏi cuộc trò chuyện và không thể khôi phục." busy={busy} variant="danger" onCancel={() => setDeletingMessageId('')} onConfirm={() => void confirmDelete()} />
    </>
  );
}
