interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-6 flex items-center justify-center gap-3">
      <button disabled={page <= 1} onClick={() => onChange(page - 1)} className="rounded-xl border border-outline-variant px-4 py-2 disabled:opacity-40">Trước</button>
      <span className="text-sm text-on-surface-variant">Trang {page}/{totalPages}</span>
      <button disabled={page >= totalPages} onClick={() => onChange(page + 1)} className="rounded-xl border border-outline-variant px-4 py-2 disabled:opacity-40">Sau</button>
    </div>
  );
}
