import { useEffect, useId, useState } from "react";
import { Sparkles } from "lucide-react";
import { Modal } from "@/components/common/Modal";
import { getErrorMessage } from "@/utils/apiError";
import { adminAI } from "./adminAI.api";
import type { Config, Feature, Policy } from "./adminAI.types";
import { PolicyEditor } from "./PolicyEditor";
import { RunAssessment } from "./RunAssessment";
import { AutomaticReviewResults } from "./AutomaticReviewResults";

const featureContent = {
  provider_application: {
    title: "Kiểm duyệt tự động · Hồ sơ thợ", button: "Kiểm duyệt tự động", start: "Bật kiểm duyệt",
    description: "Kiểm tra có ảnh giấy tờ và mô tả phù hợp các dịch vụ đăng ký theo tiêu chí bên dưới. AI chỉ duyệt hồ sơ đạt đủ điều kiện bắt buộc; trường hợp chưa rõ để Admin kiểm tra.",
    scope: "",
  },
  service_suggestion: {
    title: "Kiểm duyệt tự động · Gợi ý dịch vụ", button: "Kiểm duyệt tự động", start: "Bật kiểm duyệt",
    description: "Kiểm tra mô tả, danh mục và dịch vụ trùng trước khi duyệt gợi ý của thợ. Dịch vụ được tạo ở trạng thái chưa kích hoạt để Admin kiểm tra.",
    scope: "",
  },
  complaint_summary: {
    title: "Xử lý tự động · Khiếu nại", button: "Xử lý tự động", start: "Bật xử lý tự động",
    description: "Đối chiếu phản ánh với đơn hàng, thanh toán, hoàn tiền, báo giá và bằng chứng để lập phương án xử lý. AI có thể tiếp nhận hoặc yêu cầu bổ sung; Admin xác nhận quyết định cuối cùng.",
    scope: "",
  },
} as const;

const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

export function AutomaticReviewControl({ feature, onClose }: { feature: Feature; onClose(): void }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className={`${buttonClass} text-primary`} aria-haspopup="dialog" onClick={() => setOpen(true)}>
      <Sparkles size={18} aria-hidden="true" />{featureContent[feature].button}
    </button>
    {open && <AutomaticReviewModal feature={feature} onClose={() => { setOpen(false); onClose(); }} />}
  </>;
}

