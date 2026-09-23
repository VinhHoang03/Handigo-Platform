import React from "react";
import type { ServiceArea } from "../../types/provider.types";

export const ServiceAreaPanel: React.FC<{
  area: ServiceArea;
  onEdit?: () => void;
}> = ({ area, onEdit }) => (
  <aside className="overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm">
    <div className="mb-6 flex items-center justify-between gap-3">
      <h3 className="text-pretty font-headline-md text-headline-md text-on-surface">
        Khu vực phục vụ
      </h3>
      {onEdit && (
        <button
          type="button"
          className="text-sm font-bold text-primary hover:underline"
          onClick={onEdit}
        >
          Chỉnh sửa
        </button>
      )}
    </div>
    {area.workingAreas?.length ? (
      <div className="flex flex-wrap gap-2">
        {area.workingAreas.map((item) => (
          <span
            key={item}
            className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary"
          >
            {item}
          </span>
        ))}
      </div>
    ) : (
      <div className="space-y-4">
        <div>
          <p className="mb-1 text-xs font-bold uppercase text-on-surface-variant">
            Tỉnh/Thành phố
          </p>
          <p className="text-sm">{area.province || "Chưa cập nhật"}</p>
        </div>
        <div>
          <p className="mb-1 text-xs font-bold uppercase text-on-surface-variant">
            Xã/Phường
          </p>
          <p className="text-sm">{area.ward || "Chưa cập nhật"}</p>
        </div>
      </div>
    )}
  </aside>
);
