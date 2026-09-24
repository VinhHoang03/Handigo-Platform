import { HardHat, type LucideIcon, Shield, User } from "lucide-react";
export type CustomerProfileTab = "profile" | "security" | "applications";

const TABS: Array<[CustomerProfileTab, string, LucideIcon]> = [
  ["profile", "Hồ sơ", User],
  ["security", "Bảo mật", Shield],
  ["applications", "Đơn của tôi", HardHat],
];

interface ProfileTabsNavProps {
  activeTab: CustomerProfileTab;
  onChange: (tab: CustomerProfileTab) => void;
}

export function ProfileTabsNav({ activeTab, onChange }: ProfileTabsNavProps) {
  return (
    <div
      role="tablist"
      aria-label="Các mục hồ sơ khách hàng"
      className="flex gap-2 overflow-x-auto rounded-2xl border border-outline-variant/30 bg-surface-container-low p-2 shadow-sm sm:grid sm:grid-cols-3"
    >
      {TABS.map(([value, label, Icon]) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={activeTab === value}
          className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === value
              ? "bg-primary text-on-primary"
              : "text-on-surface-variant hover:bg-surface-container-low"
          }`}
          onClick={() => onChange(value)}
        >
          <Icon aria-hidden="true" size={18} />
          {label}
        </button>
      ))}
    </div>
  );
}
