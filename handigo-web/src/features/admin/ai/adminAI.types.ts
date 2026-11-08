export const featureLabels = {
  provider_application: "Duyệt hồ sơ thợ", service_suggestion: "Duyệt gợi ý dịch vụ", complaint_summary: "Xử lý khiếu nại",
} as const;
export type Feature = keyof typeof featureLabels;
export const criterionLabels = {
  description_length: "Độ dài mô tả", experience_years: "Số năm kinh nghiệm tự khai", identity_images: "Đủ ảnh giấy tờ", identity_expiry: "Hạn giấy tờ",
  certificate_presence: "Có chứng chỉ và ảnh", certificate_expiry: "Hạn chứng chỉ", verified_identity: "Xác minh danh tính độc lập", ai: "Đánh giá nội dung bằng AI",
} as const;
export type Criterion = { code: string; description: string; kind: keyof typeof criterionLabels; required: boolean; value: number };
export type Policy = { autoRejectIncompleteApplications?: boolean; instructions: string; criteria: Criterion[]; applicationTypes: Array<"initial" | "service_addition">; categories: string[]; replyTemplate: string; reportHour: number; dailyCallLimit: number };
export type Config = { feature: Feature; revision: number; enabled: boolean; draft: Policy; policy: Policy | null; configuredBy: string | null; updatedAt: string };
export type Evidence = { sourceId: string; quote: string };
export type ComplaintWorkflow = {
  category: "payment" | "refund" | "service_quality" | "pricing" | "schedule" | "conduct" | "safety" | "technical" | "other";
  proposedStatus: "under_review" | "evidence_requested" | "confirmed" | "rejected" | "resolved";
  allegations: string[];
  facts: Array<{ statement: string; sourceIds: string[] }>;
  missingEvidence: Array<{ owner: "reporter" | "provider" | "system" | "admin"; description: string }>;
  tasks: Array<{ kind: string; owner: "admin" | "provider" | "system"; instruction: string; completionCondition: string }>;
};
export type ComplaintDecision = { status: ComplaintWorkflow["proposedStatus"]; note: string; completedTasks: Array<{ index: number; evidence: string }> };
export type Output = {
  summary: string; checks: Array<{ code: string; status: "pass" | "fail" | "unknown"; reason: string; evidence: Evidence[] }>;
  evidence: Evidence[]; categoryId: string | null; normalizedName: string | null; normalizedDescription: string | null;
  duplicateServiceIds: string[]; classification: { category: string; priority: string } | null; draftReply: string | null;
  timeline: Array<{ text: string; sourceIds: string[] }>; missingData: string[];
  complaintResolution?: {
    workflow?: ComplaintWorkflow | null;
    severity: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | "UNKNOWN"; severityReason: string;
    disputed: boolean; evidenceStatus: "sufficient" | "insufficient" | "conflicting";
    policyFindings: Array<{ sourceId: string; quote: string; assessment: string; applicable: "yes" | "no" | "unknown" }>;
    recommendation: string; nextSteps: string[]; requiresAdminApproval: boolean; escalationReasons: string[];
    action?: "resolve" | "manual_review"; resolutionNote?: string; pendingActions?: string[];
    collectedData?: { orderFound: boolean; imageCount: number; fileCount: number; paymentCount: number; attachmentsAnalyzed: boolean } | null;
  } | null;
  imageAnalyses?: Array<{ sourceId: string; label?: string; url?: string | null; status: "analyzed" | "unreadable" | "unavailable" | "skipped"; relevant: boolean; consistent: boolean; observations: string[]; uncertainties: string[] }>;
};
export type Assessment = { policy?: Policy; adminDecision?: (ComplaintDecision & { actorId: string; decidedAt: string }) | null; _id: string; feature: Feature; sourceType: string; sourceId: string; revision: number; preview: boolean; status: string; outcome: string | null; error: string | null; createdAt: string; output: Output | null; checks: Output["checks"]; model: string | null; usage: { inputTokens: number; outputTokens: number } | null; metrics: { from: string; to: string; definition: string; orders: MetricRow[]; applications: MetricRow[]; suggestions: MetricRow[]; automation: MetricRow[]; backlog?: { pendingApplications: number; pendingSuggestions: number; openSupport: number } } | null };
type MetricRow = { _id: string | { feature: Feature; status: string; outcome: string; preview: boolean }; count: number; averageReviewMs?: number | null };
export type SourceType = "provider_application" | "service_suggestion" | "report" | "complaint" | "support_ticket";
export const sourceTypes: Record<Feature, SourceType[]> = {
  provider_application: ["provider_application"], service_suggestion: ["service_suggestion"], complaint_summary: ["report", "complaint"],
};
export const sourceLabels: Record<SourceType, string> = { provider_application: "Hồ sơ thợ", service_suggestion: "Gợi ý dịch vụ", report: "Báo cáo / khiếu nại", complaint: "Khiếu nại cũ", support_ticket: "Phiếu hỗ trợ" };
export const statusLabels: Record<string, string> = { evidence_requested: "Chờ bổ sung bằng chứng", cancelled: "Đã hủy", queued: "Đang chờ", running: "Đang phân tích", retry: "Chờ thử lại", completed: "Hoàn tất", manual: "Cần admin xử lý", stale: "Dữ liệu đã thay đổi", error: "Lỗi, cần kiểm tra thủ công", pending: "Chờ duyệt", resubmitted: "Gửi lại", approved: "Đã duyệt", rejected: "Từ chối", open: "Đang mở", under_review: "Đang xem xét", confirmed: "Đã xác nhận", resolved: "Đã giải quyết", draft: "Bản nháp" };
export const categoryLabels: Record<string, string> = { ACCOUNT: "Tài khoản", PAYMENT: "Thanh toán", ORDER: "Đơn hàng", TECHNICAL: "Kỹ thuật", SECURITY: "Bảo mật", APPEAL: "Khiếu nại quyết định", GUIDANCE: "Hướng dẫn", OTHER: "Khác" };
export const priorityLabels: Record<string, string> = { LOW: "Thấp", MEDIUM: "Trung bình", HIGH: "Cao", URGENT: "Khẩn cấp" };

export function assessmentTitle(item: Assessment) {
  if (item.preview && item.status === "completed") return "Đã phân tích thử · Chưa áp dụng";
  if (item.outcome === "auto_approved") return item.feature === "provider_application" ? "Đã tự duyệt hồ sơ thợ" : "Đã duyệt · Dịch vụ chờ kích hoạt";
  if (item.outcome === "auto_rejected") return "Đã tự từ chối hồ sơ thiếu thông tin";
  if (item.adminDecision) return "Admin đã xử lý: " + statusLabels[item.adminDecision.status];
  if (item.outcome === "auto_intake") return "Đã tiếp nhận · Chờ Admin quyết định";
  if (item.outcome === "auto_evidence_requested") return "Đã yêu cầu bổ sung bằng chứng";
  if (item.outcome === "auto_resolved") return "Đã tự giải quyết khiếu nại";
  if (item.outcome === "auto_classified") return "Đã cập nhật nhóm và mức ưu tiên";
  if (item.status === "completed") return "Đã tạo phân tích · Chưa xử lý vụ việc";
  return statusLabels[item.status] || item.status;
}
