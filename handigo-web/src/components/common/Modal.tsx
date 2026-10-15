import { useEffect, useId, useRef, type MouseEvent, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
  danger?: boolean;
  contentRef?: Ref<HTMLDivElement>;
  placement?: 'center' | 'side';
  footer?: ReactNode;
  compact?: boolean;
}

const sizeClass: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'sm:max-w-[560px]',
  md: 'sm:max-w-[720px]',
  lg: 'sm:max-w-[960px]',
  xl: 'sm:max-w-[1120px]',
};

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

// Nhiều modal có thể đóng không theo thứ tự mở, nên dùng chung trạng thái khóa cuộn.
let openModalCount = 0;
let previousBodyOverflow = '';

export function Modal({
  open,
  title,
  onClose,
  children,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEsc = true,
  danger = false,
  contentRef,
  placement = 'center',
  footer,
  compact = false,
}: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    previousFocusRef.current = document.activeElement;
    if (openModalCount === 0) previousBodyOverflow = document.body.style.overflow;
    openModalCount += 1;
    document.body.style.overflow = 'hidden';

    window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      const firstFocusable = dialog?.querySelector<HTMLElement>(focusableSelector);
      (firstFocusable || dialog)?.focus();
    });

    return () => {
      openModalCount -= 1;
      if (openModalCount === 0) document.body.style.overflow = previousBodyOverflow;
      const previousFocus = previousFocusRef.current;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEsc) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => {
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });

      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeOnEsc, open]);

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (closeOnOverlayClick && event.target === event.currentTarget) onClose();
  };

  if (!open) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[200] flex min-h-0 min-w-0 items-end justify-center overflow-hidden p-0 sm:items-center sm:p-6 ${placement === 'side' ? 'bg-on-surface/20 sm:justify-end' : 'bg-on-surface/50 backdrop-blur-sm'}`}
      onMouseDown={handleOverlayClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`flex max-h-[calc(100dvh-8px)] w-full min-w-0 max-w-full flex-col overflow-hidden rounded-t-3xl border border-outline-variant/30 bg-surface shadow-2xl sm:max-h-[calc(100dvh-48px)] sm:w-[calc(100vw-48px)] sm:rounded-3xl ${compact && placement === 'side' ? 'sm:max-w-[480px]' : sizeClass[size]} ${placement === 'side' && !compact ? 'sm:h-full' : ''}`}
      >
        <div className={`flex shrink-0 items-center justify-between border-b px-4 ${compact ? 'gap-2 py-3' : 'gap-4 py-4 sm:px-8'} ${danger ? 'border-error/20 bg-error/5' : 'border-outline-variant/40'}`}>
          <h2 id={titleId} className={`min-w-0 font-bold ${compact ? 'text-lg leading-6' : 'text-xl sm:text-headline-md'} ${danger ? 'text-error' : 'text-on-surface'}`}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
            aria-label="Đóng"
          >
            x
          </button>
        </div>
        <div ref={contentRef} className={`min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 ${compact ? 'py-4' : 'py-5 sm:px-8 sm:py-6'}`}>
          {children}
        </div>
        {footer && <div className={`shrink-0 border-t border-outline-variant/40 px-4 ${compact ? 'py-3' : 'py-4 sm:px-8'}`}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
