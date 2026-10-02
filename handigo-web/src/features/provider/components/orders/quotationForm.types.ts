import type { CreateQuotationPayload, QuotationItem } from '../../types/providerOrder.types';
import type { QuotationHistoryItem, QuotationFields } from '../../types/quotationAgent.types';

export type QuotationFormItem = CreateQuotationPayload['items'][number] & {
  rowId: string;
  manualFields?: Array<keyof QuotationFields>;
  historySource?: QuotationHistoryItem;
  description: string;
  note: string;
};

export const quotationItemTypes: Array<{ value: QuotationItem['itemType']; label: string }> = [
  { value: 'labor', label: 'Nhân công' },
  { value: 'material', label: 'Vật tư' },
  { value: 'replacement_part', label: 'Linh kiện thay thế' },
  { value: 'other', label: 'Khác' },
];
