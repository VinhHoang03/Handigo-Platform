import { Link } from "react-router-dom";
import type { Order } from "@/types/booking";
import { getStatusLabel } from "./bookingDetailFormatters";

type BookingRecurringSeriesSectionProps = {
  order: Order;
  recurringOrders: Order[];
};

/** Danh sách các buổi trong chuỗi lịch định kỳ — chỉ hiển thị cho đơn `recurring`. */
export const BookingRecurringSeriesSection = ({
  order,
  recurringOrders,
}: BookingRecurringSeriesSectionProps) => {
  if (order.orderType !== "recurring") return null;

  return (
    <section className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-lg shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-label-sm font-bold uppercase tracking-wider text-primary">
            Lịch định kỳ
          </p>
          <h2 className="mt-1 text-xl font-bold text-on-surface">
            Buổi {order.occurrenceNumber || 1}/{order.totalOccurrences || recurringOrders.length}
          </h2>
        </div>
        <p className="text-sm text-on-surface-variant">
          Lặp theo {order.recurrenceUnit === "monthly" ? "tháng" : "tuần"}
        </p>
      </div>

      {recurringOrders.length > 0 ? (
        <div className="mt-md grid gap-2 sm:grid-cols-2">
          {recurringOrders.map((recurringOrder) => {
            const isCurrent = recurringOrder._id === order._id;
            return (
              <Link
                key={recurringOrder._id}
                to={`/customer/bookings/${recurringOrder._id}`}
                className={`rounded-2xl border p-3 transition hover:border-primary/50 ${
                  isCurrent
                    ? "border-primary bg-primary/5"
                    : "border-outline-variant/50 bg-surface-container-low"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-on-surface">
                    Buổi {recurringOrder.occurrenceNumber}
                  </span>
                  <span className="text-xs font-semibold text-on-surface-variant">
                    {getStatusLabel(recurringOrder.status)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {recurringOrder.scheduledAt
                    ? new Date(recurringOrder.scheduledAt).toLocaleString("vi-VN")
                    : "Chưa có thời gian"}
                </p>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="mt-md text-sm text-on-surface-variant">
          Chưa thể tải danh sách các buổi trong chuỗi.
        </p>
      )}
    </section>
  );
};
