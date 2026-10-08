import type { ServiceProcessStep } from '@/types/serviceProcess';
import { GitBranch } from 'lucide-react';

export function ServiceProcessSection({ steps = [] }: { steps?: ServiceProcessStep[] }) {
  return (
    <section className="rounded-2xl border border-outline-variant/40 bg-surface p-5 shadow-sm sm:p-7">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-3 text-xl font-bold text-on-surface sm:text-2xl">
          <GitBranch aria-hidden="true" size={26} className="shrink-0 text-primary" />
          Quy trình dịch vụ
        </h2>
        {steps.length > 0 && <span className="text-sm font-semibold text-primary">{steps.length} bước</span>}
      </div>
      {steps.length === 0 ? (
        <p className="text-on-surface-variant">Quy trình dịch vụ đang được cập nhật.</p>
      ) : (
        <ol>
          {steps.map((step, index) => (
            <li key={index} className="relative flex gap-4 pb-7 last:pb-0">
              {index < steps.length - 1 && <span aria-hidden="true" className="absolute bottom-0 left-[15px] top-8 w-0.5 bg-primary/15" />}
              <span aria-hidden="true" className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary ring-4 ring-surface">{index + 1}</span>
              <div className="min-w-0 pt-0.5">
                <h3 className="break-words font-semibold leading-6 text-on-surface">Bước {index + 1}: {step.title}</h3>
                <p className="mt-1 whitespace-pre-wrap break-words leading-6 text-on-surface-variant">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
