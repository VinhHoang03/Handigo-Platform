import { MaterialIcon } from "../common/MaterialIcon";

type TrackingStep = {
  label: string;
  time: string;
  state: "done" | "active" | "todo";
};

const trackingSteps: TrackingStep[] = [
  { label: "Đã xác nhận", time: "09:12", state: "done" },
  { label: "Thợ đang đến", time: "09:34", state: "active" },
  { label: "Hoàn thành", time: "—", state: "todo" },
];

const StepMarker = ({ state }: { state: TrackingStep["state"] }) => {
  if (state === "done") {
    return (
      <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-on-primary">
        <MaterialIcon className="text-[13px]">check</MaterialIcon>
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/12">
        <span className="h-2 w-2 rounded-full bg-primary" />
      </span>
    );
  }
  return (
    <span className="grid h-5 w-5 place-items-center rounded-full border border-outline-variant" />
  );
};

/**
 * Ảnh minh hoạ hero: dựng bằng chính design token của hệ thống thay vì ảnh
 * bitmap. Sắc nét ở mọi độ phân giải và phản ánh đúng luồng theo dõi đơn thật.
 */
export const HeroPreviewCard = () => (
  <div className="relative" aria-hidden="true">
    {/* Lớp thẻ phía sau tạo chiều sâu, lệch nhẹ để phá thế đối xứng */}
    <div className="absolute inset-x-6 -top-4 h-24 rounded-3xl border border-outline-variant/40 bg-surface-container-low" />

    <div className="relative rounded-3xl border border-outline-variant/50 bg-surface-container-lowest p-6 shadow-[0_28px_64px_-24px_rgba(19,27,46,0.30)]">
      <div className="flex items-center justify-between">
        <span className="text-label-sm font-medium tabular-nums text-on-surface-variant">
          Yêu cầu #HG-2847
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/12 px-2.5 py-1 text-label-sm font-semibold text-secondary">
          <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
          Đang đến
        </span>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-sm font-semibold text-on-primary">
          VH
        </span>
        <span className="min-w-0">
          <span className="block truncate text-label-md font-semibold text-on-surface">
            Vũ Hoàng
          </span>
          <span className="flex items-center gap-1 text-label-sm text-on-surface-variant">
            <MaterialIcon filled className="text-[14px] text-tertiary">
              star
            </MaterialIcon>
            <span className="tabular-nums">4,9</span>
            <span className="tabular-nums">· 218 đánh giá</span>
          </span>
        </span>
      </div>

      <ol className="mt-6 space-y-3.5 border-t border-outline-variant/40 pt-5">
        {trackingSteps.map((step) => (
          <li key={step.label} className="flex items-center gap-3">
            <StepMarker state={step.state} />
            <span
              className={`flex-1 text-label-md ${
                step.state === "todo"
                  ? "text-on-surface-variant/70"
                  : "font-medium text-on-surface"
              }`}
            >
              {step.label}
            </span>
            <span className="text-label-sm tabular-nums text-on-surface-variant">
              {step.time}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-5 flex items-end justify-between gap-4 border-t border-outline-variant/40 pt-5">
        <span className="min-w-0">
          <span className="block truncate text-label-md font-medium text-on-surface">
            Sửa vòi nước rò rỉ
          </span>
          <span className="block text-label-sm text-on-surface-variant">
            Tạm tính
          </span>
        </span>
        <span className="shrink-0 text-xl font-semibold tabular-nums text-on-surface">
          280.000₫
        </span>
      </div>

      <div className="-mx-6 -mb-6 mt-5 flex items-center gap-2 rounded-b-3xl bg-surface-container-low px-6 py-3.5">
        <MaterialIcon filled className="text-[17px] text-secondary">
          shield
        </MaterialIcon>
        <span className="text-label-sm text-on-surface-variant">
          Bảo hành <span className="font-semibold text-on-surface">30 ngày</span>{" "}
          cho mọi hạng mục
        </span>
      </div>
    </div>
  </div>
);
