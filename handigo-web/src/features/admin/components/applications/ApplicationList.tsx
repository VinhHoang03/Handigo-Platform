import { StatusBadge } from "@/components/common/StatusBadge";
import type { AdminApplication } from "../../types/admin.types";

export function ApplicationList({
  items,
  onSelect,
}: {
  items: AdminApplication[];
  onSelect: (item: AdminApplication) => void;
}) {
  return (
    <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const userName = item.userId?.fullName || "Tài khoản không còn tồn tại";

        return (
          <button
            key={item._id}
            type="button"
            onClick={() => onSelect(item)}
            className="group rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 text-left shadow-sm transition-all duration-200 hover:border-primary/50 hover:shadow-md hover:bg-surface-container-low active:scale-95"
          >
            {/* Header: Avatar & Status */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-1 items-center gap-3 min-w-0">
                <img
                  src={
                    item.userId?.avatar ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      userName,
                    )}`
                  }
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-primary/10"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-on-surface">
                    {userName}
                  </p>
                  <p className="truncate text-xs text-on-surface-variant">
                    {item.userId?.email || "Không còn thông tin tài khoản"}
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                <StatusBadge value={item.status} />
              </div>
            </div>

            {/* Description */}
            <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-on-surface">
              {item.description}
            </p>

            {/* Type Badge */}
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                {item.applicationType === "service_addition"
                  ? "Bổ sung dịch vụ"
                  : "Đăng ký provider"}
              </span>
            </div>

            {/* Meta Info */}
            <div className="mt-4 space-y-2 border-t border-outline-variant/30 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                Chi tiết hồ sơ
              </p>
              <div className="space-y-1.5 text-sm text-on-surface">
                <p>
                  <span className="font-semibold">
                    {item.serviceIds.length}
                  </span>{" "}
                  dịch vụ
                </p>
                {item.applicationType !== "service_addition" && (
                  <>
                    <p>
                      <span className="font-semibold">
                        {item.experienceYears}+
                      </span>{" "}
                      năm kinh nghiệm
                    </p>
                    <p className="inline-flex items-center gap-1">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          item.identityDocument
                            ? "bg-secondary"
                            : "bg-outline-variant"
                        }`}
                      />
                      {item.identityDocument ? "Có giấy tờ" : "Chưa có giấy tờ"}
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* CTA Indicator */}
            <div className="mt-4 flex items-center justify-end text-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <span className="text-xs font-semibold">Xem chi tiết →</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
