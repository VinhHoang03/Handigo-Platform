export function StatusBadge({ value }: { value: string }) {
  const tone = value === 'approved' || value === 'active' || value === 'visible'
    ? 'bg-emerald-100 text-emerald-700'
    : value === 'rejected' || value === 'locked' || value === 'hidden' || value === 'expired'
      ? 'bg-red-100 text-red-700'
      : value === 'resubmitted'
        ? 'bg-cyan-100 text-cyan-800'
        : value === 'draft'
          ? 'bg-slate-100 text-slate-700'
      : 'bg-amber-100 text-amber-700';
  const labels: Record<string, string> = {
    approved: 'Đã duyệt',
    pending: 'Chờ duyệt',
    rejected: 'Từ chối',
    resubmitted: 'Đã gửi lại',
    draft: 'Bản nháp',
    active: 'Hoạt động',
    inactive: 'Tạm dừng',
    expired: 'Hết hạn',
    locked: 'Bị khóa',
    visible: 'Đang hiển thị',
    hidden: 'Đã ẩn',
  };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{labels[value] || value}</span>;
}
