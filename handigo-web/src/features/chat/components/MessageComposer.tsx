import { useState } from 'react';

export function MessageComposer({ disabled, onSend }: { disabled?: boolean; onSend: (content: string) => Promise<void> }) {
  const [content, setContent] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = content.trim();
    if (!value) return;
    await onSend(value);
    setContent('');
  };
  return <form onSubmit={submit} className="flex gap-2 border-t border-outline-variant/30 p-3"><input value={content} onChange={(e) => setContent(e.target.value)} disabled={disabled} className="min-w-0 flex-1 rounded-full border border-outline-variant px-4 py-2" placeholder="Nhập tin nhắn..." /><button disabled={disabled || !content.trim()} className="rounded-full bg-primary px-4 text-on-primary disabled:opacity-40">Gửi</button></form>;
}
