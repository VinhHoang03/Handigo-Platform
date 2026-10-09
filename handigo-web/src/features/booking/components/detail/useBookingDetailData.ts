import { useToastFeedback } from "@/components/common/Toast";
import { useCallback, useEffect, useState } from "react";
import { bookingApi } from "@/features/booking/api/booking.api";
import type { Order, OrderQuotation, Payment } from "@/types/booking";
import { createAuthenticatedSocket } from '@/realtime/authenticatedSocket';

/** Tải dữ liệu đơn hàng, chuỗi lịch định kỳ, lịch sử thanh toán và báo giá. */
export const useBookingDetailData = (id: string | undefined) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [recurringOrders, setRecurringOrders] = useState<Order[]>([]);
  const [quotation, setQuotation] = useState<OrderQuotation | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useToastFeedback<string | null>(null, "error");
  const [reassignmentModalOpen, setReassignmentModalOpen] = useState(false);

  const updateOrder = useCallback((latest: Order) => {
    setOrder((previous) => previous?._id === latest._id
      && new Date(previous.updatedAt).getTime() > new Date(latest.updatedAt).getTime()
      ? previous : latest);
  }, []);

  const loadData = useCallback(async () => {
    if (!id) {
      setApiError("Mã đơn hàng không hợp lệ.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let data = await bookingApi.getOrderById(id);
      const shouldReconcilePayos =
        data?.paymentMethod === "bank" &&
        (["unpaid", "partially_paid"].includes(data.paymentStatus) ||
          ["awaiting_payment", "expired"].includes(data.bookingStatus || ""));
      if (shouldReconcilePayos) {
        try {
          const reconciliation = await bookingApi.reconcilePayosPayment(id);
          if (reconciliation.order) data = reconciliation.order;
        } catch (error) {
          console.error("Không thể đối soát thanh toán PayOS:", error);
        }
      }
      if (!data) {
        setApiError("Không tìm thấy thông tin đơn hàng.");
      } else {
        updateOrder(data);
        if (data.reassignment?.status === "awaiting_customer") {
          setReassignmentModalOpen(true);
        }

        if (data.orderType === "recurring") {
          try {
            setRecurringOrders(await bookingApi.getRecurringSeries(id));
          } catch (error) {
            console.error("Không thể tải các buổi trong lịch định kỳ:", error);
            setRecurringOrders([]);
          }
        } else {
          setRecurringOrders([]);
        }

        try {
          const paymentResult = await bookingApi.getPaymentsByOrder(id);
          setPayments(paymentResult.payments);
        } catch (error) {
          console.error("Không thể tải lịch sử thanh toán:", error);
          setPayments([]);
        }

        try {
          const quo = await bookingApi.getQuotation(id);
          if (quo && quo.quotation) {
            setQuotation((previous) => previous?.quotation._id === quo.quotation._id
              && (previous.quotation.revision ?? 0) > (quo.quotation.revision ?? 0) ? previous : quo);
          } else {
            setQuotation(null);
          }
        } catch (e) {
          console.error("Chưa tìm thấy báo giá hoặc có lỗi:", e);
          setQuotation(null);
        }
        setApiError(null);
      }
    } catch (err: unknown) {
      console.error("Lỗi khi tải đơn hàng:", err);
      setApiError("Đã có lỗi xảy ra khi tải thông tin đơn hàng.");
    } finally {
      setLoading(false);
    }
  }, [id, setApiError, updateOrder]);

  useEffect(() => {
    void Promise.resolve().then(loadData);
  }, [loadData]);

  const recurringGroupId = order?.recurringGroupId;
  useEffect(() => {
    if (!id) return;
    let disposed = false;
    let pending = false;
    let queued = false;
    const refreshOrder = async () => {
      if (pending) { queued = true; return; }
      pending = true;
      try {
        do {
          queued = false;
          const latestOrder = await bookingApi.getOrderById(id);
          if (disposed || !latestOrder) return;
          updateOrder(latestOrder);
          if (latestOrder.reassignment?.status === 'awaiting_customer') {
            setReassignmentModalOpen(true);
          }
          const [latest, latestSeries] = await Promise.all([
            latestOrder.inspectionRequired || latestOrder.serviceId.serviceType === 'variable_price'
              ? bookingApi.getQuotation(id)
              : Promise.resolve(null),
            latestOrder.orderType === 'recurring'
              ? bookingApi.getRecurringSeries(id)
              : Promise.resolve([]),
          ]);
          if (!disposed) {
            setQuotation((previous) => previous && latest && previous.quotation._id === latest.quotation._id
              && (previous.quotation.revision ?? 0) > (latest.quotation.revision ?? 0) ? previous : latest);
            setRecurringOrders(latestSeries);
          }
        } while (queued && !disposed);
      } catch (error) {
        console.error('Không thể cập nhật thông tin đơn hàng:', error);
      } finally {
        pending = false;
      }
    };
    const { socket, dispose } = createAuthenticatedSocket();
    const onUpdated = (payload: { orderId?: string }) => {
      if (payload.orderId === id) void refreshOrder();
    };
    const onOrderUpdated = (payload: { orderId?: string; recurringGroupId?: string }) => {
      if (payload.orderId === id || (recurringGroupId && payload.recurringGroupId === recurringGroupId)) {
        void refreshOrder();
      }
    };
    socket.on('quotation:updated', onUpdated);
    socket.on('order:updated', onOrderUpdated);
    socket.on('connect', refreshOrder);
    window.addEventListener('focus', refreshOrder);
    return () => {
      disposed = true;
      socket.off('quotation:updated', onUpdated);
      socket.off('order:updated', onOrderUpdated);
      socket.off('connect', refreshOrder);
      window.removeEventListener('focus', refreshOrder);
      dispose();
    };
  }, [id, recurringGroupId, updateOrder]);

  // Đồng bộ tiến trình khi khách chờ, kể cả sau tải lại trang hoặc bỏ lỡ socket.
  useEffect(() => {
    if (!id || order?.status !== "created") return;
    let disposed = false;
    let pending = false;
    const timer = window.setInterval(async () => {
      if (pending) return;
      pending = true;
      try {
        const updated = await bookingApi.getOrderById(id);
        if (!disposed && updated) updateOrder(updated);
      } catch (error) {
        console.error("Không thể cập nhật tiến trình tìm thợ:", error);
      } finally {
        pending = false;
      }
    }, 5000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [id, order?.status, updateOrder]);

  return {
    order,
    setOrder,
    recurringOrders,
    quotation,
    payments,
    loading,
    apiError,
    loadData,
    reassignmentModalOpen,
    setReassignmentModalOpen,
  };
};
