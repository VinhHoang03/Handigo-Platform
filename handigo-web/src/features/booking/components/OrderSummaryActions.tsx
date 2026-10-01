import { ArrowLeft, ArrowRight, CalendarCheck, Loader2, Lock } from "lucide-react";
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
    <div className={`mt-lg ${step > 1 ? 'grid grid-cols-2 gap-2' : 'space-y-sm'}`}>
      {step > 1 && (
        <button
          onClick={onBack}
          className="w-full min-h-11 px-2 py-2 border border-primary text-primary rounded-xl text-sm leading-5 font-bold hover:bg-primary/5 transition-[background-color,transform] active:scale-95 flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
        >
          <ArrowLeft aria-hidden="true" size={14} className="shrink-0" />
          Quay lại
        </button>
      )}
      <button
        onClick={onAction}
        disabled={disableAction}
        className={`w-full bg-primary text-on-primary font-bold shadow-primary/20 active:translate-y-0 transition-[transform,box-shadow] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 ${step > 1 ? 'min-h-11 px-2 py-2 rounded-xl text-sm leading-5 gap-1.5 shadow-sm hover:shadow-md' : 'py-md rounded-2xl text-lg gap-sm shadow-xl hover:-translate-y-1'}`}
      >
        {isLoading ? (
          <Loader2 aria-hidden="true" size={step > 1 ? 16 : 24} className="shrink-0 animate-spin" />
        ) : (
          <>
            {step === 3 ? (
              orderType === 'normal' ? <Lock aria-hidden="true" size={14} className="shrink-0" /> : <CalendarCheck aria-hidden="true" size={14} className="shrink-0" />
            ) : null}
            {actionLabel}
            {step === 1 && <ArrowRight aria-hidden="true" size={24} />}
          </>
        )}
      </button>
    </div>

    <p className="text-center text-xs leading-5 text-on-surface-variant mt-md">
      Thanh toán an toàn và bảo mật bởi HandiGo.
    </p>
  </>
);
