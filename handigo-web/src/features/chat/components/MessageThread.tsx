import type { ChatMessage } from '../types/chat.types';

export function MessageThread({ messages }: { messages: ChatMessage[] }) {
  if (!messages.length) return <div className="flex flex-1 items-center justify-center text-sm text-on-surface-variant">Chưa có tin nhắn.</div>;
  return (
    <div className="flex-1 space-y-3 overflow-y-auto p-4">
      {messages.map((message) => <div key={message._id} className="max-w-[80%] rounded-2xl bg-surface-container-low p-3"><p>{message.content}</p><p className="mt-1 text-[10px] text-on-surface-variant">{new Date(message.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p></div>)}
    </div>
  );
}
