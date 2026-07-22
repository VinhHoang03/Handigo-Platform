import type { ConfigItem } from "./config-definitions";
import { typeOptions } from "./config-definitions";
import { dateTime, formatValue } from "./system-config-format";

export function ConfigList({
  items,
  onEdit,
}: {
  items: ConfigItem[];
  onEdit: (item: ConfigItem) => void;
}) {
  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-outline-variant p-8 text-center text-on-surface-variant">
        Chưa có cấu hình trong nhóm này.
      </div>
    );
  }

  return (
    <div className="divide-y divide-outline-variant/20 overflow-hidden rounded-lg border border-outline-variant/20">
      {items.map((item) => (
        <article
          key={item.key}
          className="grid min-w-0 gap-4 bg-surface-container-lowest p-4 hover:bg-surface-container-low lg:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.8fr)_auto] lg:items-center"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-on-surface">{item.label}</h2>
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-semibold ${item.isEffective ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
              >
                {item.isEffective ? "Đã nối logic" : "Chưa nối logic"}
              </span>
            </div>
            <p className="mt-1 text-sm leading-5 text-on-surface-variant">
              {item.description}
            </p>
            <p className="mt-1 text-xs leading-5 text-on-surface-variant">
              Hiệu lực: {item.effect}
            </p>
          </div>

          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                <span className="material-symbols-outlined text-[16px]">
                  {typeOptions[item.type].icon}
                </span>
                {typeOptions[item.type].label}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${item.existing ? "bg-primary-fixed text-primary" : "bg-surface-container-high text-on-surface-variant"}`}
              >
                {item.existing ? "Đã lưu" : "Mặc định"}
              </span>
            </div>
            <code className="block max-h-24 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-container-low px-3 py-2 text-sm tabular-nums text-on-surface">
              {formatValue(item.currentValue, item.type, item.unit)}
            </code>
            {item.existing && (
              <p className="text-xs tabular-nums text-on-surface-variant">
                Cập nhật: {dateTime.format(new Date(item.existing.updatedAt))}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => onEdit(item)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary"
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
            Sửa
          </button>
        </article>
      ))}
    </div>
  );
}
