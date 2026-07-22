type BookingQuotationPendingProps = {
  orderStatus: string;
};

/** Trạng thái chờ chuyên gia gửi báo giá (chưa có báo giá nào). */
export const BookingQuotationPending = ({
  orderStatus,
}: BookingQuotationPendingProps) => (
  <div className="w-full overflow-hidden rounded-3xl border border-dashed border-amber-300/70 bg-amber-50/70 p-4 sm:p-5">
    <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
      <div className="mx-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 sm:mx-0">
        <span className="material-symbols-outlined text-2xl">request_quote</span>
      </div>

      <div className="min-w-0 flex-1 text-center sm:text-left">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="min-w-0 whitespace-normal break-words text-base font-bold leading-snug text-on-surface sm:text-lg">
            Đang chờ chuyên gia báo giá
          </h3>
          <span className="mx-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 sm:mx-0">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Chờ báo giá
          </span>
        </div>

        <div className="mt-3 space-y-2 text-sm leading-relaxed text-on-surface-variant">
          <p className="whitespace-normal break-words">
            {orderStatus === "created"
              ? "Đơn của bạn đã được ghi nhận. Sau khi chuyên gia nhận đơn, họ sẽ khảo sát và gửi báo giá chi tiết."
              : "Chuyên gia đang kiểm tra thông tin và lập báo giá chi tiết cho đơn này."}
          </p>
          <p className="whitespace-normal break-words">
            Khi có báo giá, bạn sẽ nhận được thông báo để xem chi phí và xác
            nhận trước khi tiếp tục.
          </p>
        </div>
      </div>
    </div>
  </div>
);
