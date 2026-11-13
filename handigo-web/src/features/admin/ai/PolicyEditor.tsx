import { criterionLabels, type Feature, type Policy } from "./adminAI.types";

const fieldClass = "mt-2 min-h-11 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary";
export function PolicyEditor({ feature, value, onChange, disabled }: { feature: Feature; value: Policy; onChange(value: Policy): void; disabled: boolean }) {
  const change = (patch: Partial<Policy>) => onChange({ ...value, ...patch });
  const instructionPlaceholder = {
    provider_application: "Ví dụ: Mô tả phải phù hợp dịch vụ đăng ký. Thiếu giấy tờ thì chuyển Admin kiểm tra…",
    service_suggestion: "Ví dụ: Gợi ý phải rõ phạm vi công việc, phù hợp danh mục và không trùng dịch vụ hiện có…",
    complaint_summary: "Ví dụ: Đối chiếu bằng chứng với đơn hàng và chính sách; cần hoàn tiền hoặc có tranh chấp thì chuyển Admin…",
  }[feature];
  return <fieldset disabled={disabled} className="min-w-0 space-y-6 disabled:opacity-60">
    <label className="block text-sm font-semibold">Hướng dẫn nghiệp vụ cho AI<textarea name="instructions" autoComplete="off" className={`${fieldClass} font-normal`} rows={4} maxLength={6000} value={value.instructions} onChange={event => change({ instructions: event.target.value })} placeholder={instructionPlaceholder} /></label>
    {feature === "provider_application" && <section className="space-y-3"><h4 className="text-sm font-semibold">Áp dụng cho hồ sơ nào?</h4><div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Phạm vi hồ sơ">
      {(["initial", "service_addition"] as const).map(type => <label key={type} className="flex min-h-12 items-center gap-3 rounded-xl border border-outline-variant p-3 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={value.applicationTypes.includes(type)} onChange={event => change({ applicationTypes: event.target.checked ? [...value.applicationTypes, type] : value.applicationTypes.filter(item => item !== type) })} />{type === "initial" ? "Đăng ký thợ ban đầu" : "Bổ sung dịch vụ"}</label>)}
    </div></section>}
    {feature === "provider_application" && <section className="rounded-xl border border-outline-variant p-4">
      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" className="size-4 accent-primary" name="autoRejectIncompleteApplications" checked={value.autoRejectIncompleteApplications ?? false} onChange={event => change({ autoRejectIncompleteApplications: event.target.checked })} />Tự động từ chối hồ sơ thiếu thông tin</label>
    </section>}
    {["provider_application", "service_suggestion"].includes(feature) && <section className="space-y-3">
      <div><h4 className="text-sm font-semibold">Điều kiện để được duyệt</h4></div>
      {!value.criteria.length && <p className="rounded-xl border border-dashed border-outline-variant p-4 text-sm text-on-surface-variant">Chưa có tiêu chí. Thêm điều kiện kiểm tra trước khi bật tự động.</p>}
      {value.criteria.map((rule, index) => <details key={index} className="group rounded-xl border border-outline-variant">
        <summary className="cursor-pointer rounded-xl p-4 focus-visible:outline-2 focus-visible:outline-primary"><span className="ml-1 text-sm font-semibold">{rule.description || "Tiêu chí mới — bấm để thiết lập"}</span><span className="mt-2 flex flex-wrap items-center gap-2 pl-4 text-xs text-on-surface-variant"><span>{criterionLabels[rule.kind]}</span><span>·</span><span className={rule.required ? "font-medium text-primary" : ""}>{rule.required ? "Bắt buộc" : "Tham khảo"}</span>{["description_length", "experience_years"].includes(rule.kind) && <span>· Tối thiểu {rule.value}{rule.kind === "experience_years" ? " năm" : " ký tự"}</span>}</span></summary>
        <div className="space-y-4 border-t border-outline-variant p-4">
          <label className="block text-sm">Cách kiểm tra<select className={fieldClass} value={rule.kind} onChange={event => change({ criteria: value.criteria.map((item, i) => i === index ? { ...item, kind: event.target.value as typeof rule.kind } : item) })}>{Object.entries(criterionLabels).filter(([key]) => feature === "provider_application" || ["ai", "description_length"].includes(key)).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="block text-sm">Mô tả tiêu chuẩn<textarea className={fieldClass} rows={2} value={rule.description} maxLength={1000} onChange={event => change({ criteria: value.criteria.map((item, i) => i === index ? { ...item, description: event.target.value } : item) })} /></label>
          {["description_length", "experience_years"].includes(rule.kind) && <label className="block text-sm">{rule.kind === "experience_years" ? "Số năm kinh nghiệm tối thiểu" : "Số ký tự mô tả tối thiểu"}<input type="number" min={0} max={10000} className={fieldClass} value={rule.value} onChange={event => change({ criteria: value.criteria.map((item, i) => i === index ? { ...item, value: Number(event.target.value) } : item) })} /></label>}
          {rule.kind === "verified_identity" && <p className="rounded-lg bg-surface-container-low p-3 text-sm">Chưa có kết nối xác minh danh tính độc lập. Nếu đặt điều kiện này là bắt buộc, bạn sẽ chưa thể bật tự động duyệt.</p>}
          <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={rule.required} onChange={event => change({ criteria: value.criteria.map((item, i) => i === index ? { ...item, required: event.target.checked } : item) })} />Bắt buộc phải đạt</label><button type="button" className="min-h-11 rounded-lg px-3 text-sm text-error underline focus-visible:outline-2 focus-visible:outline-primary" onClick={() => change({ criteria: value.criteria.filter((_, i) => i !== index) })}>Xóa tiêu chí</button></div>
          <details><summary className="cursor-pointer text-xs text-on-surface-variant">Mã tham chiếu tiêu chí</summary><label className="mt-2 block text-sm">Mã tiêu chí<input className={fieldClass} value={rule.code} maxLength={50} onChange={event => change({ criteria: value.criteria.map((item, i) => i === index ? { ...item, code: event.target.value } : item) })} /></label></details>
        </div>
      </details>)}
      <button type="button" disabled={value.criteria.length >= 30} className="min-h-11 w-full rounded-xl border border-dashed border-outline-variant px-4 py-2 text-sm font-semibold text-primary hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50" onClick={() => change({ criteria: [...value.criteria, { code: `criterion_${Date.now()}`, kind: "ai", description: "", required: true, value: 0 }] })}>+ Thêm điều kiện duyệt</button>
    </section>}
    <details className="rounded-xl bg-surface-container-low p-4"><summary className="cursor-pointer text-sm font-semibold">Cài đặt nâng cao</summary><div className="mt-4 space-y-4">
      <label className="block text-sm">Số lần gọi AI tối đa mỗi ngày<input type="number" min={1} max={1000} className={fieldClass} value={value.dailyCallLimit} onChange={event => change({ dailyCallLimit: Number(event.target.value) })} /><span className="mt-1 block text-xs text-on-surface-variant">Hạn mức riêng cho chức năng này, tính theo ngày UTC.</span></label>
    </div></details>
  </fieldset>;
}
