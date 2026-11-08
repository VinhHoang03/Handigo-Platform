import { z } from "zod";

export const complaintWorkflowSchema = z.object({
  category: z.enum(["payment", "refund", "service_quality", "pricing", "schedule", "conduct", "safety", "technical", "other"]),
  proposedStatus: z.enum(["under_review", "evidence_requested", "confirmed", "rejected", "resolved"]),
  allegations: z.array(z.string().trim().min(1).max(600)).max(10),
  facts: z.array(z.object({
    statement: z.string().trim().min(1).max(600),
    sourceIds: z.array(z.string().min(1).max(100)).min(1).max(8),
  }).strict()).max(15),
  missingEvidence: z.array(z.object({
    owner: z.enum(["reporter", "provider", "system", "admin"]),
    description: z.string().trim().min(5).max(600),
  }).strict()).max(10),
  tasks: z.array(z.object({
    kind: z.enum(["verify", "refund", "compensation", "warranty", "service_work", "sanction", "technical", "contact"]),
    owner: z.enum(["admin", "provider", "system"]),
    instruction: z.string().trim().min(5).max(600),
    completionCondition: z.string().trim().min(5).max(600),
  }).strict()).min(1).max(10),
}).strict();

export const complaintDecisionSchema = z.object({
  status: z.enum(["under_review", "evidence_requested", "confirmed", "rejected", "resolved"], { error: "Quyết định xử lý không hợp lệ." }),
  note: z.string().trim().min(10, "Vui lòng ghi căn cứ hoặc kết quả xử lý tối thiểu 10 ký tự.").max(3000),
  completedTasks: z.array(z.object({
    index: z.number({ error: "Mã công việc phải là số." }).int("Mã công việc phải là số nguyên.").min(0, "Mã công việc không hợp lệ.").max(9, "Mã công việc không hợp lệ."),
    evidence: z.string().trim().min(10, "Mỗi công việc đã hoàn tất cần ghi kết quả xác minh.").max(1000),
  }).strict()).max(10).default([]),
}).strict().refine(input => new Set(input.completedTasks.map(task => task.index)).size === input.completedTasks.length, "Không được xác nhận trùng công việc.");
export type ComplaintDecision = z.infer<typeof complaintDecisionSchema>;
