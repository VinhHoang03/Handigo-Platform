export type BankAccountStatus = 'active' | 'inactive';

export interface BankAccount {
  _id: string;
  userId?: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountHolderName: string;
  isDefault: boolean;
  status: BankAccountStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface BankAccountPayload {
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountHolderName: string;
  isDefault?: boolean;
  status?: BankAccountStatus;
}
