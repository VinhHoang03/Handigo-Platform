import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { walletApi } from '../api/wallet.api';
import type { WalletTransaction } from '../types/wallet.types';

type Callback = 'success' | 'cancel';
type Result = 'processing' | 'success' | 'cancelled' | 'pending' | 'failed' | 'error';

const STORAGE_KEY = 'handigo:pending-wallet-deposit-order-code';
const details = {
  success: ['check_circle', 'Nạp ví thành công', 'PayOS đã xác nhận và số dư ví đã được cập nhật.', 'bg-emerald-100 text-emerald-700'],
  cancelled: ['cancel', 'Đã hủy nạp ví', 'Giao dịch đã được hủy và số dư ví không thay đổi.', 'bg-amber-100 text-amber-700'],
  pending: ['schedule', 'Đang chờ PayOS xác nhận', 'Giao dịch chưa có kết quả cuối cùng. Bạn có thể kiểm tra lại sau ít phút.', 'bg-amber-100 text-amber-700'],
  failed: ['error', 'Nạp ví chưa thành công', 'PayOS không thể hoàn tất giao dịch. Số dư ví không thay đổi.', 'bg-error/10 text-error'],
} satisfies Record<Exclude<Result, 'processing' | 'error'>, [string, string, string, string]>;

const getResult = (transaction: WalletTransaction): Result => {
  if (transaction.status === 'success') return 'success';
  if (transaction.status === 'cancelled') return 'cancelled';
  if (transaction.status === 'failed') return 'failed';
  return 'pending';
};

const getError = (error: unknown) => {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error ? error.message : 'Không thể kiểm tra giao dịch.';
};

export default function WalletDepositResultPage({ callback }: { callback: Callback }) {
  const role = useAuthStore((state) => state.user?.role);
  const handled = useRef(false);
  const [result, setResult] = useState<Result>('processing');
  const [error, setError] = useState('');
  const orderCode = new URLSearchParams(window.location.search).get('orderCode')
    || sessionStorage.getItem(STORAGE_KEY) || '';
  const walletPath = role?.toUpperCase() === 'PROVIDER' ? '/provider/wallet' : '/customer/wallet';

  const processDeposit = useCallback(async () => {
    if (!orderCode) {
      setResult('error');
      setError('Không tìm thấy mã giao dịch nạp ví trong đường dẫn trả về.');
      return;
    }
    setResult('processing');
    setError('');
    try {
      const transaction = callback === 'cancel'
        ? await walletApi.cancelDeposit(orderCode)
        : await walletApi.syncDeposit(orderCode);
      const nextResult = getResult(transaction);
      setResult(nextResult);
      if (nextResult !== 'pending') sessionStorage.removeItem(STORAGE_KEY);
    } catch (requestError) {
      setResult('error');
      setError(getError(requestError));
    }
  }, [callback, orderCode]);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    void processDeposit();
  }, [processDeposit]);

  const content = result === 'processing' || result === 'error' ? null : details[result];
  const icon = content?.[0] || 'error';
  const title = content?.[1] || 'Chưa thể kiểm tra giao dịch';
  const description = content?.[2] || error;
  const tone = content?.[3] || 'bg-error/10 text-error';

  return (
    <main className={'grid min-h-screen place-items-center bg-surface-container-low px-4 py-10'}>
      <section
        aria-live={'polite'}
        className={'w-full max-w-xl rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-6 text-center shadow-sm sm:p-10'}
      >
        {result === 'processing' ? (
          <>
            <div
              aria-hidden={true}
              className={'mx-auto h-14 w-14 animate-spin rounded-full border-4 border-primary/20 border-t-primary'}
            />
            <h1 className={'mt-6 text-headline-md font-bold text-on-surface'}>
              Đang kiểm tra giao dịch
            </h1>
            <p className={'mt-3 text-on-surface-variant'}>
              Handigo đang đối chiếu trạng thái trực tiếp với PayOS.
            </p>
          </>
        ) : (
          <>
            <div className={['mx-auto grid h-16 w-16 place-items-center rounded-full', tone].join(' ')}>
              <span className={'material-symbols-outlined text-4xl'} aria-hidden={true}>{icon}</span>
            </div>
            <h1 className={'mt-6 text-headline-md font-bold text-on-surface'}>{title}</h1>
            <p className={'mt-3 text-on-surface-variant'}>{description}</p>
          </>
        )}
        {result !== 'processing' && (
          <div className={'mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center'}>
            {(result === 'pending' || result === 'error') && orderCode && (
              <button
                type={'button'}
                onClick={() => void processDeposit()}
                className={'min-h-12 rounded-xl border border-outline-variant px-5 font-semibold text-on-surface hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'}
              >
                Kiểm tra lại
              </button>
            )}
            <Link
              to={walletPath}
              className={'inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-6 font-semibold text-on-primary hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'}
            >
              Về trang ví
            </Link>
          </div>
        )}
        {orderCode && result !== 'processing' && (
          <p className={'mt-6 text-sm text-on-surface-variant'}>
            Mã giao dịch: <span className={'font-semibold text-on-surface'}>{orderCode}</span>
          </p>
        )}
      </section>
    </main>
  );
}
