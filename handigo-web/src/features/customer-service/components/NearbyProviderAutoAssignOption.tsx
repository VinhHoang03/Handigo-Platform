interface NearbyProviderAutoAssignOptionProps {
  isSelected: boolean;
  onSelect: () => void;
}

/** Lựa chọn "để Handigo tự tìm thợ", luôn đứng đầu danh sách. */
export function NearbyProviderAutoAssignOption({
  isSelected,
  onSelect,
}: NearbyProviderAutoAssignOptionProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${
        isSelected
          ? "border-primary bg-primary-container/10"
          : "border-outline-variant/40 bg-surface-container-lowest hover:border-primary/50"
      }`}
    >
      <span className={`material-symbols-outlined ${isSelected ? "text-primary" : "text-on-surface-variant"}`}>
        auto_awesome
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-on-surface">
          Handigo tự tìm thợ
        </span>
        <span className="block text-xs text-on-surface-variant">
          Hệ thống sẽ lần lượt gửi yêu cầu đến các chuyên gia phù hợp.
        </span>
      </span>
      {isSelected && (
        <span className="material-symbols-outlined text-primary">check_circle</span>
      )}
    </button>
  );
}
