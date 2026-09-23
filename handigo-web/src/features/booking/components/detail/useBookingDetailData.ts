import { useCallback, useEffect, useState } from "react";
import { bookingApi } from "@/features/booking/api/booking.api";
import type { Order, OrderQuotation, Payment } from "@/types/booking";

/** Tải dữ liệu đơn hàng, chuỗi lịch định kỳ, lịch sử thanh toán và báo giá. */
export const useBookingDetailData = (id: string | undefined) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [recurringOrders, setRecurringOrders] = useState<Order[]>([]);
  const [quotation, setQuotation] = useState<OrderQuotation | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [reassignmentModalOpen, setReassignmentModalOpen] = useState(false);

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
        setOrder(data);
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
            setQuotation(quo);
          } else {
            setQuotation(null);
          }
        } catch (e) {
          console.error("No quotation found yet or error:", e);
          setQuotation(null);
        }
        setApiError(null);
      }
    } catch (err: unknown) {
      console.error("Error fetching order:", err);
      setApiError("Đã có lỗi xảy ra khi tải thông tin đơn hàng.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void Promise.resolve().then(loadData);
  }, [loadData]);

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
