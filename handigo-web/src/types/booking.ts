export interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  image?: string;
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
  description?: string | null;
  optionType: 'room_count' | 'area_size' | 'package' | 'add_on' | 'other' | 'inspection' | 'cleaning' | 'installation' | 'repair';
  price: number;
  fixedPrice?: number;
  isFixedPrice?: boolean;
  isActive: boolean;
}

export interface Payment {
  _id: string;
  orderId: string;
  amount: number;
  method: 'payos' | 'vnpay' | 'cash' | 'wallet' | 'bank';
  paymentType: 'full' | 'remaining' | 'inspection_deposit';
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  transactionCode?: string | null;
}

export interface CreatePaymentResult {
  payment: Payment;
  method?: 'CASH';
  amount?: number;
  checkoutUrl?: string;
  qrCode?: string;
  paymentType: Payment['paymentType'];
}

export interface Address {
  _id: string;
  userId: string;
  recipientName?: string;
  recipientPhone?: string;
  label?: string;
  fullAddress?: string;
  detailAddress?: string;
  province: string;
  district?: string;
  ward: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
  note?: string;
}

export interface OrderCustomer {
  _id: string;
  fullName: string;
  avatar?: string | null;
  phone?: string;
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

export interface OrderDiscountSnapshot {
  name?: string;
  code?: string;
  discountType: 'fixed' | 'percentage';
  discountValue: number;
  discountAmount: number;
}

export interface Order {
  _id: string;
  orderCode: string;
  customerId: string | OrderCustomer;
  problemDescription?: string;
  customerAttachments?: string[];
  completionEvidenceImages?: string[];
  completionNote?: string | null;
  providerId?: {
    _id: string;
    userId?: {
      _id: string;
      fullName: string;
      phone?: string;
      avatar?: string | null;
    };
    name?: string;
    completedOrders?: number;
    totalCompletedOrders?: number;
    avatar?: string | null;
    serviceArea?: { province?: string; ward?: string };
    workingAreas?: string[];
    averageRating?: number;
    totalFeedbacks?: number;
    experienceYears?: number;
    verified?: boolean;
  } | null;
  serviceId: Service;
  selectedOptionIds: string[];
  selectedOptionsSnapshot?: Array<{
    optionId: string;
    name: string;
    optionType: string;
    price: number;
  }>;
  addressId: Address;
  orderType: 'normal' | 'urgent' | 'scheduled' | 'recurring';
  scheduledAt?: string | null;
  status: 'created' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  paymentMethod: 'wallet' | 'bank' | 'cash';
  paymentStatus: 'unpaid' | 'partially_paid' | 'paid' | 'refunded';
  inspectionRequired?: boolean;
  depositAmount?: number;
  hasAdditionalQuotation?: boolean;
  pricing: OrderPricing;
  promotionSnapshot?: OrderDiscountSnapshot | null;
  voucherSnapshot?: OrderDiscountSnapshot | null;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface QuotationItem {
  _id: string;
  quotationId?: string;
  title: string;
  description?: string | null;
  itemType?: 'labor' | 'material' | 'replacement_part' | 'other';
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  note?: string | null;
}

export interface OrderQuotation {
  quotation: {
    _id: string;
    quotationCode?: string;
    status: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';
    subtotalAmount?: number;
    discountAmount?: number;
    finalAmount: number;
    inspectionNote?: string | null;
    recommendation?: string | null;
    rejectionReason?: string | null;
    approvedAt?: string | null;
    rejectedAt?: string | null;
    createdAt?: string;
  };
  items: QuotationItem[];
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
  selectService: (categoryId: string, serviceId: string) => void;
  toggleOption: (id: string) => void;
  setAddressId: (id?: string) => void;
  setOrderType: (type: BookingState['orderType']) => void;
  setScheduledAt: (date: string) => void;
  setProblemDescription: (desc: string) => void;
  setCustomerAttachments: (attachments: string[]) => void;
  setPaymentMethod: (method: BookingState['paymentMethod']) => void;
  reset: () => void;
}
