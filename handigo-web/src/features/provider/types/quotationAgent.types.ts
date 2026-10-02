import type { CreateQuotationPayload } from './providerOrder.types';

export type QuotationFields = CreateQuotationPayload['items'][number] & { description: string; note: string };
export interface QuotationHistoryItem {
  id: string;
  title: string;
  description: string;
  itemType: QuotationFields['itemType'];
  unitPrice: number;
  usedAt: string;
}
export interface QuotationAgentSnapshot {
  revision: number;
  items: Array<QuotationFields & { rowId: string }>;
  inspectionNote: string;
  recommendation: string;
}
export interface QuotationAgentResult {
  revision: number;
  message: string;
  updates: Array<{ rowId?: string; fields: Partial<QuotationFields>; historyId?: string }>;
  inspectionNote?: string;
  recommendation?: string;
  sources: QuotationHistoryItem[];
  warnings: string[];
  choiceGroups?: Array<{ label: string; multiple: boolean; options: string[] }>;
}
