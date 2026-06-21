import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';

export function MessageComposer({
  disabled,
  onSend,
  onSendImage,
}: {
  disabled?: boolean;
  onSend: (content: string) => Promise<void>;
  onSendImage: (file: File) => Promise<void>;
}) {
  const [content, setContent] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const clearImage = () => {
    setImage(null);
    setPreviewUrl('');
  };

  const selectImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('Chỉ hỗ trợ ảnh JPG, PNG, WEBP hoặc GIF.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Ảnh không được vượt quá 5 MB.');
      return;
    }
    setError('');
    setImage(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = content.trim();
    if (!value && !image) return;
    try {
      setBusy(true);
      setError('');
      if (image) {
        await onSendImage(image);
        clearImage();
      } else {
        await onSend(value);
        setContent('');
      }
    } catch {
      setError(image ? 'Không thể tải và gửi ảnh. Vui lòng thử lại.' : 'Không thể gửi tin nhắn. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="border-t border-outline-variant/30 bg-surface p-3">
      {previewUrl && (
        <div className="relative mb-3 w-fit rounded-2xl border border-outline-variant/40 bg-surface-container-low p-2">
          <img src={previewUrl} alt="Ảnh xem trước" className="h-24 w-24 rounded-xl object-cover" />
          <button type="button" onClick={clearImage} disabled={busy} aria-label="Bỏ ảnh đã chọn" className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-on-surface text-white shadow-md">
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}
      {error && <p className="mb-2 text-xs text-error">{error}</p>}
      <div className="flex items-end gap-2">
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={selectImage} className="hidden" />
      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={disabled || busy} aria-label="Chọn ảnh" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-primary hover:bg-primary/10 disabled:opacity-40">
        <span className="material-symbols-outlined">add_photo_alternate</span>
      </button>
      <input
        value={content}
        onChange={(event) => setContent(event.target.value)}
        disabled={disabled || busy || Boolean(image)}
        className="min-h-11 min-w-0 flex-1 rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm outline-none transition hover:border-outline focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-surface-container"
        placeholder="Nhập tin nhắn..."
      />
      <button disabled={disabled || busy || (!content.trim() && !image)} className="btn-primary min-h-11 rounded-full px-4 py-2 sm:px-5">
        {busy ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : 'Gửi'}
      </button>
      </div>
    </form>
  );
}
