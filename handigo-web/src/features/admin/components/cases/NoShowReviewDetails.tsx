import type { Report } from "@/features/case-management/types/caseManagement.types";
import { formatNoShowDate as formatDate } from "./no-show-review.utils";

type NoShowDetails = NonNullable<Report["noShowDetails"]>;
type Evidence = NoShowDetails["evidence"][number];
const imageTypeLabels = { arrival: "Ảnh đến nơi", chat: "Ảnh tin nhắn", call: "Ảnh cuộc gọi", other: "Ảnh khác" };
const outcomeLabels = { no_response: "Không thấy tin nhắn phản hồi", no_answer: "Không được trả lời", answered: "Có phản hồi hoặc kết nối", unknown: "Chưa xác định" };
const directionLabels = { outgoing: "Gọi đi", incoming: "Gọi đến", unknown: "Chưa rõ chiều gọi" };

function EvidenceAnalysis({ item }: { item: Evidence }) {
  const analysis = item.analysis;
  if (item.analysisStatus !== "analyzed" || !analysis) return (
    <div className="space-y-2 text-sm text-on-surface-variant">
      <p>AI chưa phân tích được ảnh này. Admin cần xem ảnh gốc.</p>
      <p><b>Lý do:</b> {item.analysisFailure?.reason || "Lần phân tích này chưa lưu chi tiết lỗi."}</p>
      {item.analysisFailure?.httpStatus && <p><b>Mã lỗi dịch vụ AI:</b> {item.analysisFailure.httpStatus}</p>}
    </div>
  );
  return (
    <div className="space-y-2 break-words text-sm">
      <p><b>Loại ảnh AI nhận diện:</b> {imageTypeLabels[analysis.imageType]}</p>
      {item.kind === "arrival" ? <p><b>Địa chỉ/chữ nhận biết:</b> {analysis.locationText || "Không đọc được"}</p>
        : analysis.imageType === "call" ? (
          <div className="space-y-2">
            {!item.callEvents?.length && <p>Chưa đọc được từng cuộc gọi riêng từ ảnh.</p>}
            {item.callEvents?.map((call, index) => <div key={index} className="space-y-1 rounded-lg bg-surface-container-low p-3">
              <p><b>Cuộc {index + 1}:</b> {call.phoneNumber || "Không đọc được số đầy đủ"} · {directionLabels[call.direction]}</p>
              <p><b>Ngày giờ trên ảnh:</b> {[call.dateLabel, call.time].filter(Boolean).join(" · ") || "Chưa xác định"}</p>
              <p><b>Thời điểm quy đổi:</b> {formatDate(call.resolvedAt)}</p>
              <p><b>Kết quả:</b> {outcomeLabels[call.outcome]}</p>
            </div>)}
          </div>
        ) : <>
          {analysis.chatChannel === "external" && <p><b>Số điện thoại:</b> {analysis.phoneNumbers.join(", ") || "Không đọc được số đầy đủ"}</p>}
          {(analysis.contactDateLabel || analysis.contactTime) && <p><b>Ngày giờ trên ảnh:</b> {[analysis.contactDateLabel, analysis.contactTime].filter(Boolean).join(" · ")}</p>}
          <p><b>Thời điểm liên hệ:</b> {formatDate(item.resolvedContactAt !== undefined ? item.resolvedContactAt : analysis.contactAt)}</p>
          <p><b>Kết quả:</b> {outcomeLabels[analysis.contactOutcome]}</p>
          <p className="whitespace-pre-wrap"><b>Tin nhắn của thợ:</b> {analysis.providerMessage || "Không đọc được"}</p>
        </>}
      <div><b>Điểm AI chưa chắc chắn:</b>
        {analysis.uncertainties.length ? <ul className="mt-1 list-disc space-y-1 pl-5">{analysis.uncertainties.map((text, index) => <li key={index}>{text}</li>)}</ul>
          : <p>AI không ghi nhận điểm chưa chắc chắn.</p>}
      </div>
    </div>
  );
}

