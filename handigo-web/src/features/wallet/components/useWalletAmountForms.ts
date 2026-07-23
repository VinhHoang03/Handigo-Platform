import { useState, type FormEvent } from 'react';
import { walletApi } from '../api/wallet.api';
import { getErrorMessage, parseAmount } from './wallet-formatters';
import { PENDING_DEPOSIT_ORDER_CODE_KEY } from './useWalletDepositReturn';

interface UseWalletAmountFormsParams {
  isProvider: boolean;
  walletBalance?: number;
  refreshAll: () => Promise<void>;
  setError: (message: string) => void;
  setNotice: (message: string) => void;
}

/** Trạng thái + hành vi của 2 modal nhập số tiền: nạp ví và rút tiền. */
export function useWalletAmountForms({ isProvider, walletBalance, refreshAll, setError, setNotice }: UseWalletAmountFormsParams) {
  const [busy, setBusy] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [depositError, setDepositError] = useState('');
  const [withdrawError, setWithdrawError] = useState('');

  const changeDepositAmount = (amount: string) => {
    setDepositAmount(amount);
    setDepositError('');
  };
  const changeWithdrawAmount = (amount: string) => {
    setWithdrawAmount(amount);
    setWithdrawError('');
  };

  const openDeposit = () => {
    setDepositError('');
    setDepositOpen(true);
  };
  const closeDeposit = () => {
    setDepositError('');
    setDepositOpen(false);
  };
  const openWithdraw = () => {
    setWithdrawError('');
    setWithdrawOpen(true);
  };
  const closeWithdraw = () => {
    setWithdrawError('');
    setWithdrawOpen(false);
  };

  const submitDeposit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setDepositError('');
    setNotice('');
    try {
      const amount = parseAmount(depositAmount);
      if (amount < 1) {
        setDepositError('Số tiền phải lớn hơn hoặc bằng 1.');
        return;
      }
      const walletPath = isProvider ? '/provider/wallet' : '/customer/wallet';
      const result = await walletApi.createDeposit({
        amount,
        returnUrl: `${window.location.origin}${walletPath}`,
        cancelUrl: `${window.location.origin}${walletPath}`,
      });
      const orderCode = result.transaction.gatewayOrderCode || result.transaction.transactionCode;
      if (orderCode) {
        sessionStorage.setItem(PENDING_DEPOSIT_ORDER_CODE_KEY, orderCode);
      }
      setDepositOpen(false);
      setDepositAmount('');
      setNotice('Đã tạo liên kết nạp ví. Bạn sẽ được chuyển sang cổng thanh toán.');
      await refreshAll();
      if (result.checkoutUrl) window.location.assign(result.checkoutUrl);
    } catch (err) {
      setDepositError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submitWithdrawal = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setWithdrawError('');
    setNotice('');
    try {
      const amount = parseAmount(withdrawAmount);
      if (amount < 1) {
        setWithdrawError('Số tiền rút phải lớn hơn hoặc bằng 1.');
        return;
      }
      if (walletBalance !== undefined && amount > walletBalance) {
        setWithdrawError('Số tiền rút không được vượt quá số dư khả dụng.');
        return;
      }
      await walletApi.createWithdrawal({ amount });
      setWithdrawOpen(false);
      setWithdrawAmount('');
      setNotice('Đã gửi yêu cầu rút tiền. Số tiền được chuyển sang trạng thái chờ duyệt.');
      await refreshAll();
    } catch (err) {
      setWithdrawError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return {
    busy,
    depositOpen,
    withdrawOpen,
    depositAmount,
    withdrawAmount,
    depositError,
    withdrawError,
    changeDepositAmount,
    changeWithdrawAmount,
    openDeposit,
    closeDeposit,
    openWithdraw,
    closeWithdraw,
    submitDeposit,
    submitWithdrawal,
  };
}
