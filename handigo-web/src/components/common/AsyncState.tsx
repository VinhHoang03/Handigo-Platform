import type { ReactNode } from 'react';
import { SkeletonRegion } from './Skeleton';

interface AsyncStateProps {
  loading?: boolean;
  error?: string;
  empty?: boolean;
  emptyMessage?: string;
  onRetry?: () => void;
  /**
   * Skeleton bám theo hình dạng nội dung thật. Truyền vào thì dùng thay cho dòng
   * chữ "Đang tải dữ liệu..." mặc định — tránh layout nhảy khi dữ liệu về.
   * Bỏ trống thì giữ nguyên hành vi cũ, nên 23 nơi đang dùng không bị ảnh hưởng.
   */
  skeleton?: ReactNode;
  children: ReactNode;
}

export function AsyncState({
  loading,
  error,
  empty,
  emptyMessage = 'Chưa có dữ liệu.',
  onRetry,
  skeleton,
  children,
}: AsyncStateProps) {
  if (loading) {
    if (skeleton) return <SkeletonRegion>{skeleton}</SkeletonRegion>;
    return (
      <div
        role="status"
        aria-busy="true"
        className="rounded-lg bg-surface-container-low p-8 text-center text-on-surface-variant"
      >
        Đang tải dữ liệu...
      </div>
    );
  }
  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-error/20 bg-error/10 p-6 text-center text-error">
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
