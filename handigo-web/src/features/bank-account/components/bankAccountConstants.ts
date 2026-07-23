import type { BankAccountPayload, BankAccountStatus } from '../types/bankAccount.types';

export type BankAccountForm = {
  bankMode: 'list' | 'custom';
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountHolderName: string;
  isDefault: boolean;
  status: BankAccountStatus;
};

export const emptyForm: BankAccountForm = {
  bankMode: 'list',
  bankName: '',
  bankCode: '',
  accountNumber: '',
  accountHolderName: '',
  isDefault: false,
  status: 'active',
};

export const vietnamBanks = [
  { code: 'VCB', name: 'Ngân hàng TMCP Ngoại thương Việt Nam', shortName: 'Vietcombank' },
  { code: 'TCB', name: 'Ngân hàng TMCP Kỹ thương Việt Nam', shortName: 'Techcombank' },
  { code: 'BIDV', name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam', shortName: 'BIDV' },
  { code: 'ICB', name: 'Ngân hàng TMCP Công thương Việt Nam', shortName: 'VietinBank' },
  { code: 'VBA', name: 'Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam', shortName: 'Agribank' },
  { code: 'MB', name: 'Ngân hàng TMCP Quân đội', shortName: 'MBBank' },
  { code: 'ACB', name: 'Ngân hàng TMCP Á Châu', shortName: 'ACB' },
  { code: 'VPB', name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng', shortName: 'VPBank' },
  { code: 'TPB', name: 'Ngân hàng TMCP Tiên Phong', shortName: 'TPBank' },
  { code: 'STB', name: 'Ngân hàng TMCP Sài Gòn Thương Tín', shortName: 'Sacombank' },
  { code: 'HDB', name: 'Ngân hàng TMCP Phát triển TP. Hồ Chí Minh', shortName: 'HDBank' },
  { code: 'VIB', name: 'Ngân hàng TMCP Quốc tế Việt Nam', shortName: 'VIB' },
  { code: 'SHB', name: 'Ngân hàng TMCP Sài Gòn - Hà Nội', shortName: 'SHB' },
  { code: 'MSB', name: 'Ngân hàng TMCP Hàng Hải Việt Nam', shortName: 'MSB' },
  { code: 'OCB', name: 'Ngân hàng TMCP Phương Đông', shortName: 'OCB' },
  { code: 'EIB', name: 'Ngân hàng TMCP Xuất Nhập khẩu Việt Nam', shortName: 'Eximbank' },
  { code: 'LPB', name: 'Ngân hàng TMCP Lộc Phát Việt Nam', shortName: 'LPBank' },
  { code: 'SEAB', name: 'Ngân hàng TMCP Đông Nam Á', shortName: 'SeABank' },
  { code: 'NAB', name: 'Ngân hàng TMCP Nam Á', shortName: 'Nam A Bank' },
  { code: 'PVCB', name: 'Ngân hàng TMCP Đại Chúng Việt Nam', shortName: 'PVcomBank' },
  { code: 'SCB', name: 'Ngân hàng TMCP Sài Gòn', shortName: 'SCB' },
  { code: 'ABB', name: 'Ngân hàng TMCP An Bình', shortName: 'ABBANK' },
  { code: 'BAB', name: 'Ngân hàng TMCP Bắc Á', shortName: 'Bac A Bank' },
  { code: 'BVB', name: 'Ngân hàng TMCP Bảo Việt', shortName: 'BaoVietBank' },
  { code: 'KLB', name: 'Ngân hàng TMCP Kiên Long', shortName: 'KienLongBank' },
  { code: 'NCB', name: 'Ngân hàng TMCP Quốc Dân', shortName: 'NCB' },
  { code: 'PGB', name: 'Ngân hàng TMCP Thịnh vượng và Phát triển', shortName: 'PGBank' },
  { code: 'VAB', name: 'Ngân hàng TMCP Việt Á', shortName: 'VietABank' },
  { code: 'VIETBANK', name: 'Ngân hàng TMCP Việt Nam Thương Tín', shortName: 'VietBank' },
  { code: 'SHBVN', name: 'Ngân hàng TNHH MTV Shinhan Việt Nam', shortName: 'ShinhanBank' },
  { code: 'WVN', name: 'Ngân hàng TNHH MTV Woori Việt Nam', shortName: 'Woori' },
  { code: 'HSBC', name: 'Ngân hàng TNHH MTV HSBC Việt Nam', shortName: 'HSBC' },
  { code: 'CIMB', name: 'Ngân hàng TNHH MTV CIMB Việt Nam', shortName: 'CIMB' },
  { code: 'UOB', name: 'Ngân hàng United Overseas - Chi nhánh TP. Hồ Chí Minh', shortName: 'UOB' },
  { code: 'PBVN', name: 'Ngân hàng TNHH MTV Public Việt Nam', shortName: 'PublicBank' },
];

export const getErrorMessage = (error: unknown) => {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error ? error.message : 'Có lỗi xảy ra, vui lòng thử lại.';
};

/** Che số tài khoản: chỉ hiện 4 số cuối, giữ nguyên logic gốc. */
export const maskAccountNumber = (value: string) => {
  if (value.length <= 4) return value;
  return `${'*'.repeat(Math.max(value.length - 4, 0))}${value.slice(-4)}`;
};

export const buildPayload = (form: BankAccountForm): BankAccountPayload => ({
  bankName: form.bankName.trim(),
  bankCode: form.bankCode.trim().toUpperCase(),
  accountNumber: form.accountNumber.trim(),
  accountHolderName: form.accountHolderName.trim().toUpperCase(),
  isDefault: form.isDefault,
  status: form.status,
});
