import type { ReactNode } from 'react';

export function ChartDataTable({ caption, columns, rows }: {
  caption: string;
  columns: string[];
  rows: Array<Array<ReactNode>>;
}) {
  return (
    <div role="region" aria-label={`Bảng số liệu: ${caption}`} tabIndex={0}
      className="max-h-80 overflow-auto rounded-xl border border-outline-variant/40 focus-visible:outline-2 focus-visible:outline-primary">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-surface-container">
          <tr>{columns.map((column, index) => <th key={`${column}-${index}`} scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">{column}</th>)}</tr>
        </thead>
        <tbody>{rows.map((row, index) => (
          <tr key={index} className="border-t border-outline-variant/30">
            {row.map((cell, cellIndex) => <td key={cellIndex} className={`px-4 py-3 ${cellIndex ? "whitespace-nowrap tabular-nums" : "min-w-32 break-words"}`}>{cell}</td>)}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

