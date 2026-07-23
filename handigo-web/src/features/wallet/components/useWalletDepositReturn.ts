import { useEffect, useRef } from 'react';
import { walletApi } from '../api/wallet.api';
import { getErrorMessage } from './wallet-formatters';

export const PENDING_DEPOSIT_ORDER_CODE_KEY = 'handigo:pending-wallet-deposit-order-code';

interface UseWalletDepositReturnParams {
  refreshAll: () => Promise<void>;
  setError: (message: string) => void;
  setNotice: (message: string) => void;
}

/**
 * Đồng bộ trạng thái nạp ví khi PayOS chuyển hướng người dùng quay lại trang
 * (qua query string `walletDeposit`/`orderCode` hoặc mã đơn còn lưu tạm ở
 * sessionStorage). Chạy đúng một lần khi trang mount.
 */
export function useWalletDepositReturn({ refreshAll, setError, setNotice }: UseWalletDepositReturnParams) {
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const walletDepositStatus = params.get('walletDeposit');
    const storedOrderCode = sessionStorage.getItem(PENDING_DEPOSIT_ORDER_CODE_KEY);
    const orderCode = params.get('orderCode') || storedOrderCode;

    if (!orderCode || (!walletDepositStatus && !storedOrderCode)) return;

    handledRef.current = true;
    if (walletDepositStatus) {
      window.history.replaceState({}, '', window.location.pathname);
    }

    const syncDepositStatus = async () => {
      setError('');
      setNotice('');
      try {
        if (walletDepositStatus === 'cancelled') {
          await walletApi.cancelDeposit(orderCode);
          setNotice('Đã hủy giao dịch nạp ví.');
        } else {
          const transaction = await walletApi.syncDeposit(orderCode);
          if (transaction.status === 'success') {
            setNotice('Nạp ví thành công. Số dư đã được cập nhật.');
          } else {
            setNotice('Giao dịch nạp ví chưa được PayOS xác nhận, vui lòng kiểm tra lại sau.');
          }
        }
        sessionStorage.removeItem(PENDING_DEPOSIT_ORDER_CODE_KEY);
        await refreshAll();
      } catch (err) {
        setError(getErrorMessage(err));
      }
    };

    void syncDepositStatus();
  }, [refreshAll, setError, setNotice]);
}
