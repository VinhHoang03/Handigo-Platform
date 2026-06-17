export interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  isActive: boolean;
}

export interface Service {
  _id: string;
  categoryId: string;
  name: string;
  slug: string;
  description?: string;
  serviceType: 'fixed_price' | 'variable_price';
  fixedPrice?: number;
  depositAmount?: number;
  image?: string;
  isActive: boolean;
}

export interface ServiceOption {
  _id: string;
  serviceId: string;
  name: string;
  description?: string;
  optionType: 'inspection' | 'cleaning' | 'installation' | 'repair' | 'other';
  fixedPrice: number;
  isFixedPrice: boolean;
  isActive: boolean;
}

export interface Address {
  _id: string;
  userId: string;
  label: string;
  detailAddress: string;
  province: string;
  district: string;
  ward: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
}

export interface OrderPricing {
  bookingAmount: number;
  platformCommissionRate: number;
  platformCommissionAmount: number;
  providerEarningAmount: number;
  promotionDiscountAmount: number;
  voucherDiscountAmount: number;
  totalPaidAmount: number;
}

export interface Order {
  _id: string;
  orderCode: string;
  customerId: string;
  problemDescription?: string;
  customerAttachments?: string[];
  providerId?: {
    _id: string;
    name: string;
    completedOrders?: number;
    avatar?: string;
  } | null;
  serviceId: Service;
  selectedOptionIds: string[];
  addressId: Address;
  orderType: 'normal' | 'urgent' | 'scheduled' | 'recurring';
  scheduledAt?: string | null;
  status: 'created' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  paymentMethod: 'wallet' | 'bank' | 'cash';
  paymentStatus: 'unpaid' | 'partially_paid' | 'paid' | 'refunded';
  pricing: OrderPricing;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface BookingState {
  categoryId?: string;
  serviceId?: string;
  selectedOptionIds: string[];
  addressId?: string;
  orderType: 'normal' | 'urgent' | 'scheduled' | 'recurring';
  scheduledAt?: string;
  problemDescription?: string;
  customerAttachments: string[];
  paymentMethod: 'wallet' | 'bank' | 'cash';

  // Helpers
  setCategoryId: (id: string) => void;
  setServiceId: (id: string) => void;
  toggleOption: (id: string) => void;
  setAddressId: (id: string) => void;
  setOrderType: (type: BookingState['orderType']) => void;
  setScheduledAt: (date: string) => void;
  setProblemDescription: (desc: string) => void;
  setCustomerAttachments: (attachments: string[]) => void;
  setPaymentMethod: (method: BookingState['paymentMethod']) => void;
  reset: () => void;
}
