import type {
  WalletTransaction,
  WalletTransactionType,
  WithdrawalRequest,
  WithdrawalStatus,
} from '../types/wallet.types';
import type { StatusTone } from '@/utils/statusTone';

/**
 * Định dạng dùng riêng cho trang Ví (số tiền có ký hiệu ₫, ngày giờ ngắn).
 * Giữ nguyên format gốc của trang thay vì đổi sang `formatCurrency` dùng chung,
 * vì hai hàm cho ra chuỗi khác nhau (₫ có cách với số vs "đ" liền số) và trang
 * này hiển thị số dư tiền — không đổi định dạng hiển thị khi refactor UI.
 */
export const money = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

export const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

export const transactionLabels: Record<WalletTransactionType, string> = {
  deposit: 'Nạp ví',
  payment: 'Thanh toán',
  refund: 'Hoàn tiền',
  provider_earning: 'Thu nhập dịch vụ',
  platform_fee: 'Phí nền tảng',
  withdraw: 'Rút tiền',
  withdraw_rejected: 'Hoàn rút tiền',
  adjustment: 'Điều chỉnh',
};

export const withdrawalLabels: Record<WithdrawalStatus, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};

export const getErrorMessage = (error: unknown): string => {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error ? error.message : 'Có lỗi xảy ra, vui lòng thử lại.';
};

/** Trạng thái giao dịch/yêu cầu rút tiền quy về tông ngữ nghĩa dùng chung. */
export const getStatusTone = (status: string): StatusTone => {
  if (status === 'success' || status === 'approved') return 'success';
  if (status === 'failed' || status === 'rejected' || status === 'cancelled') return 'error';
  return 'warning';
};

export const transactionStatusLabel = (status: WalletTransaction['status']): string => {
  if (status === 'success') return 'Thành công';
  if (status === 'failed') return 'Thất bại';
  if (status === 'cancelled') return 'Đã hủy';
  return 'Đang xử lý';
};

export const bankText = (withdrawal: WithdrawalRequest): string => {
  const bank = withdrawal.bankAccountId;
  if (!bank || typeof bank === 'string') return 'Tài khoản nhận mặc định';
  return `${bank.bankName} - ${bank.accountNumber}`;
};

export const normalizeAmountInput = (value: string): string => value.replace(/\D/g, '');

export const parseAmount = (value: string): number => {
  const normalized = normalizeAmountInput(value);
  return normalized ? Number(normalized) : 0;
};
