import type { SupportTicketCategory, SupportTicketPriority } from "../types/caseManagement.types";
import { SUPPORT_PRIORITY_LABELS } from "./supportLabels.constants";
import { CATEGORY_OPTIONS } from "./ticketFieldOptions.constants";

interface TicketExtraFieldsProps {
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  disabled: boolean;
  onCategoryChange: (value: SupportTicketCategory) => void;
  onPriorityChange: (value: SupportTicketPriority) => void;
}

export function TicketExtraFields({
  category,
  priority,
  disabled,
  onCategoryChange,
  onPriorityChange,
}: TicketExtraFieldsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-semibold">
        Danh mục
        <select
          value={category}
          onChange={(event) => onCategoryChange(event.target.value as SupportTicketCategory)}
          disabled={disabled}
          className="mt-2 min-h-12 w-full rounded-xl border border-outline-variant bg-surface px-3"
        >
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      <label className="text-sm font-semibold">
        Mức ưu tiên
        <select
          value={priority}
          onChange={(event) => onPriorityChange(event.target.value as SupportTicketPriority)}
          disabled={disabled}
          className="mt-2 min-h-12 w-full rounded-xl border border-outline-variant bg-surface px-3"
        >
          {Object.entries(SUPPORT_PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
    </div>
  );
}
