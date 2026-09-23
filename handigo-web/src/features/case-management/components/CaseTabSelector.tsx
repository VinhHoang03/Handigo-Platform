import { TAB_CONFIG, type CaseTab } from "./caseTabs.constants";

export type { CaseTab };

interface CaseTabSelectorProps {
  active: CaseTab;
  onChange: (tab: CaseTab) => void;
}

export function CaseTabSelector({ active, onChange }: CaseTabSelectorProps) {
  return (
    <section className="grid gap-3 md:grid-cols-3">
      {TAB_CONFIG.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={`rounded-2xl border p-4 text-left transition ${isActive ? "border-primary bg-primary/5 shadow-sm" : "border-outline-variant/40 bg-surface hover:border-primary/40"}`}
          >
            <div className="flex items-center gap-3">
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${isActive ? "bg-primary text-on-primary" : "bg-surface-container text-primary"}`}>
                <Icon size={20} />
              </span>
              <div>
                <p className="font-bold">{item.label}</p>
                <p className="mt-1 text-xs text-on-surface-variant">{item.description}</p>
              </div>
            </div>
          </button>
        );
      })}
    </section>
  );
}
