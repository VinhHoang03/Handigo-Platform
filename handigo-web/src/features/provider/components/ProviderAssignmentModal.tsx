import { Modal } from '@/components/common/Modal';
import { formatDateTime, formatMoney, shortAddress } from '../utils/providerOrder.utils';
import { useProviderAssignmentGate } from './useProviderAssignmentGate';

export function ProviderAssignmentModal() {
  const {
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
  } = useProviderAssignmentGate();

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
