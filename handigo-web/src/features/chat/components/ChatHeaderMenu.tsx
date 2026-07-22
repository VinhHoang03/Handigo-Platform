import type { RefObject } from 'react';

interface ChatHeaderMenuProps {
  open: boolean;
  menuRef: RefObject<HTMLDivElement | null>;
  onToggle: () => void;
  onMarkAsRead: () => void;
  onReport: () => void;
}

export function ChatHeaderMenu({ open, menuRef, onToggle, onMarkAsRead, onReport }: ChatHeaderMenuProps) {
  return (
    <div ref={menuRef} className="relative">
      <button type="button" onClick={onToggle} aria-label="Thao tác khác" className="rounded-full p-2 hover:bg-white/15">
        <span className="material-symbols-outlined block text-xl">more_vert</span>
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-10 w-56 overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest py-2 text-on-surface shadow-xl">
          <button type="button" onClick={onMarkAsRead} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-surface-container-low">
            <span className="material-symbols-outlined text-xl text-primary">done_all</span>Đánh dấu đã đọc
          </button>
          <button type="button" onClick={onReport} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-error hover:bg-error/5">
            <span className="material-symbols-outlined text-xl">flag</span>Báo cáo đoạn chat
          </button>
        </div>
      )}
    </div>
  );
}
