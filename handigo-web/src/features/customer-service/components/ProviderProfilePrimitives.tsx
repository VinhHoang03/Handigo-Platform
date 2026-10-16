import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Các khối trình bày nhỏ dùng lại trong trang hồ sơ công khai của thợ. */

export function Metric({
  label,
  value,
  icon: Icon,
  compact = false,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  compact?: boolean;
}) {
  return (
    <div className={`${compact ? 'min-w-0 rounded-lg px-1.5 py-2.5' : 'rounded-2xl p-5'} border border-outline-variant/10 bg-surface-container-lowest text-center shadow-sm`}>
      <p title={label} className={`text-on-surface-variant ${compact ? 'mb-0.5 truncate text-[11px] font-medium leading-4 tracking-tight' : 'mb-1 text-xs font-bold uppercase tracking-wider'}`}>
        {label}
      </p>
      <div className={`flex items-center justify-center font-bold text-primary ${compact ? 'gap-0.5 whitespace-nowrap text-base leading-6 tabular-nums' : 'gap-1 text-2xl'}`}>
        {value}
        {Icon && (
          <Icon aria-hidden="true" size={compact ? 14 : 24} className="shrink-0 text-star-gold" />
        )}
      </div>
    </div>
  );
}

export function InfoSection({
  title,
  children,
  compact = false,
}: {
  title: string;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <section className={`${compact ? 'rounded-xl p-3' : 'rounded-2xl p-6'} border border-outline-variant/10 bg-surface-container-lowest shadow-sm`}>
      <h2 className={`font-bold text-on-background ${compact ? 'mb-2 text-base leading-6' : 'mb-4 text-2xl'}`}>{title}</h2>
      <div className={`text-on-surface-variant ${compact ? 'space-y-2 text-[15px] leading-6' : 'space-y-3 leading-7'}`}>
        {children}
      </div>
    </section>
  );
}

export function VerificationRow({
  icon: Icon,
  title,
  description,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div className={`flex items-center rounded-xl bg-surface-container-low ${compact ? 'gap-2 p-2' : 'gap-4 p-3'}`}>
      <div className={`grid shrink-0 place-items-center rounded-full bg-primary/10 text-primary ${compact ? 'h-9 w-9' : 'h-12 w-12'}`}>
        <Icon aria-hidden="true" size={compact ? 18 : 24} />
      </div>
      <div>
        <p className={`font-bold text-on-background ${compact ? 'text-[15px]' : ''}`}>{title}</p>
        <p className={`text-on-surface-variant ${compact ? 'text-[13px] leading-5' : 'text-sm'}`}>{description}</p>
      </div>
    </div>
  );
}

export function TrustItem({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-primary-container/5 p-3">
      <Icon aria-hidden="true" size={24} className="text-primary" />
      <span className="text-sm font-semibold">{text}</span>
    </div>
  );
}
