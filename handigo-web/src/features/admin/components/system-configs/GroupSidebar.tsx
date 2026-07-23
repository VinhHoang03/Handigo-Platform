import { groupOptions, type ConfigGroupKey, type ConfigItem } from "./config-definitions";

export function GroupSidebar({
  activeGroup,
  items,
  onChange,
}: {
  activeGroup: ConfigGroupKey | "all";
  items: ConfigItem[];
  onChange: (group: ConfigGroupKey | "all") => void;
}) {
  return (
    <aside className="space-y-2">
      {groupOptions.map((group) => {
        const count =
          group.key === "all"
            ? items.length
            : items.filter((item) => item.group === group.key).length;
        return (
          <button
            key={group.key}
            type="button"
            onClick={() => onChange(group.key)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-semibold ${
              activeGroup === group.key
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:bg-surface-container-low"
            }`}
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <group.icon aria-hidden="true" size={20} />
              <span className="truncate">{group.label}</span>
            </span>
            <span className="tabular-nums">{count}</span>
          </button>
        );
      })}
    </aside>
  );
}
