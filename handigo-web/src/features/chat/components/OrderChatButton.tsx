import { useState } from 'react';
import { ChatPopup } from './ChatPopup';

interface OrderChatButtonProps {
  orderId: string;
  disabled?: boolean;
  floating?: boolean;
}

export function OrderChatButton({ orderId, disabled, floating = false }: OrderChatButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-label="Mở trò chuyện về đơn dịch vụ"
        className={floating
          ? 'fixed bottom-6 right-6 z-[80] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-2xl transition hover:scale-105 disabled:opacity-40'
          : 'rounded-xl bg-primary px-4 py-2 font-semibold text-on-primary disabled:opacity-40'}
      >
        {floating ? <span className="material-symbols-outlined text-2xl">chat_bubble</span> : 'Nhắn tin'}
      </button>
      <ChatPopup orderId={orderId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
