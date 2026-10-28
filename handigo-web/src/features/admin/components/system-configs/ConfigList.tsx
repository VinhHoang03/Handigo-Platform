import type { ConfigItem } from "./config-definitions";
import { typeOptions } from "./config-definitions";
import { dateTime, formatConfigValue } from "./system-config-format";
import { Pencil } from "lucide-react";

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
          className={`grid min-w-0 gap-4 bg-surface-container-lowest p-4 hover:bg-surface-container-low lg:items-center ${item.group === "policy" ? "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto]" : "lg:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.8fr)_auto]"}`}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-on-surface">{item.label}</h2>
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-semibold ${item.isEffective ? "bg-success-container text-on-success-container" : "bg-warning-container text-on-warning-container"}`}
              >
                {item.isEffective ? "Đang áp dụng" : "Chưa áp dụng"}
              </span>
            </div>
            <p className={`mt-1 text-sm leading-5 text-on-surface-variant ${item.group === "policy" ? "line-clamp-2" : ""}`}>
              {item.description}
            </p>
            {item.group !== "policy" && <p className="mt-1 text-xs leading-5 text-on-surface-variant">
              Hiệu lực: {item.effect}
            </p>}
          </div>

          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                {(() => {
                  const TypeIcon = typeOptions[item.type].icon;
                  return <TypeIcon aria-hidden="true" size={16} />;
                })()}
                {item.group === "policy" ? "Chính sách" : typeOptions[item.type].label}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${item.existing ? "bg-primary-fixed text-primary" : "bg-surface-container-high text-on-surface-variant"}`}
              >
                {item.existing ? "Đã lưu" : "Mặc định"}
              </span>
            </div>
            <div className={`whitespace-pre-wrap break-words rounded-lg bg-surface-container-low px-3 py-2 text-sm leading-6 tabular-nums text-on-surface ${item.group === "policy" ? "line-clamp-3" : "block max-h-24 overflow-auto"}`}>
              {formatConfigValue(item, item.currentValue, item.group === "policy")}
            </div>
            {item.group === "policy" && <p className="text-xs text-on-surface-variant">Bấm Sửa để xem đầy đủ.</p>}
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
            <Pencil aria-hidden="true" size={18} />
            Sửa
          </button>
        </article>
      ))}
    </div>
  );
}
