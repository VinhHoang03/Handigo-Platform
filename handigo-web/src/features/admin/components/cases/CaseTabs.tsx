import type { LucideIcon } from "lucide-react";
import { FileWarning, Flag, Gavel } from "lucide-react";
import type { AdminCaseTab } from "./case-detail.types";

const TABS: Array<{ value: AdminCaseTab; label: string; icon: LucideIcon }> = [
  { value: "complaints", label: "Khiếu nại", icon: FileWarning },
  { value: "reports", label: "Báo cáo", icon: Flag },
  { value: "violations", label: "Vi phạm", icon: Gavel },
];

export function CaseTabs({ tab, onSwitch }: { tab: AdminCaseTab; onSwitch: (tab: AdminCaseTab) => void }) {
  return (
    <section className="grid gap-3 sm:grid-cols-3">
      {TABS.map((item) => {
        const Icon = item.icon;
        const active = tab === item.value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onSwitch(item.value)}
            className={`flex items-center gap-3 rounded-2xl border p-4 text-left ${
              active ? "border-primary bg-primary/5 text-primary" : "border-outline-variant/40 bg-surface-container-lowest"
            }`}
          >
            <Icon size={20} />
            <span className="font-bold">{item.label}</span>
          </button>
        );
      })}
    </section>
  );
}
