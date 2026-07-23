import type { TimelineStep } from "./bookingDetailTimeline";

type BookingStatusTimelineProps = {
  status: string;
  statusLabel: string;
  timeline: TimelineStep[];
};

/** Thẻ "Theo dõi tiến độ" ở cột phụ — vẽ các mốc trạng thái của đơn hàng. */
export const BookingStatusTimeline = ({
  status,
  statusLabel,
  timeline,
}: BookingStatusTimelineProps) => (
  <section className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-md shadow-sm sm:p-lg">
    <div className="mb-md flex items-center justify-between gap-sm">
      <h3 className="font-label-sm text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">
        Theo dõi tiến độ
      </h3>
      <span
        className={`rounded-full px-3 py-1 text-xs font-bold ${status === "cancelled" ? "bg-error/10 text-error" : "bg-primary/10 text-primary"}`}
      >
        {statusLabel}
      </span>
    </div>
    <div>
      {timeline.map((step, index) => {
        const isDone = step.state === "done";
        const isActive = step.state === "active";
        const isCancelled = step.state === "cancelled";
        const isLast = index === timeline.length - 1;

        return (
          <div
            key={step.title}
            className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] gap-sm pb-5 last:pb-0"
          >
            <div className="relative flex justify-center">
              <span
                className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border text-sm transition-colors ${
                  isCancelled
                    ? "border-error bg-error text-on-error"
                    : isDone
                      ? "border-primary bg-primary text-on-primary"
                      : isActive
                        ? "border-2 border-primary bg-surface-container-lowest text-primary ring-[3px] ring-primary-fixed"
                        : "border-outline-variant bg-surface-container-lowest text-on-surface-variant"
                }`}
              >
                <span className="material-symbols-outlined text-[16px] leading-none">
                  {step.icon}
                </span>
              </span>
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={`absolute bottom-[-20px] left-1/2 top-8 w-px -translate-x-1/2 ${isDone ? "bg-primary" : "bg-outline-variant"}`}
                />
              )}
            </div>
            <div
              className={`min-w-0 ${isActive ? "-mt-1 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2" : "pt-0.5"}`}
            >
              <div>
                <h4
                  className={`text-sm leading-5 ${isCancelled ? "font-bold text-error" : isActive ? "font-bold text-primary" : isDone ? "font-semibold text-on-surface" : "font-semibold text-on-surface-variant"}`}
                >
                  {step.title}
                </h4>
                {step.time && (
                  <span className="mt-0.5 block break-words text-[11px] font-medium leading-4 text-on-surface-variant">
                    {step.time}
                  </span>
                )}
              </div>
              <p
                className={`mt-1 break-words text-xs leading-5 ${isActive ? "font-medium text-on-surface" : "text-on-surface-variant"}`}
              >
                {step.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  </section>
);
