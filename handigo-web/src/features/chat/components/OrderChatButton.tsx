import { useState } from 'react';
import { ChatPopup } from './ChatPopup';

export function OrderChatButton({ orderId, disabled }: { orderId: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button disabled={disabled} onClick={() => setOpen(true)} className="rounded-xl bg-primary px-4 py-2 font-semibold text-on-primary disabled:opacity-40">Nhắn tin</button>
      <ChatPopup orderId={orderId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
