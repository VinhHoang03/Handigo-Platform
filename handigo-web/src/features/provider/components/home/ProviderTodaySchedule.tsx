import { Link } from "react-router-dom";
import type { Order } from "@/types/booking";
import { Skeleton } from "@/components/common/Skeleton";
import { getOrderStatusMeta } from "@/utils/orderStatus";
import { getOrderDate, shortAddress } from "./providerHome.utils";
import { ArrowRight, CalendarCheck } from "lucide-react";

interface ProviderTodayScheduleProps {
  todaySchedule: Order[];
  isLoadingSchedule: boolean;
  scheduleError: string | null;
}

export function ProviderTodaySchedule({
  todaySchedule,
  isLoadingSchedule,
  scheduleError,
}: ProviderTodayScheduleProps) {
  return (
    <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-md">
      <div className="mb-md flex items-center justify-between">
        <h3 className="font-headline-md text-on-surface">Lịch hôm nay</h3>
        <Link
          to="/provider/schedule"
          aria-label="Xem lịch làm việc"
          className="rounded-full p-xs transition-colors hover:bg-surface-container"
        >
          <ArrowRight aria-hidden="true" size={24} className="text-outline" />
        </Link>
      </div>
      {isLoadingSchedule ? (
        <Skeleton className="h-64 w-full" rounded="rounded-2xl" />
      ) : scheduleError ? (
        <div className="rounded-2xl bg-error/5 px-4 py-8 text-center text-sm text-error">
          {scheduleError}
        </div>
      ) : todaySchedule.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-outline-variant/40 px-4 py-10 text-center text-on-surface-variant">
          <CalendarCheck aria-hidden="true" size={36} />
          <p className="mt-2 text-sm font-semibold">
            Hôm nay chưa có lịch làm việc.
          </p>
        </div>
      ) : (
        <div className="relative space-y-md before:absolute before:bottom-2 before:left-[11px] before:top-2 before:w-[2px] before:bg-surface-variant before:content-['']">
          {todaySchedule.map((order) => {
            const active = order.status === "in_progress";
            const address = shortAddress(order);

            return (
              <div key={order._id} className="relative pl-xl">
                <div
                  className={`absolute left-0 top-1 z-10 h-6 w-6 rounded-full border-4 border-surface-container-high ${active ? "bg-primary" : "bg-outline-variant"}`}
                />
                <Link
                  to={`/provider/orders/${order._id}`}
                  className={`block rounded-2xl p-sm transition hover:bg-primary/10 ${active ? "border-l-4 border-primary bg-primary/5" : "bg-surface-container-low"}`}
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    {active && (
                      <span className="inline-flex rounded-full bg-primary px-sm text-[10px] font-bold text-on-primary">
                        ĐANG THỰC HIỆN
                      </span>
                    )}
                    <span className="text-[10px] font-bold uppercase text-on-surface-variant">
                      {getOrderStatusMeta(order.status).label}
                    </span>
                  </div>
                  <p className="text-xs font-bold uppercase text-primary">
                    {getOrderDate(order).toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <h4 className="text-sm font-bold">
                    {order.serviceId?.name || "Dịch vụ"}
                  </h4>
                  {address && (
                    <p className="line-clamp-2 text-xs text-on-surface-variant">
                      {address}
                    </p>
                  )}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
