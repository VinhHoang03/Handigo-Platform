import { useState, type FormEvent } from 'react';

export function MessageComposer({
  disabled,
  onSend,
}: {
  disabled?: boolean;
  onSend: (content: string) => Promise<void>;
}) {
  const [content, setContent] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = content.trim();
    if (!value) return;
    await onSend(value);
    setContent('');
  };

  return (
    <form onSubmit={submit} className="flex gap-2 border-t border-outline-variant/30 bg-surface p-3">
      <input
        value={content}
        onChange={(event) => setContent(event.target.value)}
        disabled={disabled}
        className="min-h-11 min-w-0 flex-1 rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm outline-none transition hover:border-outline focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-surface-container"
        placeholder="Nhập tin nhắn..."
      />
      <button disabled={disabled || !content.trim()} className="btn-primary min-h-11 rounded-full px-5 py-2">
        Gửi
      </button>
    </form>
  );
}