export function NoShowReviewDetails({ details, report }: { details: NoShowDetails; report: Report }) {
  const { location, evidence } = details;
  const checks = report.noShowVerification?.checks;
  const groups = [
    { key: "arrival", title: "Địa điểm", text: "Ảnh nơi thợ đã đến" },
    { key: "call", title: "Cuộc gọi", text: checks ? `${checks.calls.validCount}/${checks.calls.requiredCount} cuộc hợp lệ khi xác minh` : "Ảnh lịch sử cuộc gọi" },
    { key: "chat", title: "Chat Handigo", text: checks ? checks.chat.passed ? "Tin nhắn đã khớp" : "Tin nhắn cần xem xét" : "Ảnh hội thoại với khách" },
    { key: "external_chat", title: "Tin nhắn bên ngoài", text: "Ảnh liên hệ qua ứng dụng khác" },
    { key: "other", title: "Chưa phân loại", text: "Cần admin kiểm tra ảnh gốc" },
  ];
  const groupFor = (item: Evidence) => item.kind === "arrival" ? "arrival"
    : item.analysis?.imageType === "call" ? "call" : item.analysis?.imageType === "chat"
      ? item.analysis.chatChannel === "external" ? "external_chat" : "chat" : "other";
  return (
    <>
      <section className="space-y-3">
        <h3 className="font-bold">Ảnh bằng chứng</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {groups.filter(group => ["arrival", "call", "chat"].includes(group.key) || evidence.some(item => groupFor(item) === group.key)).map(group => {
            const images = evidence.map((item, index) => ({ item, index })).filter(({ item }) => groupFor(item) === group.key);
            return <article key={group.key} className="min-w-0 rounded-xl border border-outline-variant/50 p-3">
              <h4 className="text-sm font-bold">{group.title}</h4>
              <p className="mt-1 text-xs leading-5 text-on-surface-variant">{group.text}</p>
              {!images.length ? <p className="mt-3 text-sm text-on-surface-variant">Chưa có ảnh</p>
                : <div className="mt-3 space-y-2">{images.map(({ item, index }) => <div key={item.id} className="overflow-hidden rounded-lg border border-outline-variant/40">
                  <a href={item.url} target="_blank" rel="noreferrer" className="block">
                    <img src={item.url} alt={`${group.title} · Ảnh ${index + 1}`} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                    <p className="p-2 text-xs font-medium text-primary">Ảnh {index + 1} · Mở ảnh gốc</p>
                  </a>
                  <details className="border-t border-outline-variant/40 p-2">
                    <summary aria-label={`Xem chi tiết ảnh ${index + 1}`} className="cursor-pointer list-none rounded-lg border border-outline-variant px-3 py-2 text-center text-xs font-semibold text-primary [&::-webkit-details-marker]:hidden">Chi tiết</summary>
                    <div className="mt-3 rounded-lg bg-surface-container-low/50 p-3"><EvidenceAnalysis item={item} /></div>
                  </details>
                </div>)}</div>}
            </article>;
          })}
        </div>
      </section>

      <details className="rounded-2xl border border-outline-variant/50 p-4">
        <summary className="cursor-pointer text-sm font-bold">Chi tiết xác minh</summary>
        <div className="mt-4 space-y-5">
          {report.noShowVerification && <section className="space-y-2 text-sm">
            <h4 className="font-semibold">Kết quả đã lưu</h4>
            {report.noShowVerification.reasons.map((reason, index) => <p key={index}>{reason}</p>)}
            {checks && <p><b>Bắt đầu thời gian chờ:</b> {formatDate(checks.waiting.waitStartedAt)}</p>}
          </section>}
          <section className="space-y-2 text-sm">
            <h4 className="font-semibold">Địa điểm và thời điểm đến</h4>
            <p><b>Địa chỉ đơn:</b> {location.orderAddress || "Chưa có địa chỉ"}</p>
            <p><b>Địa chỉ từ vị trí thợ:</b> {location.arrivalAddress || "Chưa tra cứu được địa chỉ"}</p>
            <p><b>Thời điểm đến:</b> {formatDate(location.arrivedAt)}</p>
            <p><b>Khoảng cách lúc đến:</b> {location.distanceMeters === null ? "Chưa xác định" : `${location.distanceMeters.toLocaleString('vi-VN')} m`}</p>
          </section>
          {report.reviewNote && <p className="whitespace-pre-wrap text-sm"><b>Ghi chú xem xét:</b> {report.reviewNote}</p>}
        </div>
      </details>

    </>
  );
}
