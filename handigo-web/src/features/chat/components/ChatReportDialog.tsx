import { useState, type FormEvent } from 'react';

interface ChatReportDialogProps {
  onClose: () => void;
  onSubmit: (description: string) => Promise<void>;
}

export function ChatReportDialog({ onClose, onSubmit }: ChatReportDialogProps) {
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = description.trim();
    if (trimmed.length < 10) {
      setError('Nội dung báo cáo phải có ít nhất 10 ký tự.');
      return;
    }
    try {
      setBusy(true);
      setError('');
      await onSubmit(trimmed);
      setDescription('');
    } catch {
      setError('Không thể gửi báo cáo. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute inset-0 z-20 flex items-end bg-on-surface/35 p-3 sm:items-center">
      <form onSubmit={submit} className="w-full rounded-3xl bg-surface-container-lowest p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-on-surface">Báo cáo đoạn chat</h3>
            <p className="mt-1 text-sm text-on-surface-variant">Mô tả rõ nội dung cần được kiểm tra.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng báo cáo" className="rounded-full p-1 hover:bg-surface-container-low">
            <span className="material-symbols-outlined block">close</span>
          </button>
        </div>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={1000}
          rows={5}
          className="mt-4 w-full resize-none rounded-2xl border border-outline-variant p-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
          placeholder="Nhập nội dung báo cáo..."
        />
        <div className="mt-1 flex justify-between gap-2 text-xs">
          <span className="text-error">{error}</span>
          <span className="text-on-surface-variant">{description.length}/1000</span>
        </div>
        <button type="submit" disabled={busy} className="btn-primary mt-4 w-full disabled:opacity-50">
          {busy ? 'Đang gửi...' : 'Gửi báo cáo'}
        </button>
      </form>
    </div>
  );
}
