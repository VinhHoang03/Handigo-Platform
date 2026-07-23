interface OrderSummaryActionsProps {
  step: 1 | 2 | 3;
  orderType: string;
  actionLabel: string;
  isLoading?: boolean;
  disableAction: boolean;
  onBack: () => void;
  onAction: () => void;
}

/** Nút hành động chính/quay lại của thẻ tóm tắt đơn hàng, kèm ghi chú thanh toán. */
export const OrderSummaryActions: React.FC<OrderSummaryActionsProps> = ({
  step,
  orderType,
  actionLabel,
  isLoading,
  disableAction,
  onBack,
  onAction,
}) => (
  <>
    <div className="mt-lg space-y-sm">
      {step > 1 && (
        <button
          onClick={onBack}
          className="w-full py-3 border border-primary text-primary rounded-2xl font-bold hover:bg-primary/5 transition-[background-color,transform] active:scale-95 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Quay lại
        </button>
      )}
      <button
        onClick={onAction}
        disabled={disableAction}
        className="w-full bg-primary text-on-primary py-md rounded-2xl font-bold text-lg shadow-xl shadow-primary/20 hover:-translate-y-1 active:translate-y-0 transition-[transform,box-shadow] flex items-center justify-center gap-sm disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
      >
        {isLoading ? (
          <span className="animate-spin material-symbols-outlined">progress_activity</span>
        ) : (
          <>
            {step === 3 ? (
              <span className="material-symbols-outlined">
                {orderType === 'normal' ? 'lock' : 'event_available'}
              </span>
            ) : null}
            {actionLabel}
            <span className="material-symbols-outlined">arrow_forward</span>
          </>
        )}
      </button>
    </div>

    <p className="text-center text-xs leading-5 text-on-surface-variant mt-md">
      {orderType !== 'normal' && step >= 2
        ? 'Chưa thu tiền khi gửi yêu cầu. Bạn chỉ thanh toán sau khi chuyên gia xác nhận lịch.'
        : 'Thanh toán an toàn và bảo mật bởi HandiGo.'}
    </p>
  </>
);
