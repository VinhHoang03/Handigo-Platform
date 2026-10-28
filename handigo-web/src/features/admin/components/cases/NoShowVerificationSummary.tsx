import { AlertCircle, CheckCircle2, HelpCircle } from "lucide-react";
import type { Report } from "@/features/case-management/types/caseManagement.types";
import { formatNoShowDate } from "./no-show-review.utils";

type CheckState = "passed" | "failed" | "unknown" | "skipped";

function CheckCard({ title, state, text }: { title: string; state: CheckState; text: string }) {
  const Icon = state === "passed" ? CheckCircle2 : state === "failed" ? AlertCircle : HelpCircle;
  return (
    <div className="rounded-xl border border-outline-variant/40 bg-surface p-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon size={17} aria-hidden="true" className={state === "passed" ? "text-primary" : state === "failed" ? "text-error" : "text-on-surface-variant"} />
        {title}
      </div>
      <p className="mt-2 text-sm text-on-surface-variant">{text}</p>
    </div>
  );
}

export function NoShowVerificationSummary({ report }: { report: Report }) {
  const verification = report.noShowVerification;
  const checks = verification?.checks;
  const approved = report.status === "confirmed";
  const rejected = report.status === "rejected";
  const title = approved ? report.reviewedByType === "system" ? "Đã tự duyệt hỗ trợ"
    : report.reviewedByType === "admin" ? "Admin đã chấp thuận hỗ trợ" : "Đã chấp thuận hỗ trợ"
    : rejected ? "Đã từ chối hỗ trợ" : report.status === "resolved" ? "Đã xử lý báo cáo"
      : report.status === "under_review" ? "Admin đang xem xét" : "Chờ admin xem xét";
  const message = approved ? report.resolutionNote || "Chấp thuận hỗ trợ thợ 5.000đ."
    : rejected ? report.resolutionNote || report.reviewNote || "Báo cáo không được chấp thuận."
      : report.status === "resolved" ? report.resolutionNote || "Đã hoàn tất xử lý báo cáo."
        : verification?.reasons[0] || "Cần kiểm tra bằng chứng trước khi quyết định hỗ trợ 5.000đ.";
  const state = (passed?: boolean): CheckState => passed === undefined ? "unknown" : passed ? "passed" : "failed";
  const distance = checks?.location.distanceMeters;
  return (
    <section className="space-y-4 rounded-2xl border border-outline-variant/40 bg-surface-container-low p-5">
      <div>
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="mt-2 text-sm leading-6">{message}</p>
        {verification && <p className="mt-2 text-xs text-on-surface-variant">Xác minh lúc {formatNoShowDate(verification.checkedAt)}</p>}
      </div>
      <div>
        <p className="mb-3 text-xs font-semibold text-on-surface-variant">Kết quả kiểm tra đã lưu khi gửi báo cáo</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <CheckCard title="Vị trí" state={state(checks?.location.passed)} text={!checks ? "Chưa lưu chi tiết"
            : `${checks.location.passed ? `Trong ${checks.location.radiusMeters} m` : 'Vị trí chưa hợp lệ'}${distance === null || distance === undefined ? '' : ` · ${distance.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} m`}`} />
          <CheckCard title="Thời gian chờ" state={checks?.waiting.skippedForTesting ? "skipped" : state(checks?.waiting.passed)}
            text={!checks ? "Chưa lưu chi tiết" : checks.waiting.skippedForTesting ? "Đã bỏ chờ khi test"
              : `${checks.waiting.passed ? 'Đủ' : 'Chưa đủ'} ${checks.waiting.requiredMinutes} phút`} />
          <CheckCard title="Cuộc gọi" state={state(checks?.calls.passed)} text={!checks ? "Chưa lưu chi tiết"
            : checks.calls.passed ? `${checks.calls.validCount} cuộc hợp lệ · đúng số khách`
              : `${checks.calls.validCount}/${checks.calls.requiredCount} cuộc hợp lệ`} />
          <CheckCard title="Chat Handigo" state={state(checks?.chat.passed)} text={!checks ? "Chưa lưu chi tiết"
            : checks.chat.passed ? "Tin nhắn khớp · khách chưa phản hồi" : checks.chat.customerReplied ? "Khách đã phản hồi"
              : !checks.chat.messageCount ? "Chưa có tin nhắn Handigo trong thời gian chờ" : "Chưa khớp bằng chứng chat"} />
        </div>
      </div>
    </section>
  );
}
