import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { OrderAssignment } from '../types/providerOrder.types';
import {
  formatDateTime,
  formatMoney,
  getAssignmentCountdown,
  getCustomer,
  getOrderFromAssignment,
  shortAddress,
} from '../utils/providerOrder.utils';

interface PendingAssignmentCardProps {
  assignment: OrderAssignment;
  onAccept: (assignmentId: string) => Promise<void>;
  onReject: (assignmentId: string) => Promise<void>;
  busy?: boolean;
}

export function PendingAssignmentCard({
  assignment,
  onAccept,
  onReject,
  busy,
}: PendingAssignmentCardProps) {
  const order = getOrderFromAssignment(assignment);
  const [countdown, setCountdown] = useState(getAssignmentCountdown(assignment.responseDeadline));

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdown(getAssignmentCountdown(assignment.responseDeadline));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [assignment.responseDeadline]);

  if (!order) return null;

  const customer = getCustomer(order);
  const isExpired = countdown === 'Hết hạn';
  const isAppointment = assignment.assignmentType === 'appointment';
  const isDirectRequest = assignment.assignmentType === 'direct_request';

  return (
    <div className="glass-card overflow-hidden rounded-3xl border border-primary/15">
      <div className="border-b border-outline-variant/20 bg-primary/5 px-md py-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">notifications_active</span>
            <span className="font-label-md text-primary">
              {isAppointment
                ? 'Yêu cầu lịch hẹn'
                : isDirectRequest
                  ? 'Khách hàng chọn bạn'
                  : 'Đơn mới được phân công'}
            </span>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              isExpired ? 'bg-error/10 text-error' : 'bg-primary text-on-primary'
            }`}
          >
            {isExpired ? 'Hết hạn' : `Còn ${countdown}`}
          </span>
        </div>
      </div>

      <div className="space-y-md p-md">
        <div>
          <h3 className="font-headline-md text-on-surface">{order.serviceId?.name}</h3>
          <p className="mt-1 text-sm text-on-surface-variant">
            {customer?.fullName || 'Khách hàng'}
            {customer?.phone ? ` · ${customer.phone}` : ''}
          </p>
        </div>

        <div className="grid gap-sm sm:grid-cols-2">
          <div className="rounded-2xl bg-surface-container-low p-sm">
            <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
              Thời gian hẹn
            </p>
            <p className="mt-1 text-sm font-medium text-on-surface">
              {formatDateTime(order.scheduledAt || order.createdAt)}
            </p>
          </div>
          <div className="rounded-2xl bg-surface-container-low p-sm">
            <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
              Thu nhập dự kiến
            </p>
            <p className="mt-1 text-sm font-bold text-primary">
              {formatMoney(order.pricing?.providerEarningAmount)}
            </p>
          </div>
        </div>

        {order.orderType === 'recurring' && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-sm text-sm">
            <p className="font-bold text-on-surface">
              Nhận toàn bộ {order.totalOccurrences} buổi định kỳ
            </p>
            <p className="mt-1 text-on-surface-variant">
              Chu kỳ lặp theo {order.recurrenceUnit === 'monthly' ? 'tháng' : 'tuần'}.
            </p>
          </div>
        )}

        <div className="rounded-2xl bg-surface-container-low p-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
            Địa chỉ
          </p>
          <p className="mt-1 text-sm text-on-surface">
            {(order.addressId as { fullAddress?: string; detailAddress?: string }).fullAddress ||
              (order.addressId as { detailAddress?: string }).detailAddress ||
              shortAddress(order)}
          </p>
        </div>

        {order.problemDescription && (
          <div className="rounded-2xl border border-outline-variant/30 bg-white p-sm">
            <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
              Mô tả vấn đề
            </p>
            <p className="mt-1 text-sm text-on-surface">{order.problemDescription}</p>
          </div>
        )}

        <div className="flex flex-col gap-sm sm:flex-row">
          <button
            type="button"
            disabled={busy || isExpired}
            onClick={() => onAccept(assignment._id)}
            className="btn-primary flex-1"
          >
            {order.orderType === 'recurring'
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
            onClick={() => onReject(assignment._id)}
            className="btn-secondary flex-1"
          >
            Từ chối
          </button>
          <Link to={`/provider/orders/${order._id}`} className="btn-secondary flex-1 text-center">
            Xem chi tiết
          </Link>
        </div>
      </div>
    </div>
  );
}
