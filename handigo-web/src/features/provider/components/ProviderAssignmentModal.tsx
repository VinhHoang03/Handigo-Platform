import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/common/Modal';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { createAuthenticatedSocket } from '@/realtime/authenticatedSocket';
import { providerOrderApi } from '../api/providerOrder.api';
import type { OrderAssignment } from '../types/providerOrder.types';
import {
  formatDateTime,
  formatMoney,
  getAssignmentCountdown,
  getCustomer,
  getOrderFromAssignment,
  shortAddress,
} from '../utils/providerOrder.utils';

interface AssignmentRealtimePayload {
  assignment?: OrderAssignment | null;
  assignmentId?: string;
}

export function ProviderAssignmentModal() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [assignment, setAssignment] = useState<OrderAssignment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState('');

  const order = assignment ? getOrderFromAssignment(assignment) : null;
  const customer = order ? getCustomer(order) : null;
  const isExpired = countdown === 'Hết hạn';
  const isAppointment = assignment?.assignmentType === 'appointment';
  const isDirectRequest = assignment?.assignmentType === 'direct_request';
  const enabled = isAuthenticated && user?.role === 'PROVIDER' && Boolean(token);

  const loadPendingAssignment = useCallback(async () => {
    if (!enabled) return;

    try {
      const assignments = await providerOrderApi.getPendingAssignments();
      const nextAssignment = assignments.find((item) => {
        return new Date(item.responseDeadline).getTime() > Date.now();
      });
      setAssignment((current) => {
        if (current && nextAssignment && current._id === nextAssignment._id) return current;
        return nextAssignment ?? null;
      });
    } catch {
      setAssignment(null);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      void Promise.resolve().then(() => setAssignment(null));
      return undefined;
    }

    void Promise.resolve().then(loadPendingAssignment);

    const { socket, dispose } = createAuthenticatedSocket();

    const handleNewAssignment = (payload: AssignmentRealtimePayload) => {
      const nextAssignment = payload?.assignment;
      if (
        nextAssignment &&
        nextAssignment.status === 'pending' &&
        new Date(nextAssignment.responseDeadline).getTime() > Date.now()
      ) {
        setError(null);
        setAssignment(nextAssignment);
        return;
      }

      void loadPendingAssignment();
    };
    const handleClosedAssignment = (payload: { assignmentId?: string }) => {
      setAssignment((current) =>
        current?._id === payload.assignmentId ? null : current,
      );
      void loadPendingAssignment();
    };

    socket.on('assignment:new', handleNewAssignment);
    socket.on('direct-request:new', handleNewAssignment);
    socket.on('assignment:closed', handleClosedAssignment);
    socket.on('connect', loadPendingAssignment);

    return () => {
      socket.off('assignment:new', handleNewAssignment);
      socket.off('direct-request:new', handleNewAssignment);
      socket.off('assignment:closed', handleClosedAssignment);
      socket.off('connect', loadPendingAssignment);
      dispose();
    };
  }, [enabled, loadPendingAssignment, token]);

  useEffect(() => {
    if (!assignment) {
      void Promise.resolve().then(() => setCountdown(''));
      return undefined;
    }

    const tick = () => {
      const nextCountdown = getAssignmentCountdown(assignment.responseDeadline);
      setCountdown(nextCountdown);
      if (nextCountdown === 'Hết hạn') {
        window.setTimeout(() => setAssignment(null), 500);
      }
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [assignment]);

  const title = useMemo(() => {
    if (!order) return 'Đơn mới được phân công';
    return order.serviceId?.name || 'Đơn mới được phân công';
  }, [order]);

  const handleAccept = async () => {
    if (!assignment) return;
    try {
      setBusy(true);
      setError(null);
      const result = await providerOrderApi.acceptAssignment(assignment._id);
      setAssignment(null);
      navigate(`/provider/orders/${result.order._id}`);
    } catch {
      setError(
        isDirectRequest
          ? 'Không thể nhận yêu cầu. Yêu cầu có thể đã hết hạn hoặc không còn khả dụng.'
          : 'Không thể nhận đơn. Đơn có thể đã hết hạn hoặc được chuyển cho thợ khác.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!assignment) return;
    try {
      setBusy(true);
      setError(null);
      await providerOrderApi.rejectAssignment(assignment._id);
      setAssignment(null);
    } catch {
      setError('Không thể từ chối đơn. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  if (!assignment || !order) return null;

  return (
    <Modal
      open
      title={
        isAppointment
          ? "Yêu cầu lịch hẹn"
          : isDirectRequest
            ? "Khách hàng chọn bạn"
            : "Đơn mới cần phản hồi"
      }
      onClose={() => undefined}
      size="sm"
      closeOnEsc={false}
      closeOnOverlayClick={false}
    >
      <div className="space-y-md">
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-md">
          <div className="flex items-start justify-between gap-md">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary">
                {isExpired ? 'Đã hết hạn' : `Còn ${countdown}`}
              </p>
              <h3 className="mt-1 font-headline-md text-headline-md text-on-surface">
                {title}
              </h3>
              <p className="mt-1 text-sm text-on-surface-variant">
                {customer?.fullName || 'Khách hàng'}
                {customer?.phone ? ` · ${customer.phone}` : ''}
              </p>
            </div>
            <span className="material-symbols-outlined rounded-full bg-primary p-2 text-on-primary">
              notifications_active
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-sm">
          <InfoTile label="Thời gian" value={formatDateTime(order.scheduledAt || order.createdAt)} />
          <InfoTile label="Thu nhập dự kiến" value={formatMoney(order.pricing?.providerEarningAmount)} highlight />
        </div>

        {order.orderType === 'recurring' && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-sm text-sm text-on-surface">
            <p className="font-bold">Lịch định kỳ gồm {order.totalOccurrences} buổi</p>
            <p className="mt-1 text-on-surface-variant">
              Xác nhận yêu cầu này đồng nghĩa với nhận toàn bộ chuỗi lịch lặp theo{' '}
              {order.recurrenceUnit === 'monthly' ? 'tháng' : 'tuần'}.
            </p>
          </div>
        )}

        <div className="rounded-2xl bg-surface-container-low p-sm">
          <p className="text-[10px] font-bold uppercase text-on-surface-variant">Địa chỉ</p>
          <p className="mt-1 text-sm">
            {(order.addressId as { fullAddress?: string; detailAddress?: string }).fullAddress ||
              (order.addressId as { detailAddress?: string }).detailAddress ||
              shortAddress(order)}
          </p>
        </div>

        {order.problemDescription && (
          <div className="rounded-2xl border border-outline-variant/30 p-sm">
            <p className="text-[10px] font-bold uppercase text-on-surface-variant">
              Mô tả vấn đề
            </p>
            <p className="mt-1 line-clamp-3 text-sm">{order.problemDescription}</p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-error/10 px-md py-sm text-sm text-error">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-sm sm:flex-row">
          <button
            type="button"
            disabled={busy || isExpired}
            onClick={handleAccept}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {busy
              ? 'Đang xử lý...'
              : order.orderType === 'recurring'
                ? 'Xác nhận toàn bộ lịch'
                : isAppointment
                  ? 'Xác nhận lịch'
                  : isDirectRequest
                    ? 'Nhận yêu cầu'
                    : 'Nhận đơn'}
          </button>
          <button
            type="button"
            disabled={busy || isExpired}
            onClick={handleReject}
            className="btn-secondary flex-1 disabled:opacity-50"
          >
            Từ chối
          </button>
        </div>
      </div>
    </Modal>
  );
}

function InfoTile({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-2xl bg-surface-container-low p-sm">
      <p className="text-[10px] font-bold uppercase text-on-surface-variant">{label}</p>
      <p className={`mt-1 text-sm font-bold ${highlight ? 'text-primary' : 'text-on-surface'}`}>{value}</p>
    </div>
  );
}
