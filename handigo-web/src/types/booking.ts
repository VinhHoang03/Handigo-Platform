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
  serviceType: "fixed_price" | "variable_price";
  fixedPrice?: number;
  depositAmount?: number;
  image?: string;
  requiresOptionSelection: boolean;
  isActive: boolean;
}

export interface ServiceOption {
  _id: string;
  serviceId: string;
  name: string;
  description?: string | null;
  image?: string | null;
  optionType:
    | "room_count"
    | "area_size"
    | "package"
    | "add_on"
    | "other"
    | "inspection"
    | "cleaning"
    | "installation"
    | "repair";
  price: number;
  fixedPrice?: number;
  isFixedPrice?: boolean;
  selectionGroup?: string | null;
  selectionMode?: "single" | "multiple";
  sortOrder?: number;
  isActive: boolean;
}

export interface Payment {
  _id: string;
  orderId: string;
  amount: number;
  method: "payos" | "vnpay" | "cash" | "wallet" | "bank";
  paymentType: "full" | "remaining" | "inspection_deposit";
  status: "pending" | "paid" | "failed" | "refunded";
  transactionCode?: string | null;
}

export interface CreatePaymentResult {
  payment: Payment;
  method?: "CASH";
  amount?: number;
  checkoutUrl?: string;
  qrCode?: string;
  paymentType: Payment["paymentType"];
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
  placeId?: string;
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
  discountType: "fixed" | "percentage";
  discountValue: number;
  discountAmount: number;
}

export interface OrderReassignment {
  status:
    | "awaiting_customer"
    | "matching"
    | "matched"
    | "declined"
    | "expired"
    | "failed";
  requestedByProviderId: string;
  previousProviderIds: string[];
  reason: string;
  requestedAt: string;
  expiresAt: string;
  respondedAt?: string | null;
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
  orderType: "normal" | "urgent" | "scheduled" | "recurring";
  scheduledAt?: string | null;
  bookingStatus?:
    | "not_required"
    | "awaiting_provider"
    | "awaiting_payment"
    | "reserved"
    | "confirmed"
    | "rejected"
    | "expired";
  paymentDueAt?: string | null;
  matchingStartedAt?: string | null;
  matchingExpiresAt?: string | null;
  recurringGroupId?: string | null;
  recurrenceUnit?: "weekly" | "monthly" | null;
  occurrenceNumber?: number | null;
  totalOccurrences?: number | null;
  status: "created" | "accepted" | "in_progress" | "completed" | "cancelled";
  paymentMethod: "wallet" | "bank" | "cash";
  paymentStatus: "unpaid" | "partially_paid" | "paid" | "refunded";
  depositPaidAt?: string | null;
  matchingStartedAt?: string | null;
  inspectionRequired?: boolean;
  depositAmount?: number;
  hasAdditionalQuotation?: boolean;
  quotationFinalAmount?: number;
  pricing: OrderPricing;
  promotionSnapshot?: OrderDiscountSnapshot | null;
  voucherSnapshot?: OrderDiscountSnapshot | null;
  cancellation?: {
    cancelledBy?: string;
    cancelledByRole: "customer" | "provider" | "admin";
    reason: string;
    cancelledAt: string;
    refundPolicy?: CancellationRefundPolicy | null;
  } | null;
  reassignment?: OrderReassignment | null;
  createdAt: string;
  updatedAt: string;
}

export interface CancellationRefundPolicy {
  policyVersion: string;
  refundRate: number;
  paidAmount: number;
  refundAmount: number;
  cancellationFee: number;
  providerCompensation: number;
  platformRetainedAmount: number;
  hoursBeforeStart: number | null;
  policyReason: string;
}

export interface CancellationPreviewItem extends CancellationRefundPolicy {
  orderId: string;
  orderCode: string;
  scheduledAt: string | null;
  canCancel: boolean;
}

export interface CancellationPreview {
  scope: "single" | "series";
  orderCount: number;
  policyVersion: string;
  paidAmount: number;
  refundAmount: number;
  cancellationFee: number;
  providerCompensation: number;
  platformRetainedAmount: number;
  canCancel: boolean;
  items: CancellationPreviewItem[];
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
  itemType?: "labor" | "material" | "replacement_part" | "other";
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  note?: string | null;
}

export interface OrderQuotation {
  quotation: {
    _id: string;
    quotationCode?: string;
    status: "pending" | "approved" | "rejected" | "expired" | "cancelled";
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
  preferredProviderId?: string;
  preferredProviderName?: string;
  orderType: "normal" | "urgent" | "scheduled" | "recurring";
  scheduledAt?: string;
  recurrenceUnit?: "weekly" | "monthly";
  recurrenceCount?: 1 | 2 | 3 | 4 | 8 | 12;
  problemDescription?: string;
  customerAttachments: string[];
  paymentMethod: "wallet" | "bank" | "cash";

  // Helpers
  setCategoryId: (id: string) => void;
  setServiceId: (id: string) => void;
  selectService: (
    categoryId: string,
    serviceId: string,
    selectedOptionIds?: string[],
  ) => void;
  toggleOption: (option: ServiceOption, options: ServiceOption[]) => void;
  setAddressId: (id: string) => void;
  setPreferredProviderId: (id?: string, name?: string) => void;
  setOrderType: (type: BookingState["orderType"]) => void;
  setScheduledAt: (date: string) => void;
  setRecurrenceUnit: (unit: "weekly" | "monthly") => void;
  setRecurrenceCount: (count: 1 | 2 | 3 | 4 | 8 | 12) => void;
  setProblemDescription: (desc: string) => void;
  setCustomerAttachments: (attachments: string[]) => void;
  setPaymentMethod: (method: BookingState["paymentMethod"]) => void;
  reset: () => void;
}
