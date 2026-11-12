import type { AdminAIPolicy, CriterionResult, AIOutput } from "./admin-ai.validation";
import type { SourceRow } from "./admin-ai.context";

const hasRegistrationImage = (value: unknown) => typeof value === "string" && value.trim().length > 0;

export function incompleteApplicationReasons(row: SourceRow): string[] {
  const reasons: string[] = [];
  if (typeof row.description !== "string" || !row.description.trim()) reasons.push("Chưa có mô tả kinh nghiệm và công việc đăng ký.");
  const identity = (row.identityDocument || {}) as Record<string, unknown>;
  if (identity.type === "passport") {
    if (!hasRegistrationImage(identity.passportImageUrl)) reasons.push("Chưa có ảnh hộ chiếu.");
  } else {
    if (!hasRegistrationImage(identity.frontImageUrl)) reasons.push("Chưa có ảnh mặt trước giấy tờ tùy thân.");
    if (!hasRegistrationImage(identity.backImageUrl)) reasons.push("Chưa có ảnh mặt sau giấy tờ tùy thân.");
  }
  return reasons;
}

export function evaluateCriteria(policy: AdminAIPolicy, row: SourceRow | null, now = new Date()): CriterionResult[] {
  const identity = (row?.identityDocument || {}) as Record<string, unknown>;
  const certificates = (row?.certificates || []) as Array<Record<string, unknown>>;
  return policy.criteria.filter(rule => rule.kind !== "ai").map(rule => {
    let status: CriterionResult["status"] = "unknown";
    let reason = "Chưa có nguồn dữ liệu xác minh phù hợp.";
    const decide = (passed: boolean, detail: string) => { status = passed ? "pass" : "fail"; reason = detail; };
    if (row) switch (rule.kind) {
      case "description_length": decide(typeof row.description === "string" && row.description.trim().length >= rule.value, `Yêu cầu mô tả tối thiểu ${rule.value} ký tự.`); break;
      case "experience_years": decide(typeof row.experienceYears === "number" && row.experienceYears >= rule.value, `Kinh nghiệm tự khai tối thiểu ${rule.value} năm; chưa xác minh kinh nghiệm thực tế.`); break;
      case "identity_images": decide(identity.type === "passport" ? hasRegistrationImage(identity.passportImageUrl) : hasRegistrationImage(identity.frontImageUrl) && hasRegistrationImage(identity.backImageUrl), "Kiểm tra có ảnh giấy tờ; chưa xác minh tính thật của ảnh."); break;
      case "identity_expiry": {
        const expiresAt = identity.expiresAt ? new Date(String(identity.expiresAt)) : null;
        if (expiresAt && Number.isFinite(expiresAt.getTime())) decide(expiresAt.getTime() >= now.getTime(), "Đối chiếu hạn giấy tờ đã khai báo với thời điểm đánh giá.");
        break;
      }
      case "certificate_presence": decide(certificates.length > 0 && certificates.every(item => typeof item.title === "string" && item.title.trim() && Array.isArray(item.imageUrls) && item.imageUrls.length), "Mỗi chứng chỉ cần tên và ảnh; chưa xác minh cơ quan cấp."); break;
      case "certificate_expiry": {
        if (certificates.length && certificates.every(item => item.expiresAt && Number.isFinite(new Date(String(item.expiresAt)).getTime()))) decide(certificates.every(item => new Date(String(item.expiresAt)).getTime() >= now.getTime()), "Đối chiếu hạn của tất cả chứng chỉ đã khai báo.");
        break;
      }
      case "verified_identity": reason = "Chưa tích hợp nguồn xác minh danh tính độc lập phía server; không dùng OCR hoặc trường client khai báo làm bằng chứng."; break;
    }
    return { code: rule.code, status, reason, evidence: [] };
  });
}
export function allRequiredPassed(policy: AdminAIPolicy, checks: CriterionResult[], output: AIOutput) {
  const required = policy.criteria.filter(item => item.required);
  return required.length > 0 && output.missingData.length === 0 && required.every(rule => checks.filter(check => check.code === rule.code).length === 1 && checks.find(check => check.code === rule.code)?.status === "pass");
}
export function normalizeServiceName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
