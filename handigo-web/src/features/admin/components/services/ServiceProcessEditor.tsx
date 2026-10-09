import type { ServiceProcessStep } from '@/types/serviceProcess';

interface ServiceProcessEditorProps {
  steps: ServiceProcessStep[];
  disabled: boolean;
  onChange: (steps: ServiceProcessStep[]) => void;
}

export function ServiceProcessEditor({ steps, disabled, onChange }: ServiceProcessEditorProps) {
  const updateStep = (index: number, patch: Partial<ServiceProcessStep>) => {
    onChange(steps.map((step, stepIndex) => stepIndex === index ? { ...step, ...patch } : step));
  };

  const moveStep = (index: number, direction: number) => {
    const nextSteps = [...steps];
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    [nextSteps[index], nextSteps[target]] = [nextSteps[target], nextSteps[index]];
    onChange(nextSteps);
  };

  const buttonClass = 'min-h-10 rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <fieldset disabled={disabled} className="space-y-4 rounded-xl border border-outline-variant/40 p-4">
      <legend className="px-2 text-sm font-bold text-primary">Quy trình dịch vụ</legend>
      <p className="text-sm text-on-surface-variant">Thêm tối đa 20 bước theo thứ tự thực hiện. Có thể bỏ trống nếu chưa có quy trình.</p>
      {steps.length === 0 && <p className="rounded-lg border border-dashed border-outline-variant p-3 text-sm text-on-surface-variant">Chưa có bước nào. Nhấn “Thêm bước” để bắt đầu.</p>}
      {steps.map((step, index) => (
        <div key={index} className="space-y-3 rounded-xl bg-surface-container-low p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Bước {index + 1}</h3>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={buttonClass} disabled={disabled || index === 0} onClick={() => moveStep(index, -1)} aria-label={`Đưa bước ${index + 1} lên`}>Lên</button>
              <button type="button" className={buttonClass} disabled={disabled || index === steps.length - 1} onClick={() => moveStep(index, 1)} aria-label={`Đưa bước ${index + 1} xuống`}>Xuống</button>
              <button type="button" className={`${buttonClass} text-error`} onClick={() => onChange(steps.filter((_, stepIndex) => stepIndex !== index))} aria-label={`Xóa bước ${index + 1}`}>Xóa</button>
            </div>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Tiêu đề bước {index + 1} <span className="text-error">*</span></span>
            <input name={`process-title-${index}`} required maxLength={120} pattern=".*\S.*" title="Tiêu đề phải có nội dung" value={step.title} onChange={(event) => updateStep(index, { title: event.target.value })} className="w-full rounded-xl border border-outline-variant bg-surface p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Mô tả bước {index + 1} <span className="text-error">*</span></span>
            <textarea name={`process-description-${index}`} required maxLength={2000} rows={3} value={step.description}
              ref={(element) => { element?.setCustomValidity(step.description && !step.description.trim() ? 'Vui lòng nhập mô tả bước' : ''); }}
              onChange={(event) => updateStep(index, { description: event.target.value })}
              className="w-full rounded-xl border border-outline-variant bg-surface p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" />
          </label>
        </div>
      ))}
      <button type="button" disabled={disabled || steps.length >= 20} onClick={() => onChange([...steps, { title: '', description: '' }])} className={`${buttonClass} text-primary`}>Thêm bước</button>
    </fieldset>
  );
}
