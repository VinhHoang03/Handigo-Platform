import type { LucideIcon } from "lucide-react";
export function CardTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon aria-hidden="true" size={24} className="text-primary" />
      <h2 className="font-headline-md text-on-surface">{title}</h2>
    </div>
  );
}
