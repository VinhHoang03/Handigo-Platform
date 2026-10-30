import type { SupportTicketCategory } from "../types/caseManagement.types";
import { FormSelect } from "@/components/common/FormSelect";
import { CATEGORY_OPTIONS } from "./ticketFieldOptions.constants";

interface TicketExtraFieldsProps {
  category: SupportTicketCategory;
  disabled: boolean;
  onCategoryChange: (value: SupportTicketCategory) => void;
}

export function TicketExtraFields({ category, disabled, onCategoryChange }: TicketExtraFieldsProps) {
  return <FormSelect id="support-category" name="category" label="Loại hỗ trợ" value={category} disabled={disabled}
    onValueChange={value => onCategoryChange(value as SupportTicketCategory)}>
    {CATEGORY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
  </FormSelect>;
}
