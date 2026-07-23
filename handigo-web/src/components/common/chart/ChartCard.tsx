import type { ReactNode } from "react";
import { Skeleton } from "@/components/common/Skeleton";

interface ChartCardProps {
  title: string;
  description?: string;
  /** Nút lọc, nút đổi kỳ... nằm bên phải tiêu đề. */
  action?: ReactNode;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  /** Có dữ liệu hay không — rỗng thì hiện `emptyMessage` thay vì biểu đồ trống. */
  isEmpty?: boolean;
  emptyMessage?: string;
  /** Chiều cao vùng vẽ. Truyền cùng giá trị cho skeleton để không nhảy layout. */
  height?: number;
  children: ReactNode;
}

/**
 * Khung chung cho biểu đồ: tiêu đề, mô tả, và ba trạng thái tải/lỗi/rỗng.
 *
 * Không dùng `AsyncState` vì skeleton ở đây phải giữ đúng chiều cao vùng vẽ —
 * nếu không, lúc dữ liệu về cả trang sẽ giật.
 */
export function ChartCard({
  title,
  description,
  action,
  loading,
  error,
  onRetry,
  isEmpty,
  emptyMessage = "Chưa có dữ liệu trong kỳ đã chọn.",
  height = 260,
  children,
}: ChartCardProps) {
  return (
    <article className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-title-lg font-bold text-on-surface">{title}</h2>
          {description && (
            <p className="mt-1 text-sm text-on-surface-variant">{description}</p>
          )}
        </div>
        {action}
      </div>

      {loading ? (
        <Skeleton className="w-full" rounded="rounded-xl" style={{ height }} />
      ) : error ? (
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-3 rounded-xl border border-error/20 bg-error/10 p-6 text-center text-error"
          style={{ minHeight: height }}
        >
          <p>{error}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg bg-error px-4 py-2 font-semibold text-on-error"
            >
              Thử lại
            </button>
          )}
        </div>
      ) : isEmpty ? (
        <div
          className="flex items-center justify-center rounded-xl border border-dashed border-outline-variant p-6 text-center text-on-surface-variant"
          style={{ minHeight: height }}
        >
          {emptyMessage}
        </div>
      ) : (
        children
      )}
    </article>
  );
}
