import { useCallback, useEffect, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { bookingApi } from '@/features/booking/api/booking.api';
import type { Order } from '@/types/booking';
import { providerOrderApi } from '../api/providerOrder.api';
import type { OrderAssignment, QuotationDetail } from '../types/providerOrder.types';

/** State, tải dữ liệu và các thao tác của trang chi tiết đơn dịch vụ (thợ). */
export function useProviderOrderDetail(orderId: string | undefined, navigate: NavigateFunction) {
  const [order, setOrder] = useState<Order | null>(null);
  const [assignment, setAssignment] = useState<OrderAssignment | null>(null);
  const [quotation, setQuotation] = useState<QuotationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelExplanation, setCancelExplanation] = useState('');
  const [cancelError, setCancelError] = useState('');

  const loadData = useCallback(async () => {
    if (!orderId) return;

    setLoading(true);
    try {
      const [orderData, pendingAssignments] = await Promise.all([
        bookingApi.getOrderById(orderId),
        providerOrderApi.getPendingAssignments(),
      ]);

      setOrder(orderData);
      const matchedAssignment = pendingAssignments.find((item) => {
        const relatedOrder =
          typeof item.orderId === 'object' ? item.orderId._id : item.orderId;
        return relatedOrder === orderId;
      });
      setAssignment(matchedAssignment ?? null);

      const isUnconfirmedAppointment =
        ['scheduled', 'recurring'].includes(orderData.orderType) &&
        orderData.bookingStatus !== 'confirmed';
      if (
        orderData.inspectionRequired &&
        orderData.status !== 'created' &&
        !isUnconfirmedAppointment
      ) {
        const quotationData = await providerOrderApi.getQuotation(orderId);
        setQuotation(quotationData);
      } else {
        setQuotation(null);
      }

      setError(null);
    } catch {
      setError('Không thể tải chi tiết đơn dịch vụ.');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void Promise.resolve().then(loadData);
  }, [loadData]);

  const runAction = async (
    action: () => Promise<void>,
    fallbackMessage: string,
    reload = true,
  ) => {
    try {
      setBusy(true);
      setError(null);
      await action();
      if (reload) await loadData();
      return true;
    } catch (err: unknown) {
      const message =
        typeof err === 'object' &&
          err !== null &&
          'response' in err &&
          typeof err.response === 'object' &&
          err.response !== null &&
          'data' in err.response
          ? ((err.response.data as { message?: string }).message ?? fallbackMessage)
          : fallbackMessage;
      setError(message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleAccept = async () => {
    if (!assignment) return;
    await runAction(async () => {
      await providerOrderApi.acceptAssignment(assignment._id);
    }, 'Không thể nhận đơn.');
  };

  const handleReject = async () => {
    if (!assignment) return;
    const reason = window.prompt('Lý do từ chối (tùy chọn):') ?? undefined;
    await runAction(async () => {
      await providerOrderApi.rejectAssignment(assignment._id, reason);
    }, 'Không thể từ chối đơn.');
  };

  const handleStart = async () => {
    if (!order) return;
    await runAction(async () => {
      await providerOrderApi.startOrder(order._id);
    }, 'Không thể bắt đầu đơn.');
  };

  const handleComplete = async (files: File[], completionNote: string) => {
    if (!order) return;
    await runAction(async () => {
      const completionEvidenceImages = await Promise.all(
        files.map((file) => bookingApi.uploadOrderAttachment(file)),
      );
      await providerOrderApi.completeOrder(order._id, {
        completionEvidenceImages,
        completionNote,
      });
    }, 'Không thể hoàn thành đơn.');
  };

  const requestCancelConfirmation = () => {
    const reason = cancelReason.trim();
    const explanation = cancelExplanation.trim();
    if (!reason) {
      setCancelError('Vui lòng chọn lý do hủy đơn.');
      return;
    }
    if (reason === 'Lý do khác' && explanation.length < 10) {
      setCancelError('Vui lòng nhập nội dung giải thích ít nhất 10 ký tự.');
      return;
    }
    if (explanation && explanation.length < 10) {
      setCancelError('Nội dung giải thích phải có ít nhất 10 ký tự.');
      return;
    }
    setCancelError('');
    setCancelConfirmOpen(true);
  };

  const handleCancel = async () => {
    if (!order) return;
    const reason = cancelReason.trim();
    const explanation = cancelExplanation.trim();
    const cancellationReason = explanation ? `${reason}: ${explanation}` : reason;
    const succeeded = await runAction(async () => {
      await providerOrderApi.cancelOrder(order._id, cancellationReason);
    }, 'Không thể hủy đơn.', false);
    if (!succeeded) return;

    setCancelConfirmOpen(false);
    setCancelOpen(false);
    setCancelReason('');
    setCancelExplanation('');
    navigate('/provider/orders', { replace: true });
  };

  const handleCreateQuotation = async (payload: Parameters<typeof providerOrderApi.createQuotation>[1]) => {
    if (!orderId) return;
    await runAction(async () => {
      await providerOrderApi.createQuotation(orderId, payload);
    }, 'Không thể gửi báo giá.');
  };

  return {
    order,
    assignment,
    quotation,
    loading,
    busy,
    error,
    cancelOpen,
    setCancelOpen,
    cancelConfirmOpen,
    setCancelConfirmOpen,
    cancelReason,
    setCancelReason,
    cancelExplanation,
    setCancelExplanation,
    cancelError,
    setCancelError,
    handleAccept,
    handleReject,
    handleStart,
    handleComplete,
    requestCancelConfirmation,
    handleCancel,
    handleCreateQuotation,
  };
}
