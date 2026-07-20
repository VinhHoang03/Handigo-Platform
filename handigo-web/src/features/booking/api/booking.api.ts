import api from "@/api/client";
import { geocodeSavedAddress } from "@/features/customer/utils/googlePlacesAutocomplete";
import type {
  Address,
  CreatePaymentResult,
  Order,
  OrderQuotation,
  Pagination,
  Payment,
} from "@/types/booking";
import type { WalletTransaction } from "@/features/wallet/types/wallet.types";

export interface OrderPaymentsResult {
  payments: Payment[];
  platformFeeTransaction: WalletTransaction | null;
}

export interface CreateOrderPayload {
  serviceId: string;
  selectedOptionIds?: string[];
  addressId: string;
  preferredProviderId?: string;
  orderType?: "normal" | "urgent" | "scheduled" | "recurring";
  scheduledAt?: string;
  recurrenceUnit?: "weekly" | "monthly";
  recurrenceCount?: 1 | 2 | 3 | 4 | 8 | 12;
  problemDescription?: string;
  paymentMethod: "wallet" | "bank" | "cash";
  customerAttachments?: string[];
  voucherCode?: string;
}

export interface CreateAddressPayload {
  recipientName: string;
  recipientPhone: string;
  fullAddress: string;
  province: string;
  ward: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  isDefault?: boolean;
  note?: string | null;
}

interface ReverseGeocodedAddress {
  fullAddress: string;
  province: string;
  ward: string;
  latitude: number;
  longitude: number;
  placeId?: string;
  attribution: string;
}

export const bookingApi = {
  getAddresses: async () => {
    const response = await api.get<{ success: boolean; data: Address[] }>(
      "/addresses",
    );
    const addresses = response.data.data;
    const normalized = await Promise.all(
      addresses.map(async (address) => {
        if (
          Number.isFinite(address.latitude) &&
          Number.isFinite(address.longitude)
        ) {
          return address;
        }

        try {
          const coordinates = await geocodeSavedAddress(
            address.fullAddress || "",
          );
          await api.put(`/addresses/${address._id}`, coordinates);
          return { ...address, ...coordinates };
        } catch {
          return address;
        }
      }),
    );
    return normalized;
  },

  createAddress: async (payload: CreateAddressPayload) => {
    const response = await api.post<{ success: boolean; data: Address }>(
      "/addresses",
      payload,
    );
    return response.data.data;
  },

  reverseGeocode: async (latitude: number, longitude: number) => {
    const response = await api.get<{
      success: boolean;
      data: ReverseGeocodedAddress;
    }>("/locations/reverse-geocode", {
      params: { latitude, longitude },
    });
    return response.data.data;
  },

  uploadOrderAttachment: async (file: File, purpose?: 'order_problem') => {
    const formData = new FormData();
    if (purpose) formData.append('purpose', purpose);
    formData.append("image", file);
    const response = await api.post<{
      success: boolean;
      data: { url: string };
    }>("/orders/attachments", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data.data.url;
  },

  createOrder: async (payload: CreateOrderPayload) => {
    const response = await api.post<{ success: boolean; data: Order }>(
      "/orders",
      payload,
    );
    return response.data.data;
  },

  createPayment: async (payload: {
    orderId: string;
    method: "PAYOS" | "CASH" | "WALLET";
    paymentType?: "INSPECTION_DEPOSIT" | "FULL" | "REMAINING";
    returnUrl?: string;
    cancelUrl?: string;
  }) => {
    const response = await api.post<{
      success: boolean;
      data: CreatePaymentResult;
    }>("/payments/create", payload);
    return response.data.data;
  },

  getPaymentById: async (paymentId: string) => {
    const response = await api.get<{ success: boolean; data: Payment }>(
      `/payments/${paymentId}`,
    );
    return response.data.data;
  },

  getPaymentsByOrder: async (orderId: string) => {
    const response = await api.get<{
      success: boolean;
      data: OrderPaymentsResult;
    }>(
      `/payments/order/${orderId}`,
    );

    if (!response.data.data || !Array.isArray(response.data.data.payments)) {
      throw new Error("Dữ liệu lịch sử thanh toán không hợp lệ.");
    }

    return response.data.data;
  },

  getMyOrders: async (
    page = 1,
    limit = 10,
    status?: string,
    search?: string,
  ) => {
    let url = `/orders?page=${page}&limit=${limit}`;
    if (status && status !== "Tất cả") url += `&status=${status}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    const response = await api.get<{
      success: boolean;
      data: { items: Order[]; pagination: Pagination };
    }>(url);
    return response.data.data;
  },

  getOrderById: async (orderId: string) => {
    const response = await api.get<{ success: boolean; data: Order }>(
      `/orders/${orderId}`,
    );
    return response.data.data;
  },

  getRecurringSeries: async (orderId: string) => {
    const response = await api.get<{
      success: boolean;
      data: { items: Order[] };
    }>(`/orders/${orderId}/series`);
    return response.data.data.items;
  },

  selectAppointmentProvider: async (orderId: string, providerId: string) => {
    const response = await api.patch<{ success: boolean; data: Order }>(
      `/orders/${orderId}/appointment-provider`,
      { providerId },
    );
    return response.data.data;
  },

  cancelOrder: async (orderId: string, reason: string) => {
    const response = await api.patch<{ success: boolean; data: Order }>(
      `/orders/${orderId}/cancel`,
      { reason },
    );
    return response.data.data;
  },

  discardUnpaidOrder: async (orderId: string) => {
    await api.delete(`/orders/${orderId}/unpaid`);
  },

  respondToReassignment: async (
    orderId: string,
    decision: "accept" | "decline",
  ) => {
    const response = await api.patch<{ success: boolean; data: Order }>(
      `/orders/${orderId}/reassignment-response`,
      { decision },
    );
    return response.data.data;
  },

  cancelRecurringSeries: async (orderId: string, reason: string) => {
    const response = await api.patch<{
      success: boolean;
      data: { cancelledCount: number; orders: Order[] };
    }>(`/orders/${orderId}/cancel-series`, { reason });
    return response.data.data;
  },

  getQuotation: async (orderId: string) => {
    const response = await api.get<{
      success: boolean;
      data: OrderQuotation | null;
    }>(`/orders/${orderId}/quotation`);
    return response.data.data;
  },

  confirmQuotation: async (quotationId: string) => {
    const response = await api.post<{ success: boolean; data: OrderQuotation }>(
      `/orders/quotations/${quotationId}/confirm`,
    );
    return response.data.data;
  },

  rejectQuotation: async (quotationId: string, reason?: string) => {
    const response = await api.post<{ success: boolean; data: OrderQuotation }>(
      `/orders/quotations/${quotationId}/reject`,
      { rejectionReason: reason },
    );
    return response.data.data;
  },
};
