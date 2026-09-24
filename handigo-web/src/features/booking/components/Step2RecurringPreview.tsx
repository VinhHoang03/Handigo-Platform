interface Step2RecurringPreviewProps {
  dates: Date[];
}

/** Danh sách các buổi dự kiến khi chọn lịch định kỳ. */
export const Step2RecurringPreview = ({ dates }: Step2RecurringPreviewProps) => {
  if (dates.length === 0) return null;

  return (
    <div className="rounded-xl bg-surface-container-low p-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
        Các buổi dự kiến
      </p>
      <div className="mt-xs grid gap-xs sm:grid-cols-2 xl:grid-cols-3">
        {dates.map((date, index) => (
          <div key={date.toISOString()} className="flex items-center gap-xs text-sm text-on-surface">
            <span className="font-bold text-primary">{index + 1}.</span>
            {date.toLocaleString('vi-VN')}
          </div>
        ))}
      </div>
    </div>
  );
};
