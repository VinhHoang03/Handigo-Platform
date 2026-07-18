import type { Order, Pagination } from '@/types/booking';

export interface OrderAssignment {
  _id: string;
  orderId: Order | string;
  providerId: string;
  assignmentType?: 'dispatch' | 'appointment';
  status: 'pending' | 'accepted' | 'rejected' | 'timeout' | 'cancelled';
  assignedAt: string;
  responseDeadline: string;
  rejectReason?: string | null;
  respondedAt?: string | null;
}

export interface QuotationItem {
  _id: string;
  quotationId: string;
  title: string;
  description?: string | null;
  itemType: 'labor' | 'material' | 'replacement_part' | 'other';
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  note?: string | null;
}

export interface RepairQuotation {
  _id: string;
  quotationCode: string;
  orderId: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';
  inspectionNote?: string | null;
  recommendation?: string | null;
  subtotalAmount: number;
  discountAmount: number;
  finalAmount: number;
  customerConfirmed: boolean;
  providerConfirmed: boolean;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  createdAt: string;
}

export interface QuotationDetail {
  quotation: RepairQuotation;
  items: QuotationItem[];
}

export interface CreateQuotationPayload {
  inspectionNote?: string;
  recommendation?: string;
  discountAmount?: number;
  items: Array<{
    title: string;
    description?: string;
    itemType: QuotationItem['itemType'];
    quantity: number;
    unitPrice: number;
    note?: string;
  }>;
}

export interface ProviderOrdersResult {
  items: Order[];
  pagination: Pagination;
}
