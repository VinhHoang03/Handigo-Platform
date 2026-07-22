import { Skeleton } from "@/components/common/Skeleton";

/**
 * Skeleton cho `DataTable` — bám đúng số cột thật để layout không nhảy khi
 * dữ liệu về. Thay cho chữ "Đang tải..." thô ở các bảng admin.
 */
interface TableSkeletonProps {
  columns: number;
  rowCount?: number;
}

export function TableSkeleton({ columns, rowCount = 6 }: TableSkeletonProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-outline-variant/40 bg-surface-container-lowest">
      <table className="w-full text-left">
        <tbody>
          {Array.from({ length: rowCount }, (_, rowIndex) => (
            <tr key={rowIndex} className="border-t border-outline-variant/30 first:border-t-0">
              {Array.from({ length: columns }, (_, colIndex) => (
                <td key={colIndex} className="p-4">
                  <Skeleton className="h-4 w-full" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
