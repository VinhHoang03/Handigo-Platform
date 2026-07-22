import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { createAuthenticatedSocket } from '@/realtime/authenticatedSocket';
import { providerOrderApi } from '../api/providerOrder.api';
import type { OrderAssignment } from '../types/providerOrder.types';
import {
  getAssignmentCountdown,
  getCustomer,
  getOrderFromAssignment,
} from '../utils/providerOrder.utils';

interface AssignmentRealtimePayload {
  assignment?: OrderAssignment | null;
  assignmentId?: string;
}

export function useProviderAssignmentGate() {
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

  return {
    assignment,
    order,
    customer,
    busy,
    error,
    countdown,
    isExpired,
    isAppointment,
    isDirectRequest,
    title,
    handleAccept,
    handleReject,
  };
}
