interface QuotationNotesFieldsProps {
  inspectionNote: string;
  recommendation: string;
  maxLength: number;
  onInspectionNoteChange: (value: string) => void;
  onRecommendationChange: (value: string) => void;
}

export function QuotationNotesFields({
  inspectionNote,
  recommendation,
  maxLength,
  onInspectionNoteChange,
  onRecommendationChange,
}: QuotationNotesFieldsProps) {
  return (
    <div className="grid gap-md md:grid-cols-2">
      <label className="space-y-2">
        <span className="text-label-sm text-on-surface-variant">Ghi chú khảo sát</span>
        <textarea
          value={inspectionNote}
          onChange={(event) => onInspectionNoteChange(event.target.value)}
          maxLength={maxLength}
          rows={4}
          className="w-full rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
          placeholder="Mô tả tình trạng thiết bị sau khi kiểm tra..."
        />
      </label>
      <label className="space-y-2">
        <span className="text-label-sm text-on-surface-variant">Đề xuất xử lý</span>
        <textarea
          value={recommendation}
          onChange={(event) => onRecommendationChange(event.target.value)}
          maxLength={maxLength}
          rows={4}
          className="w-full rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
          placeholder="Phương án sửa chữa đề xuất..."
        />
      </label>
    </div>
  );
}
