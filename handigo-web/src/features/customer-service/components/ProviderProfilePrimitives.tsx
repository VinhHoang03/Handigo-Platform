import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Các khối trình bày nhỏ dùng lại trong trang hồ sơ công khai của thợ. */

export function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5 text-center shadow-sm">
      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
        {label}
      </p>
      <div className="flex items-center justify-center gap-1 text-2xl font-bold text-primary">
        {value}
        {Icon && (
          <Icon aria-hidden="true" size={24} className="text-star-gold" />
        )}
      </div>
    </div>
  );
}

export function InfoSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm">
      <h2 className="mb-4 text-2xl font-bold text-on-background">{title}</h2>
      <div className="space-y-3 leading-7 text-on-surface-variant">
        {children}
      </div>
    </section>
  );
}

export function VerificationRow({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-surface-container-low p-3">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon aria-hidden="true" size={24} />
      </div>
      <div>
        <p className="font-bold text-on-background">{title}</p>
        <p className="text-sm text-on-surface-variant">{description}</p>
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
