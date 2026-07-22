import { customerCancellationReasons } from "./bookingDetailConstants";

type BookingCancellationReasonFormProps = {
  reason: string;
  additionalInfo?: string;
  busy: boolean;
  onUpdateReason: (reason: string) => void;
  onUpdateAdditionalInfo: (info: string) => void;
};

/** Chọn lý do hủy đơn (danh sách cố định) + ghi chú thêm — dùng trong modal hủy đơn/chuỗi lịch. */
export const BookingCancellationReasonForm = ({
  reason,
  additionalInfo,
  busy,
  onUpdateReason,
  onUpdateAdditionalInfo,
}: BookingCancellationReasonFormProps) => (
  <div className="space-y-md">
    <fieldset className="space-y-2">
      <legend className="mb-2 text-label-sm font-bold uppercase text-on-surface-variant">
        Chọn lý do hủy
      </legend>
      {customerCancellationReasons.map((cancellationReason) => (
        <label
          key={cancellationReason}
          className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition ${reason === cancellationReason ? "border-error/30 bg-error/8" : "border-outline-variant/50 hover:bg-surface-container-low"}`}
        >
          <input
            type="radio"
            name="customer-cancellation-reason"
            value={cancellationReason}
            checked={reason === cancellationReason}
            onChange={() => onUpdateReason(cancellationReason)}
            disabled={busy}
            className="mt-0.5 text-error focus:ring-error"
          />
          <span className="text-sm font-medium text-on-surface">
            {cancellationReason}
          </span>
        </label>
      ))}
    </fieldset>
    <label className="block">
      <span className="mb-2 block text-label-sm font-bold uppercase text-on-surface-variant">
        Thông tin thêm{" "}
        {reason === "Lý do khác" && <span className="text-error">*</span>}
      </span>
      <textarea
        value={additionalInfo || ""}
        onChange={(event) => onUpdateAdditionalInfo(event.target.value)}
        disabled={busy}
        maxLength={500}
        rows={3}
        className="w-full resize-none rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
        placeholder="Nhập thêm thông tin để chúng tôi hỗ trợ tốt hơn..."
      />
      <span className="mt-1 block text-right text-xs text-on-surface-variant">
        {additionalInfo?.length || 0}/500
      </span>
    </label>
  </div>
);
