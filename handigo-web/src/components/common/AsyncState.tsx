import type { ReactNode } from 'react';

interface AsyncStateProps {
  loading?: boolean;
  error?: string;
  empty?: boolean;
  emptyMessage?: string;
  onRetry?: () => void;
  children: ReactNode;
}

export function AsyncState({
  loading,
  error,
  empty,
  emptyMessage = 'Chưa có dữ liệu.',
  onRetry,
  children,
}: AsyncStateProps) {
  if (loading) {
    return <div className="rounded-lg bg-surface-container-low p-8 text-center text-on-surface-variant">Đang tải dữ liệu...</div>;
  }
  if (error) {
    return (
      <div className="rounded-lg border border-error/20 bg-error/10 p-6 text-center text-error">
        <p>{error}</p>
        {onRetry && <button type="button" onClick={onRetry} className="mt-3 rounded-lg bg-error px-4 py-2 text-on-error">Thử lại</button>}
      </div>
    );
  }
  if (empty) {
    return <div className="rounded-lg border border-dashed border-outline-variant p-8 text-center text-on-surface-variant">{emptyMessage}</div>;
  }
  return children;
}
