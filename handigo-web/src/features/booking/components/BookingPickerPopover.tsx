import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface BookingPickerPopoverProps {
  id: string;
  title: string;
  anchorRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  children: ReactNode;
  zIndex?: number;
}

/** Bảng chọn nổi bám theo nút mở và luôn nằm trong vùng màn hình nhìn thấy. */
export const BookingPickerPopover = ({ id, title, anchorRef, onClose, children, zIndex = 100 }: BookingPickerPopoverProps) => {
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useLayoutEffect(() => {
    const updatePosition = (event?: Event) => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      const panel = panelRef.current;
      if (!anchor || !panel || event?.target === panel) return;
      const margin = 12;
      const gap = 8;
      const viewport = window.visualViewport;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const width = Math.min(340, viewportWidth - margin * 2);
      panel.style.width = `${width}px`;
      panel.style.maxHeight = `${Math.max(0, viewportHeight - margin * 2)}px`;
      const below = viewportTop + viewportHeight - anchor.bottom - gap - margin;
      const above = anchor.top - viewportTop - gap - margin;
      const opensUp = panel.offsetHeight > below && above > below;
      panel.style.left = `${Math.max(viewportLeft + margin, Math.min(anchor.right - width, viewportLeft + viewportWidth - width - margin))}px`;
      const top = opensUp ? anchor.top - panel.offsetHeight - gap : anchor.bottom + gap;
      panel.style.top = `${Math.max(viewportTop + margin, Math.min(top, viewportTop + viewportHeight - panel.offsetHeight - margin))}px`;
    };
    updatePosition();
    const observer = new ResizeObserver(() => updatePosition());
    if (panelRef.current) observer.observe(panelRef.current);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    window.visualViewport?.addEventListener('resize', updatePosition);
    window.visualViewport?.addEventListener('scroll', updatePosition);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      window.visualViewport?.removeEventListener('resize', updatePosition);
      window.visualViewport?.removeEventListener('scroll', updatePosition);
    };
  }, [anchorRef]);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>('[role="listbox"], button')?.focus({ preventScroll: true });
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !anchorRef.current?.contains(target)) closeRef.current();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus({ preventScroll: true });
    };
  }, [anchorRef]);

  return createPortal(
    <section ref={panelRef} id={id} role="dialog" aria-modal="false" aria-labelledby={`${id}-title`}
      style={{ zIndex }} className="fixed overflow-y-auto overscroll-contain rounded-2xl border border-outline-variant bg-surface-container-lowest p-3 shadow-xl">
      <header className="mb-sm flex items-center justify-between gap-sm">
        <h4 id={`${id}-title`} className="text-sm font-bold text-on-surface">{title}</h4>
        <button type="button" aria-label="Đóng" onClick={onClose}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15">
          <X size={20} aria-hidden="true" />
        </button>
      </header>
      {children}
    </section>,
    document.body,
  );
};