function AutomaticReviewModal({ feature, onClose }: { feature: Feature; onClose(): void }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [draft, setDraft] = useState<Policy | null>(null);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [section, setSection] = useState("settings");
  const [reload, setReload] = useState(0);
  const tabId = useId();
  const info = featureContent[feature];
  const dirty = Boolean(config && draft && JSON.stringify(config.draft) !== JSON.stringify(draft));
  const identityBlocked = draft?.criteria.some(rule => rule.kind === "verified_identity" && rule.required);

  useEffect(() => {
    let active = true;
    void adminAI.configs().then(result => {
      if (!active) return;
      const current = result.configs.find(item => item.feature === feature);
      if (!current) throw new Error("Chưa có cấu hình tự động cho chức năng này.");
      setConfig(current); setDraft(current.draft); setConfigured(result.configured); setError("");
    }).catch(failure => { if (active) setError(getErrorMessage(failure, "Không thể tải cấu hình tự động.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [feature, reload]);

  const change = async (action: "save" | "enable" | "disable") => {
    if (!config || !draft || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      let current = config;
      if (action !== "disable" && dirty) {
        current = await adminAI.save(feature, current.revision, draft);
        setConfig(current); setDraft(current.draft);
      }
      if (action !== "save") {
        current = await adminAI.activate(feature, current.revision, action === "enable");
        setConfig(current); setDraft(current.draft);
      }
      setMessage(action === "save" ? "Đã lưu cấu hình. Tự động hóa đang tắt; bạn có thể chạy thử hoặc bật lại." : action === "disable" ? "Đã tắt tự động hóa." : "Đã bật tự động hóa theo bộ tiêu chí đã lưu.");
    } catch (failure) { setError(getErrorMessage(failure, "Không thể cập nhật cấu hình tự động.")); }
    finally { setBusy(false); }
  };

  const close = () => { if (!busy) onClose(); };
  return <Modal open title={info.title} size="lg" onClose={close} closeOnEsc={!busy} closeOnOverlayClick={!busy}
    footer={<div className="flex flex-wrap items-center justify-end gap-2">
      <button type="button" className={buttonClass} disabled={busy} onClick={close}>Đóng</button>
      {config && draft && <>
        {config.enabled && <button type="button" className={`${buttonClass} text-error`} disabled={busy} onClick={() => void change("disable")}>Tắt tự động</button>}
        <button type="button" className={buttonClass} disabled={busy || !dirty} onClick={() => void change("save")}>Lưu cấu hình</button>
        <button type="button" className={`${buttonClass} border-primary bg-primary text-on-primary hover:bg-primary/90`} disabled={loading || busy || !configured || identityBlocked || (config.enabled && !dirty)} onClick={() => void change("enable")}>
          {busy ? "Đang cập nhật…" : config.enabled && !dirty ? "Đang bật" : config.enabled ? "Lưu và áp dụng" : dirty ? `Lưu và ${info.start.toLocaleLowerCase("vi-VN")}` : info.start}
        </button>
      </>}
    </div>}>
    <div className="min-w-0 space-y-5">
      <p className="text-sm leading-relaxed text-on-surface-variant">{info.description}</p>
      {loading && <p role="status">Đang tải cấu hình…</p>}
      {error && <div role="alert" className="space-y-2 rounded-xl border border-error/30 bg-error/5 p-3 text-sm text-error"><p>{error}</p><button type="button" disabled={busy || loading} className="min-h-11 font-semibold underline" onClick={() => { setLoading(true); setReload(value => value + 1); }}>Tải lại cấu hình</button></div>}
      {message && <p role="status" className="rounded-xl bg-primary/10 p-3 text-sm text-primary">{message}</p>}
      {!loading && config && draft && <>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={`rounded-full px-3 py-1 font-semibold ${config.enabled ? "bg-primary/10 text-primary" : "bg-surface-container-low text-on-surface-variant"}`}>{config.enabled ? "Tự động hóa đang bật" : "Tự động hóa đang tắt"}</span>
          <span className="text-on-surface-variant">{configured ? "Đã kết nối AI" : "Chưa cấu hình kết nối AI"}</span>
        </div>
        <nav aria-label="Nội dung tự động hóa" className="flex flex-wrap gap-2 border-b border-outline-variant pb-3">
          {[["settings", "Cấu hình"], ["test", "Chạy thử"], ["results", "Kết quả"]].map(([key, label]) => <button key={key} type="button" aria-pressed={section === key} aria-controls={`${tabId}-content`} className={`${buttonClass} ${section === key ? "border-primary bg-primary/10 text-primary" : "text-on-surface-variant"}`} onClick={() => setSection(key)}>{label}</button>)}
        </nav>
        <div id={`${tabId}-content`} className="space-y-4">
          {section === "settings" && <>
            <div className="space-y-2 rounded-xl bg-surface-container-low p-4 text-sm leading-relaxed">
              <p>Không cần nhập thêm cấu hình nếu bạn dùng các tiêu chí có sẵn bên dưới. Khi chỉnh sửa, nút bật sẽ lưu và áp dụng cấu hình của bạn.</p>
              {info.scope && <p className="text-on-surface-variant">{info.scope}</p>}
            </div>
            {feature === "complaint_summary" && <section className="rounded-xl border border-outline-variant p-4 text-sm leading-relaxed">
              <h3 className="font-semibold">Điều kiện xử lý có sẵn</h3>
              <ul className="mt-2 list-inside list-disc space-y-2">
                <li>Tự tiếp nhận ca đang chờ; chỉ yêu cầu người gửi bổ sung tài liệu cụ thể họ có thể cung cấp. Không lặp lại yêu cầu đang chờ.</li>
                <li>Phân biệt lời phản ánh với dữ kiện đã đối chiếu; mỗi phương án có người phụ trách và điều kiện hoàn tất.</li>
                <li>Ca tranh chấp, khẩn cấp, thiếu chính sách, hoàn tiền lỗi hoặc cần khắc phục chuyển Admin quyết định.</li>
                <li>Xác nhận, từ chối hay kết thúc ca cần Admin ghi căn cứ. Kết thúc phải có kết quả từng công việc và kiểm tra lại dữ liệu.</li>
              </ul>
            </section>}
            {identityBlocked && <p className="rounded-xl border border-outline-variant p-3 text-sm">Tiêu chí đang bắt buộc xác minh danh tính độc lập. Hệ thống chưa có nguồn xác minh này nên chưa thể bật tự duyệt; bạn vẫn có thể lưu cấu hình và chạy thử.</p>}
            <PolicyEditor feature={feature} value={draft} disabled={busy} onChange={value => { setDraft(value); setMessage(""); }} />
            <p className="text-sm text-on-surface-variant">{dirty ? "Có thay đổi chưa lưu. Lưu cấu hình sẽ tắt tự động hóa; chọn lưu và bật để áp dụng ngay." : `Cấu hình đã lưu · Phiên bản ${config.revision}`}</p>
          </>}
          {section === "test" && <>
            {dirty && <p className="text-sm text-on-surface-variant">Hãy lưu cấu hình trước khi chạy thử.</p>}
            <RunAssessment feature={feature} enabled={config.enabled} disabled={busy || dirty || !configured} onDone={() => setSection("results")} />
          </>}
          {section === "results" && <AutomaticReviewResults feature={feature} onOpenSource={close} />}
        </div>
      </>}
    </div>
  </Modal>;
}
