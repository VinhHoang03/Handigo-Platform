/**
 * Bảng dữ liệu chỉ dành cho trình đọc màn hình.
 *
 * Recharts xuất ra SVG trần: không xử lý gì thì biểu đồ hoàn toàn vô hình với
 * screen reader. `aria-label` tóm tắt là chưa đủ khi người dùng cần từng con số,
 * nên mỗi biểu đồ đi kèm bảng này ở chế độ `sr-only`.
 */
interface ChartA11yTableProps {
  caption: string;
  columns: string[];
  rows: Array<{ key: string; cells: Array<string | number> }>;
}

export function ChartA11yTable({ caption, columns, rows }: ChartA11yTableProps) {
  if (!rows.length) return null;

  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column} scope="col">{column}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            {row.cells.map((cell, index) => (
              <td key={`${row.key}-${index}`}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
