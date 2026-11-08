import { z } from "zod";
import { complaintWorkflowSchema } from "./admin-ai.complaint-schema";
import { SUPPORT_TICKET_CATEGORIES, SUPPORT_TICKET_PRIORITIES } from "../../models/supportTicket.model";

export const FEATURES = ["provider_application", "service_suggestion", "complaint_summary", "operations_report", "support_classification", "reply_draft"] as const;
export const RETIRED_FEATURES = ["reply_draft", "operations_report", "support_classification"] as const;
export const featureSchema = z.enum(FEATURES).refine(feature => !RETIRED_FEATURES.some(retired => retired === feature), "Chức năng AI này đã được ngừng sử dụng.");
// Giữ mã cũ để đọc lịch sử; chặn cấu hình và tạo tác vụ cho chức năng đã ngừng.
export type AdminAIFeature = typeof FEATURES[number];
export const criterionSchema = z.object({
  code: z.string().regex(/^[a-z][a-z0-9_]{1,49}$/, "Mã tiêu chí không hợp lệ."),
  description: z.string().trim().min(5).max(1000),
  kind: z.enum(["description_length", "experience_years", "identity_images", "identity_expiry", "certificate_presence", "certificate_expiry", "verified_identity", "ai"]),
  required: z.boolean(), value: z.number().min(0).max(10000).default(0),
}).strict();
export const policySchema = z.object({
  instructions: z.string().trim().max(6000).default(""),
  autoRejectIncompleteApplications: z.boolean().default(false),
  criteria: z.array(criterionSchema).max(30).default([]),
  applicationTypes: z.array(z.enum(["initial", "service_addition"])).min(1).default(["initial", "service_addition"]),
  categories: z.array(z.enum(SUPPORT_TICKET_CATEGORIES)).min(1).default([...SUPPORT_TICKET_CATEGORIES]),
  replyTemplate: z.string().trim().max(3000).default(""),
  reportHour: z.number().int().min(0).max(23).default(8),
  dailyCallLimit: z.number().int().min(1).max(1000).default(50),
}).strict().superRefine((policy, ctx) => {
  if (new Set(policy.criteria.map(item => item.code)).size !== policy.criteria.length) ctx.addIssue({ code: "custom", message: "Mã tiêu chí không được trùng." });
});
export type AdminAIPolicy = z.infer<typeof policySchema>;
export const saveConfigSchema = z.object({ revision: z.number().int().min(0), draft: policySchema }).strict();
export const activateSchema = z.object({ revision: z.number().int().min(0), enabled: z.boolean() }).strict();
export const runSchema = z.object({
  feature: featureSchema, sourceType: z.enum(["provider_application", "service_suggestion", "complaint", "report", "support_ticket", "operations"]),
  sourceId: z.string().regex(/^[a-f\d]{24}$|^operations$/, "Mã tài nguyên không hợp lệ."),
  preview: z.boolean().default(true),
  from: z.iso.datetime().optional(), to: z.iso.datetime().optional(),
}).strict().superRefine((input, ctx) => {
  const allowed: Record<AdminAIFeature, string[]> = {
    provider_application: ["provider_application"], service_suggestion: ["service_suggestion"],
    complaint_summary: ["complaint", "report"], operations_report: ["operations"],
    support_classification: ["support_ticket"], reply_draft: ["provider_application", "service_suggestion", "complaint", "report", "support_ticket"],
  };
  if (!allowed[input.feature].includes(input.sourceType) || (input.sourceType === "operations") !== (input.sourceId === "operations")) ctx.addIssue({ code: "custom", message: "Loại tài nguyên không phù hợp tính năng AI." });
  if (input.sourceType === "operations" && (!input.from || !input.to || Date.parse(input.from) >= Date.parse(input.to) || Date.parse(input.to) > Date.now() || Date.parse(input.to) - Date.parse(input.from) > 31 * 86400000)) ctx.addIssue({ code: "custom", message: "Kỳ báo cáo phải hợp lệ, đã kết thúc và không quá 31 ngày." });
});
export type RunInput = z.infer<typeof runSchema>;
const evidenceSchema = z.object({ sourceId: z.string().max(100), quote: z.string().min(1).max(1000) }).strict();
export const complaintResolutionSchema = z.object({
  workflow: complaintWorkflowSchema.nullable().default(null),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT", "UNKNOWN"]),
  severityReason: z.string().min(1).max(1000),
  disputed: z.boolean(),
  evidenceStatus: z.enum(["sufficient", "insufficient", "conflicting"]),
  policyFindings: z.array(z.object({
    sourceId: z.string().max(100), quote: z.string().min(1).max(1000),
    assessment: z.string().min(1).max(1500), applicable: z.enum(["yes", "no", "unknown"]),
  }).strict()).max(10),
  recommendation: z.string().min(1).max(3000),
  nextSteps: z.array(z.string().min(1).max(500)).min(1).max(10),
  requiresAdminApproval: z.boolean(),
  action: z.enum(["resolve", "manual_review"]).default("manual_review"),
  resolutionNote: z.string().max(3000).default(""),
  pendingActions: z.array(z.enum(["refund", "compensation", "warranty", "sanction", "service_work", "other"])).max(6).default([]),
  escalationReasons: z.array(z.string().min(1).max(500)).max(20),
  collectedData: z.object({
    orderFound: z.boolean(), imageCount: z.number().int().min(0), fileCount: z.number().int().min(0),
    paymentCount: z.number().int().min(0), attachmentsAnalyzed: z.boolean(),
  }).strict().nullable().default(null),
}).strict();
export const aiOutputSchema = z.object({
  summary: z.string().min(1).max(4000),
  checks: z.array(z.object({ code: z.string().max(50), status: z.enum(["pass", "fail", "unknown"]), reason: z.string().min(1).max(1000), evidence: z.array(evidenceSchema).max(10) }).strict()).max(30),
  evidence: z.array(evidenceSchema).min(1).max(30),
  categoryId: z.string().nullable(), normalizedName: z.string().max(200).nullable(), normalizedDescription: z.string().max(4000).nullable(),
  duplicateServiceIds: z.array(z.string()).max(30),
  classification: z.object({ category: z.enum(SUPPORT_TICKET_CATEGORIES), priority: z.enum(SUPPORT_TICKET_PRIORITIES) }).strict().nullable(),
  draftReply: z.string().max(3000).nullable(),
  timeline: z.array(z.object({ text: z.string().max(1000), sourceIds: z.array(z.string()).min(1).max(10) }).strict()).max(30),
  missingData: z.array(z.string().max(500)).max(20),
  complaintResolution: complaintResolutionSchema.nullable().default(null),
  imageAnalyses: z.array(z.object({
    sourceId: z.string().max(100), status: z.enum(["analyzed", "unreadable", "unavailable", "skipped"]),
    label: z.string().max(500).default(""), url: z.string().nullable().default(null),
    relevant: z.boolean(), consistent: z.boolean(),
    observations: z.array(z.string().min(1).max(500)).max(8),
    uncertainties: z.array(z.string().min(1).max(500)).max(8),
  }).strict()).max(80).default([]),
}).strict();
export type AIOutput = z.infer<typeof aiOutputSchema>;
export type CriterionResult = AIOutput["checks"][number];
export const correctionSchema = z.object({
  category: z.enum(SUPPORT_TICKET_CATEGORIES), priority: z.enum(SUPPORT_TICKET_PRIORITIES),
  reason: z.string().trim().min(5, "Vui lòng nêu lý do điều chỉnh.").max(1000), expectedUpdatedAt: z.iso.datetime(),
}).strict();
