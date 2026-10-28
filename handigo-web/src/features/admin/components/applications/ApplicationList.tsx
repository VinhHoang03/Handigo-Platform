import { ArrowUpRight } from "lucide-react";
import { InitialsAvatar } from "@/components/common/InitialsAvatar";
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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {items.map((item) => {
        const userName = item.userId?.fullName || "Tài khoản không còn tồn tại";
        const isServiceAddition = item.applicationType === "service_addition";

        return (
          <button
            key={item._id}
            type="button"
            onClick={() => onSelect(item)}
            aria-label={"Xem hồ sơ của " + userName}
            className="group flex h-48 min-w-0 flex-col rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 text-left transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <div className="flex w-full items-start gap-2">
              <InitialsAvatar
                name={userName}
                src={item.userId?.avatar}
                className="h-9 w-9 shrink-0"
                textClassName="text-xs"
              />
              <div className="min-w-0 flex-1">
                <p title={userName} className="truncate text-sm font-bold leading-5 text-on-surface">
                  {userName}
                </p>
                <p title={item.userId?.email} className="truncate text-xs leading-4 text-on-surface-variant">
                  {item.userId?.email || "Không còn thông tin tài khoản"}
                </p>
              </div>
              <div className="shrink-0 [&>span]:px-2 [&>span]:py-0.5 [&>span]:text-[11px]">
                <StatusBadge value={item.status} />
              </div>
            </div>

            <p className="mt-2 line-clamp-2 h-8 shrink-0 text-xs leading-4 text-on-surface-variant">
              {item.description?.trim() || "Chưa có giới thiệu."}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-4 text-on-surface">
              <span>{item.serviceIds.length} dịch vụ</span>
              {!isServiceAddition && (
                <>
                  <span className="text-outline-variant" aria-hidden="true">·</span>
                  <span>{item.experienceYears}+ năm kinh nghiệm</span>
                  <span className="inline-flex items-center gap-1 text-on-surface-variant">
                    <span aria-hidden="true" className={"size-1.5 shrink-0 rounded-full " + (item.identityDocument ? "bg-secondary" : "bg-outline-variant")} />
                    {item.identityDocument ? "Có giấy tờ" : "Chưa có giấy tờ"}
                  </span>
                </>
              )}
            </div>

            <div className="mt-auto flex w-full items-center justify-between gap-2 border-t border-outline-variant/30 pt-2">
              <span
                title={isServiceAddition ? "Bổ sung dịch vụ" : "Đăng ký nhà cung cấp"}
                className="min-w-0 truncate rounded-md bg-surface-container-low px-2 py-1 text-[11px] font-medium leading-4 text-on-surface-variant"
              >
                {isServiceAddition ? "Bổ sung dịch vụ" : "Đăng ký mới"}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary">
                Xem hồ sơ <ArrowUpRight aria-hidden="true" size={14} />
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
