import { useToastFeedback } from "@/components/common/Toast";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { bookingApi } from '@/features/booking/api/booking.api';
import type { Order } from '@/types/booking';
import { providerOrderApi } from '../api/providerOrder.api';
import type { OrderAssignment, QuotationDetail } from '../types/providerOrder.types';
import { useToast } from '@/components/common/Toast';
import { getCurrentCoordinates } from './useProviderAvailability';
import { providerDashboardApi } from '../api/providerDashboard.api';
import { getProviderCancellationReasons } from '../utils/providerOrder.utils';

/** State, tải dữ liệu và các thao tác của trang chi tiết đơn dịch vụ (thợ). */
export function useProviderOrderDetail(orderId: string | undefined, navigate: NavigateFunction) {
  const { addToast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [assignment, setAssignment] = useState<OrderAssignment | null>(null);
  const [quotation, setQuotation] = useState<QuotationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useToastFeedback<string | null>(null, "error");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelExplanation, setCancelExplanation] = useState('');
  const [cancelError, setCancelError] = useToastFeedback<string>('', "error");
  const requestRevision = useRef(0);
  const renderScope = useMemo(() => Symbol(orderId), [orderId]);
  const scope = useRef<symbol | null>(renderScope);
  const actionPending = useRef(false);
  const currentOrder = order?._id === orderId ? order : null;

  const loadData = useCallback(async (showLoading = true) => {
    if (!orderId) return;
    const context = renderScope;
    if (scope.current !== context) return;
    const revision = ++requestRevision.current;
    const isCurrent = () => scope.current === context && revision === requestRevision.current;

    if (showLoading) setLoading(true);
    try {
      const [orderData, pendingAssignments] = await Promise.all([
        bookingApi.getOrderById(orderId),
        providerOrderApi.getPendingAssignments(),
      ]);

      if (!isCurrent()) return;
      const matchedAssignment = pendingAssignments.find((item) => {
        const relatedOrder =
          typeof item.orderId === 'object' ? item.orderId._id : item.orderId;
        return relatedOrder === orderId;
      });
      let nextQuotation: QuotationDetail | null = null;

      const isUnconfirmedAppointment =
        ['scheduled', 'recurring'].includes(orderData.orderType) &&
        orderData.bookingStatus !== 'confirmed';
      if (
        (orderData.inspectionRequired || orderData.serviceId.serviceType === 'variable_price') &&
        orderData.status !== 'created' &&
        !isUnconfirmedAppointment
      ) {
        const quotationData = await providerOrderApi.getQuotation(orderId);
        nextQuotation = quotationData;
      }
      if (!isCurrent()) return;
      setOrder(orderData);
      setAssignment(matchedAssignment ?? null);
      setQuotation(nextQuotation);
      setError(null);
    } catch {
      if (!isCurrent()) return;
      setError('Không thể tải chi tiết đơn dịch vụ.');
      if (showLoading) setOrder(null);
      else throw new Error('Không thể tải dữ liệu mới nhất. Vui lòng tải lại đơn hàng.');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [orderId, setError, renderScope]);

  useEffect(() => {
    const context = renderScope;
    scope.current = context;
    requestRevision.current++;
    actionPending.current = false;
    let active = true;
    void Promise.resolve().then(() => { if (active) return loadData(); });
    return () => {
      active = false;
      if (scope.current === context) scope.current = null;
    };
  }, [loadData, renderScope]);

  // Cập nhật thanh toán trong lúc thợ chờ khách trả tiền, giữ nguyên ảnh và ghi chú đang nhập.
  useEffect(() => {
    const waitingForPayment = currentOrder?.inspectionRequired
      ? currentOrder.status === 'completed' && currentOrder.paymentStatus === 'partially_paid'
      : currentOrder?.status === 'in_progress' && currentOrder.paymentStatus === 'unpaid';
    if (!orderId || busy || !waitingForPayment) return;
    let active = true;
    let pending = false;
    const refreshPayment = async () => {
      if (pending || document.visibilityState === 'hidden') return;
      pending = true;
      try {
        const latest = await bookingApi.getOrderById(orderId);
        if (active && latest._id === orderId) setOrder((current) => current?._id !== orderId ||
          new Date(current.updatedAt).getTime() > new Date(latest.updatedAt).getTime() ? current : latest);
      } catch (error) {
        console.error('Không thể cập nhật trạng thái thanh toán của đơn hàng.', error);
      } finally {
        pending = false;
      }
    };
    const timer = window.setInterval(() => { void refreshPayment(); }, 5000);
    window.addEventListener('focus', refreshPayment);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshPayment);
    };
  }, [orderId, busy, currentOrder?.inspectionRequired, currentOrder?.status, currentOrder?.paymentStatus]);

  const runAction = async (
    action: (isCurrent: () => boolean) => Promise<void>,
    fallbackMessage: string,
    reload = true,
    successMessage?: string,
  ) => {
    const context = renderScope;
    const isCurrent = () => scope.current === context;
    if (!isCurrent() || !currentOrder || loading || actionPending.current) return false;
    actionPending.current = true;
    try {
      setBusy(true);
      setError(null);
      await action(isCurrent);
      if (!isCurrent()) return false;
      if (successMessage) addToast(successMessage, "success");
      if (reload) await loadData(false);
      return isCurrent();
    } catch (err: unknown) {
      if (!isCurrent()) return false;
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
      if (scope.current === context) actionPending.current = false;
      if (isCurrent()) setBusy(false);
    }
  };

  const handleAccept = async () => {
    if (!assignment) return;
    await runAction(async () => {
      await providerOrderApi.acceptAssignment(assignment._id);
    }, 'Không thể nhận đơn.', true, 'Đã nhận đơn dịch vụ.');
  };

  const handleReject = async () => {
    if (!assignment) return;
    const reason = window.prompt('Lý do từ chối (tùy chọn):') ?? undefined;
    await runAction(async () => {
      await providerOrderApi.rejectAssignment(assignment._id, reason);
    }, 'Không thể từ chối đơn.', true, 'Đã từ chối đơn dịch vụ.');
  };

  const handleStart = async () => {
    if (!order) return;
    await runAction(async () => {
      await providerOrderApi.startOrder(order._id);
    }, 'Không thể bắt đầu đơn.', true, 'Đã bắt đầu thực hiện đơn dịch vụ.');
  };

  const handleArrival = async () => {
    if (!order) return;
    await runAction(async () => {
      const coordinates = await getCurrentCoordinates().catch(() => {
        throw new Error('Vui lòng bật GPS và cấp quyền vị trí để xác nhận đã đến nơi.');
      });
      await providerDashboardApi.updateCurrentLocation(coordinates.latitude, coordinates.longitude);
      await providerOrderApi.arrive(order._id);
    }, 'Không thể xác nhận đã đến nơi. Vui lòng kiểm tra quyền vị trí và thử lại.', true, 'Đã xác nhận đến nơi và thông báo cho khách.');
  };

  const checkNoShow = async () => {
    if (!order) return false;
    return runAction(() => providerOrderApi.checkNoShow(order._id), 'Chưa thể báo khách không có mặt.', false);
  };

  const handleNoShow = async (description: string, arrivalFiles: File[], contactFiles: File[]) => {
    if (!order) return false;
    return runAction(async () => {
      const { arrival, contact } = await providerOrderApi.uploadNoShowEvidenceBatch(order._id, arrivalFiles, contactFiles);
      const coordinates = await getCurrentCoordinates().catch(() => null);
      if (coordinates) await providerDashboardApi.updateCurrentLocation(coordinates.latitude, coordinates.longitude).catch(() => undefined);
      const result = await providerOrderApi.reportNoShow(order._id, {
        description, arrivalEvidenceIds: arrival.map((item) => item.id), contactEvidenceIds: contact.map((item) => item.id), contactedCustomer: true,
      });
      addToast(result.customerNoShow?.status === 'approved' ? 'Hệ thống đã xác minh, hủy đơn và cộng hỗ trợ 5.000đ vào ví.'
        : 'Đã gửi báo cáo. Bằng chứng cần được quản trị viên xem xét thêm.', 'success');
    }, 'Không thể gửi báo cáo.', true);
  };

  const handleComplete = async (files: File[], completionNote: string) => {
    if (!order) return;
    await runAction(async (isCurrent) => {
      const completionEvidenceImages = await Promise.all(
        files.map((file) => bookingApi.uploadOrderAttachment(file)),
      );
      if (!isCurrent()) return;
      await providerOrderApi.completeOrder(order._id, {
        completionEvidenceImages,
        completionNote,
        ...(quotation ? {
          expectedQuotationId: quotation.quotation._id,
          expectedQuotationRevision: quotation.quotation.revision ?? 0,
        } : {}),
      });
    }, 'Không thể hoàn thành đơn.', true, 'Đã hoàn thành đơn dịch vụ.');
  };

  const handleConfirmQuotationPayment = async (quotationId: string, expectedRevision: number) => {
    if (!order || busy) return false;
    return runAction(async () => {
      await providerOrderApi.confirmQuotationPayment(order._id, quotationId, expectedRevision);
    }, 'Không thể xác nhận thanh toán báo giá.', true, 'Đã xác nhận nhận đủ tiền sửa chữa theo báo giá.');
  };

  const handleConfirmCashPayment = async (expectedAmount: number) => {
    if (!order || busy) return false;
    return runAction(async () => {
      await providerOrderApi.confirmCashPayment(order._id, expectedAmount);
    }, 'Không thể xác nhận thanh toán tiền mặt.', true, 'Đã xác nhận nhận đủ tiền mặt từ khách.');
  };

  const requestCancelConfirmation = () => {
    if (!order || order.currentQuotationId || quotation || order.status !== 'accepted') return;
    const reason = cancelReason.trim();
    const explanation = cancelExplanation.trim();
    if (!getProviderCancellationReasons(order).includes(reason)) {
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
    if (!order || order.currentQuotationId || quotation || order.status !== 'accepted'
      || !getProviderCancellationReasons(order).includes(cancelReason.trim())) return;
    const reason = cancelReason.trim();
    const explanation = cancelExplanation.trim();
    const cancellationReason = explanation ? `${reason}: ${explanation}` : reason;
    const succeeded = await runAction(async () => {
      await providerOrderApi.cancelOrder(order._id, cancellationReason);
    }, 'Không thể hủy đơn.', false, 'Đã hủy nhận đơn dịch vụ.');
    if (!succeeded) return;

    setCancelConfirmOpen(false);
    setCancelOpen(false);
    setCancelReason('');
    setCancelExplanation('');
    navigate('/provider/orders', { replace: true });
  };

  const handleCreateQuotation = async (payload: Parameters<typeof providerOrderApi.createQuotation>[1]) => {
    if (!orderId || !currentOrder) return false;
    const succeeded = await runAction(async () => {
      if (quotation) {
        await providerOrderApi.updateQuotation(orderId, quotation.quotation._id, quotation.quotation.revision ?? 0, payload);
      } else {
        await providerOrderApi.createQuotation(orderId, payload);
      }
    }, 'Không thể lưu báo giá.');
    if (succeeded) addToast('Đã lưu báo giá.', 'success');
    return succeeded;
  };

  return {
    order: currentOrder,
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
    handleArrival,
    checkNoShow,
    handleNoShow,
    handleComplete,
    handleConfirmQuotationPayment,
    handleConfirmCashPayment,
    requestCancelConfirmation,
    handleCancel,
    handleCreateQuotation,
    reload: loadData,
  };
}
