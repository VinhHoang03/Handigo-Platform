import type { Service } from '../../../types/booking';
import { WalletBalanceText } from '@/features/wallet/components/WalletBalanceText';
import { Wallet } from "lucide-react";

const paymentMethods = [
  [
    'account_balance_wallet',
    'Ví Handigo',
    'Thanh toán ngay từ số dư ví',
    'wallet',
  ],
  [
    'account_balance',
    'Chuyển khoản ngân hàng',
    'Quét mã VietQR hoặc Internet Banking',
    'bank',
  ],
  ['payments', 'Tiền mặt', 'Thanh toán trực tiếp cho nhân viên', 'cash'],
] as const;

type PaymentMethodValue = 'wallet' | 'bank' | 'cash';

interface ConfirmPaymentMethodSelectorProps {
  isAppointment: boolean;
  service: Service | null;
  effectivePaymentMethod: PaymentMethodValue;
  onChangeMethod: (value: PaymentMethodValue) => void;
  paymentError: string;
}

/** Thẻ chọn phương thức thanh toán (ví / chuyển khoản / tiền mặt). */
export const ConfirmPaymentMethodSelector = ({
  isAppointment, service, effectivePaymentMethod, onChangeMethod, paymentError,
}: ConfirmPaymentMethodSelectorProps) => (
  <section className="bg-surface-container-lowest rounded-xl p-md border border-outline-variant/30 shadow-sm">
    <h2 className="font-headline-md text-headline-md mb-6 flex items-center gap-2">
      <Wallet aria-hidden="true" size={24} className="text-primary" />
      {isAppointment ? 'Phương thức sẽ thanh toán' : 'Phương thức thanh toán'}
    </h2>
    {isAppointment && (
      <p className="mb-4 text-sm text-on-surface-variant">
        Phương thức này được lưu cho bước thanh toán sau khi chuyên gia nhận lịch.
      </p>
    )}
    <div className="space-y-3">
      {paymentMethods
        .filter(([, , , value]) => {
          if (service?.serviceType === 'variable_price') {
            // Dịch vụ cần khảo sát cho phép đặt cọc qua PayOS hoặc Ví Handigo.
            return value !== 'cash';
          }
          return true;
        })
        .map(([icon, title, subtitle, value]) => (
          <label
            key={value}
            className="group relative flex items-center p-4 rounded-xl border border-outline-variant/50 hover:border-primary cursor-pointer transition-colors bg-surface-container-low/30 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
          >
            <input
              checked={effectivePaymentMethod === value}
              onChange={() => onChangeMethod(value)}
              className="peer sr-only"
              name="payment"
              type="radio"
              value={value}
            />
            <div className="flex-1 flex items-center gap-4 peer-focus-visible:rounded-lg peer-focus-visible:ring-4 peer-focus-visible:ring-primary/15">
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center ${effectivePaymentMethod === value ? 'bg-primary text-on-primary' : 'bg-on-surface/5 text-on-surface'}`}
              >
                <span className="material-symbols-outlined">
                  {icon}
                </span>
              </div>
              <div>
                <p className="font-body-md text-body-md font-semibold">
                  {title}
                </p>
                <p className="font-label-sm text-label-sm text-on-surface-variant">
                  {subtitle}
                </p>
                {value === 'wallet' && <WalletBalanceText />}
              </div>
            </div>
            <div className="w-6 h-6 border-2 border-outline-variant rounded-full peer-checked:border-primary peer-checked:bg-primary flex items-center justify-center transition-all">
              <div className="w-2.5 h-2.5 bg-surface-container-lowest rounded-full" />
            </div>
          </label>
        ))}
    </div>

    {paymentError && (
      <div role="alert" className="mt-4 rounded-xl bg-error/10 px-4 py-3 text-sm font-medium text-error">
        {paymentError}
      </div>
    )}
  </section>
);
