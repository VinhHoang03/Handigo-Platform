import { z } from "zod";

export const quotationFieldsSchema = z.object({
  title: z.string().trim().max(200),
  description: z.string().trim().max(2000),
  itemType: z.enum(["labor", "material", "replacement_part", "other"]),
  quantity: z.number().int().min(1).max(1000),
  unitPrice: z.number().min(0).max(1_000_000_000),
  note: z.string().trim().max(1000),
}).strict();

export const quotationAgentInputSchema = z.object({
  instruction: z.string().trim().min(1).max(6000),
  revision: z.number().int().nonnegative(),
  items: z.array(quotationFieldsSchema.extend({ rowId: z.string().min(1).max(80) })).max(100),
  inspectionNote: z.string().max(2000),
  recommendation: z.string().max(2000),
}).strict().refine((input) => new Set(input.items.map((item) => item.rowId)).size === input.items.length,
  "Mã dòng báo giá phải duy nhất.");

export const quotationHistoryQuerySchema = z.object({ query: z.string().trim().min(2).max(200) });
export const quotationProposalSchema = z.object({
  message: z.string().min(1).max(2000),
  updates: z.array(z.object({
    rowId: z.string().min(1).max(80).optional(),
    fields: quotationFieldsSchema.partial(),
    historyId: z.string().max(80).optional(),
    priceEvidence: z.string().max(200).optional(),
  }).strict()).max(30),
  inspectionNote: z.string().max(2000).optional(),
  recommendation: z.string().max(2000).optional(),
}).strict();

export type QuotationAgentInput = z.infer<typeof quotationAgentInputSchema>;
export type QuotationProposal = z.infer<typeof quotationProposalSchema>;
