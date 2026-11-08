import { EvidenceContent } from "./EvidenceContent";
import { criterionLabel, readableText, sourceLabel } from "./assessmentPresentation";
import { Link } from "react-router-dom";
import { categoryLabels, featureLabels, priorityLabels, statusLabels, assessmentTitle, type Assessment } from "./adminAI.types";
import { ComplaintWorkflowResult } from "./ComplaintWorkflowResult";

export function AssessmentResult({ item, active = true, embedded = false, onOpenSource, onUpdated, showDecisionForm = true }: { item: Assessment; active?: boolean; embedded?: boolean; onOpenSource?(): void; onUpdated?(): void; showDecisionForm?: boolean }) {
  const output = item.output;
  const resolution = output?.complaintResolution;
  const sourceLink = item.feature === "provider_application" ? `/admin/provider-applications?applicationId=${encodeURIComponent(item.sourceId)}` : item.feature === "service_suggestion" ? `/admin/service-suggestions?suggestionId=${encodeURIComponent(item.sourceId)}` : item.sourceType === "report" ? `/admin/cases?tab=reports&reportId=${encodeURIComponent(item.sourceId)}` : "/admin/cases";
  const outputDetails = output && <>
    {item.feature === "complaint_summary" && <div><h4 className="font-semibold">Tóm tắt đầy đủ</h4><p className="whitespace-pre-wrap">{readableText(output.summary)}</p></div>}
      {!!output.missingData.length && <div className="rounded-lg bg-surface-container-low p-3"><strong>Thông tin cần bổ sung</strong><ul className="list-inside list-disc">{output.missingData.map((text, index) => <li key={index}>{readableText(text)}</li>)}</ul></div>}
      {!!output.imageAnalyses?.length && <section className="space-y-3" aria-label="Phân tích ảnh gửi kèm">
        <h3 className="font-bold">AI đã đọc được gì từ ảnh?</h3>
        <p className="text-sm text-on-surface-variant">Quan sát ảnh hỗ trợ đối chiếu nội dung; không xác thực giấy tờ thật, danh tính hoặc tính nguyên gốc của ảnh.</p>
        {output.imageAnalyses.map(image => <div key={image.sourceId} className="rounded-xl bg-surface-container-low p-3">
          <h4 className="font-semibold">Ảnh {image.sourceId.replace("image:", "")} · {({ analyzed: "Đã phân tích", unreadable: "Không đọc rõ", unavailable: "Không tải được hoặc vượt giới hạn", skipped: "Chưa phân tích" })[image.status]}</h4>
          {image.label && <p className="mt-1 text-sm">{image.label}</p>}
          {image.url && <a href={image.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-3 rounded-lg text-sm font-semibold text-primary underline focus-visible:outline-2 focus-visible:outline-primary"><img src={image.url} alt={image.label || `Ảnh bằng chứng ${image.sourceId}`} width={80} height={80} loading="lazy" className="size-20 rounded-lg object-cover" />Mở ảnh gốc</a>}
          <p className="mt-2 text-sm">{image.relevant ? "Phù hợp nội dung cần kiểm tra" : "Chưa xác định ảnh liên quan"} · {image.consistent ? "Khớp thông tin được cung cấp" : "Chưa khớp hoặc chưa đủ dữ liệu đối chiếu"}</p>
          <ul className="mt-2 list-inside list-disc text-sm">{image.observations.map((text, index) => <li key={index}>{readableText(text)}</li>)}</ul>
          {!!image.uncertainties.length && <p className="mt-2 text-sm"><strong>Cần kiểm tra:</strong> {image.uncertainties.join("; ")}</p>}
        </div>)}
      </section>}
      {!!item.checks.length && <ul className="space-y-2">{item.checks.map(check => <li key={check.code} className="rounded-lg bg-surface-container-low p-3"><strong>{criterionLabel(item, check.code)}: {({ pass: "Đạt", fail: "Không đạt", unknown: "Chưa đủ dữ liệu" })[check.status]}</strong><p>{readableText(check.reason)}</p></li>)}</ul>}
      {output.normalizedName && <p><strong>Tên gợi ý:</strong> {output.normalizedName}</p>}
      {output.normalizedDescription && <p className="whitespace-pre-wrap"><strong>Mô tả gợi ý:</strong> {output.normalizedDescription}</p>}
      {!!output.duplicateServiceIds.length && <p className="break-all"><strong>Dịch vụ có thể trùng:</strong> {output.duplicateServiceIds.length} dịch vụ trong danh mục hiện có</p>}
      {output.classification && <p><strong>Phân loại:</strong> {categoryLabels[output.classification.category]} · Ưu tiên {priorityLabels[output.classification.priority]}</p>}
      {!!output.timeline.length && <ol className="list-inside list-decimal space-y-2">{output.timeline.map((event, index) => <li key={index}>{readableText(event.text)}<span className="ml-2 text-xs text-on-surface-variant">Nguồn: {[...new Set(event.sourceIds.map(sourceLabel))].join(", ")}</span></li>)}</ol>}
      {!!output.evidence.length && <details><summary className="cursor-pointer font-semibold">Bằng chứng được AI sử dụng</summary><ul className="mt-2 space-y-2">{output.evidence.map((evidence, index) => <li key={index} className="rounded-lg bg-surface-container-low p-3"><p className="break-all text-xs text-on-surface-variant">{sourceLabel(evidence.sourceId)}</p><EvidenceContent quote={evidence.quote} /></li>)}</ul></details>}
  </>;
  return <article className={`min-w-0 space-y-3 break-words ${embedded ? "" : "rounded-2xl border border-outline-variant bg-surface p-4"}`}>
    <div className="flex flex-wrap items-center justify-between gap-2"><strong>{assessmentTitle(item)}</strong><span className="text-sm text-on-surface-variant">{item.preview ? "Phân tích thử" : "Xử lý tự động"} · Phiên bản {item.revision} · {new Date(item.createdAt).toLocaleString("vi-VN")}</span></div>
    {item.preview && <p className="rounded-lg bg-surface-container-low p-3 text-sm">{item.feature === "complaint_summary" ? "Phân tích thử · Chưa cập nhật khiếu nại." : "Đây là lượt chạy thử. Kết quả chỉ để xem trước, chưa duyệt hồ sơ hay cập nhật vụ việc."}</p>}
    {!embedded && !item.preview && (["manual", "error", "stale"].includes(item.status) || item.outcome === "auto_rejected") && <div className="rounded-lg bg-surface-container-low p-3"><h3 className="font-bold">Việc bạn cần làm</h3><p className="mt-1 text-sm">{item.status === "stale" ? "Dữ liệu hoặc thiết lập đã thay đổi. Chạy phân tích lại trước khi quyết định." : "Kiểm tra phần thiếu và căn cứ bên dưới; mở hồ sơ gốc để xử lý."}</p><Link className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline" to={sourceLink} onClick={onOpenSource}>Mở công việc gốc</Link></div>}
    {item.outcome === "auto_approved" && <p className="font-semibold text-primary">Hệ thống đã tự phê duyệt theo bộ tiêu chí.</p>}
    {item.outcome === "auto_rejected" && <p className="font-semibold text-error">Đã tự từ chối hồ sơ thiếu thông tin theo quyền Admin đã bật. Người đăng ký có thể bổ sung và gửi lại.</p>}
    {item.outcome === "auto_classified" && <p className="font-semibold text-primary">Hệ thống đã cập nhật phân loại.</p>}
    {item.error && <p role="alert" className="text-error">{item.error}</p>}
    {output && <>
      <p className={item.feature === "complaint_summary" ? "line-clamp-3 text-sm leading-relaxed" : "whitespace-pre-wrap"}>{readableText(output.summary)}</p>
      {item.feature === "complaint_summary" && resolution?.workflow && <ComplaintWorkflowResult key={item._id} item={item} active={active} onUpdated={onUpdated} extraDetails={outputDetails} showDecisionForm={showDecisionForm} />}
      {item.feature === "complaint_summary" && resolution && !resolution.workflow && <details><summary className="min-h-11 cursor-pointer font-semibold">Xem chi tiết</summary><section className="space-y-3 rounded-xl border border-outline-variant p-4" aria-label="Phương án xử lý khiếu nại">
        <h3 className="font-bold">Phương án xử lý khiếu nại</h3>
        <p><strong>Mức độ nghiêm trọng:</strong> {priorityLabels[resolution.severity] || "Chưa xác định"}</p>
        <p>{readableText(resolution.severityReason)}</p>
        {resolution.collectedData && <div className="rounded-lg bg-surface-container-low p-3 text-sm"><h4 className="font-semibold">Thông tin đã thu thập</h4><p>Đơn hàng: {resolution.collectedData.orderFound ? "Đã tìm thấy" : "Chưa tìm thấy"} · Ảnh: {resolution.collectedData.imageCount} · Tệp đính kèm: {resolution.collectedData.fileCount} · Giao dịch: {resolution.collectedData.paymentCount}</p><p>{resolution.collectedData.attachmentsAnalyzed ? "Đã đọc các ảnh trong phạm vi thu thập. Xem quan sát chi tiết bên dưới." : "Còn ảnh chưa đọc rõ hoặc tài liệu cần kiểm tra bản gốc. PDF/video chưa được phân tích."} Giao dịch hệ thống không thay thế hóa đơn của thợ.</p></div>}
        <p><strong>Bằng chứng:</strong> {({ sufficient: "Đủ căn cứ theo dữ liệu đã đối chiếu", insufficient: "Chưa đủ căn cứ", conflicting: "Có mâu thuẫn" })[resolution.evidenceStatus]}</p>
        {resolution.disputed && <p className="font-semibold">Có tranh chấp cần Admin xác minh.</p>}
        <div><h4 className="font-semibold">Đối chiếu chính sách</h4>{!resolution.policyFindings.length && <p>Chưa có căn cứ chính sách áp dụng.</p>}{resolution.policyFindings.map((finding, index) => <div key={index} className="mt-2 rounded-lg bg-surface-container-low p-3"><p className="text-sm font-semibold">{({ yes: "Có thể áp dụng", no: "Không áp dụng", unknown: "Cần xác minh" })[finding.applicable]}</p><p>{readableText(finding.assessment)}</p><EvidenceContent quote={finding.quote} /><p className="text-xs text-on-surface-variant">Nguồn: {sourceLabel(finding.sourceId)}</p></div>)}</div>
        <div><h4 className="font-semibold">{item.outcome === "auto_resolved" ? "Kết luận đã áp dụng" : "Phương án giải quyết"}</h4><p className="whitespace-pre-wrap">{readableText((item.outcome === "auto_resolved" ? resolution.resolutionNote : resolution.recommendation) || "")}</p></div>
        <div><h4 className="font-semibold">Các bước tiếp theo</h4><ol className="list-inside list-decimal">{resolution.nextSteps.map((step, index) => <li key={index}>{readableText(step)}</li>)}</ol></div>
        {!!resolution.escalationReasons.length && <div className="rounded-lg bg-surface-container-low p-3"><h4 className="font-semibold">Lý do chuyển Admin</h4><ul className="list-inside list-disc">{resolution.escalationReasons.map((reason, index) => <li key={index}>{readableText(reason)}</li>)}</ul></div>}
        <p className="text-sm text-on-surface-variant">{item.preview ? "Chạy thử: chưa áp dụng kết luận này." : item.outcome === "auto_resolved" ? "AI đã ghi kết luận và chuyển khiếu nại sang Đã giải quyết. Lượt xử lý này không thực hiện giao dịch tiền hay chế tài." : "Chưa tự giải quyết vụ việc. Admin cần kiểm tra căn cứ và thực hiện các bước được đề xuất."}</p>
        <Link className="inline-flex min-h-11 items-center font-semibold text-primary underline" to={sourceLink} onClick={onOpenSource}>{item.outcome === "auto_resolved" ? "Xem khiếu nại đã giải quyết" : "Mở khiếu nại để kiểm tra và xử lý"}</Link>
      </section>{outputDetails}</details>}
      {item.feature !== "complaint_summary" && outputDetails}
      {item.feature === "complaint_summary" && !resolution && <details><summary className="min-h-11 cursor-pointer font-semibold">Xem chi tiết</summary><div className="mt-3 space-y-3">{outputDetails}</div></details>}
    </>}
    {item.metrics && <section className="space-y-2"><h3 className="font-semibold">Số liệu do hệ thống tính</h3><p className="text-sm">{new Date(item.metrics.from).toLocaleString("vi-VN")} — {new Date(item.metrics.to).toLocaleString("vi-VN")}</p><p className="text-sm text-on-surface-variant">{item.metrics.definition}</p>{([ ["Đơn hàng", item.metrics.orders], ["Hồ sơ", item.metrics.applications], ["Gợi ý dịch vụ", item.metrics.suggestions], ["Tự động hóa", item.metrics.automation] ] as const).map(([label, rows]) => <div key={label}><strong>{label}</strong>{!rows.length && <p>Không có dữ liệu.</p>}{rows.map((row, index) => <p key={index} className="text-sm">{typeof row._id === "string" ? statusLabels[row._id] || row._id : `${featureLabels[row._id.feature]} · ${statusLabels[row._id.status] || row._id.status} · ${row._id.preview ? "Phân tích thử" : "Tự động"}`}: {row.count.toLocaleString("vi-VN")}{row.averageReviewMs != null && ` · Duyệt trung bình ${(row.averageReviewMs / 60000).toFixed(1)} phút`}</p>)}</div>)}</section>}
    {item.metrics?.backlog && <div className="rounded-lg bg-surface-container-low p-3"><h3 className="font-semibold">Hàng đợi tồn tại thời điểm tạo báo cáo</h3><p>Hồ sơ chờ duyệt: {item.metrics.backlog.pendingApplications.toLocaleString("vi-VN")}</p><p>Gợi ý dịch vụ chờ duyệt: {item.metrics.backlog.pendingSuggestions.toLocaleString("vi-VN")}</p><p>Phiếu hỗ trợ đang xử lý: {item.metrics.backlog.openSupport.toLocaleString("vi-VN")}</p></div>}
  </article>;
}
