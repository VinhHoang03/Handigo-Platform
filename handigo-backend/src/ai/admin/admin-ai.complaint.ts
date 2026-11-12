import type { ClientSession } from "mongoose";
import { AdminAIAssessment } from "./admin-ai.models";
import { loadContext, type SourceRow } from "./admin-ai.context";
import type { AIOutput, CriterionResult } from "./admin-ai.validation";
import type { Job } from "./admin-ai.service";

export async function applyComplaintAssessment(job: Job, row: SourceRow | null, output: AIOutput, checks: CriterionResult[], complete: boolean,
  beforeWrite: (session: ClientSession, outcome: string) => Promise<void>) {
  const resolution = output.complaintResolution;
  const workflow = resolution?.workflow;
  if (!complete && resolution) resolution.escalationReasons.push("Dữ liệu vượt giới hạn thu thập; Admin cần kiểm tra hồ sơ gốc.");
  if (!workflow || job.sourceType !== "report" || !row || row.isCustomerNoShow || row.createdViolationId
    || !["pending", "under_review", "evidence_requested"].includes(row.status || "")) return { status: "manual", outcome: "manual_review" };
  if (row.reviewedBy && row.reviewedByType !== "system") return { status: "manual", outcome: "manual_review" };

  const afterWrite = async (session: ClientSession) => {
    const latest = await loadContext({ sourceType: "report", sourceId: job.sourceId }, session);
    await AdminAIAssessment.updateOne({ _id: job._id }, { $set: { appliedSourceHash: latest.hash, status: "manual", output, checks } }, { session, runValidators: true });
  };
  const reporterEvidence = workflow.missingEvidence.filter(item => item.owner === "reporter");
  const { reviewReport, requestReportEvidence } = await import("../../services/report.service");
  const request = reporterEvidence.map(item => `• ${item.description}`).join("\n");
  const sensitive = /mật khẩu|\botp\b|số thẻ|căn cước|hộ chiếu/i.test(request);
  if (complete && resolution.collectedData?.attachmentsAnalyzed && workflow.proposedStatus === "evidence_requested" && reporterEvidence.length && request.length <= 1500 && !sensitive
    && !resolution.disputed && !["HIGH", "URGENT", "UNKNOWN"].includes(resolution.severity) && row.status !== "evidence_requested") {
    await requestReportEvidence(String(job.configuredBy), job.sourceId, request, {
      assessmentId: String(job._id), complaintAction: "request_evidence",
      beforeWrite: session => beforeWrite(session, "auto_evidence_requested"), afterWrite,
    });
    return null;
  }
  if (row.status === "pending") {
    await reviewReport(String(job.configuredBy), job.sourceId, {
      status: "under_review", reviewNote: `AI đã tiếp nhận, chưa kết luận. Mã phân tích: ${job._id}. ${resolution.recommendation}`.slice(0, 1000),
    }, { assessmentId: String(job._id), complaintAction: "intake", beforeWrite: session => beforeWrite(session, "auto_intake"), afterWrite });
    return null;
  }
  return { status: "manual", outcome: "manual_review" };
}
