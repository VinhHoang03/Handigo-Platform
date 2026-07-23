import type { ReactNode } from "react";

/**
 * Bảng dữ liệu dùng chung cho các trang admin (title → filter → bảng → phân
 * trang). Component thuần hiển thị: không tự fetch, không giữ state — nơi gọi
 * truyền `rows` đã lọc/phân trang sẵn.
 *
 * Cột số/tiền/ngày nên thêm `tabular-nums` vào `className` để các chữ số
 * thẳng hàng theo chiều dọc.
 */
export interface DataTableColumn<T> {
  /** Khoá duy nhất của cột, dùng làm React key cho ô đầu/thân. */
  key: string;
  header: ReactNode;
  /** Áp cho cả ô đầu và ô thân, ví dụ `"text-right tabular-nums"`. */
  className?: string;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Array<DataTableColumn<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  /** Hiển thị khi `rows` rỗng. Mặc định một dòng chữ trung tính. */
  emptyState?: ReactNode;
  onRowClick?: (row: T) => void;
  /** Lớp `min-w-*` cho `<table>` — chỉnh khi bảng có nhiều cột hơn mức mặc định. */
  minWidthClassName?: string;
}

const defaultEmptyState = (
  <div className="p-10 text-center text-on-surface-variant">Không có dữ liệu.</div>
);

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyState = defaultEmptyState,
  onRowClick,
  minWidthClassName = "min-w-[720px]",
}: DataTableProps<T>) {
  return (
    // Bảng cuộn ngang trong khung riêng của nó — trang không bao giờ cuộn ngang.
    <div className="overflow-x-auto rounded-2xl border border-outline-variant/40 bg-surface-container-lowest">
      <table className={`w-full text-left ${minWidthClassName}`}>
        <thead className="bg-surface-container-low text-sm">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={`p-4 font-semibold ${column.className || ""}`}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>{emptyState}</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-t border-outline-variant/30 ${
                  onRowClick ? "cursor-pointer hover:bg-surface-container-low" : ""
                }`}
              >
                {columns.map((column) => (
                  <td key={column.key} className={`p-4 ${column.className || ""}`}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
