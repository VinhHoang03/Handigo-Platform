import React, { type ReactNode, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DashboardShell } from '@/components/common/DashboardShell';
import { Navbar } from '@/components/common/Navbar';
import { selectedServiceImage } from '../constants/bookingImages';
import { useBookingStore } from '../hooks/useBookingStore';
import { serviceCatalogApi } from '@/features/customer-service/api/serviceCatalog.api';
import type { Service, ServiceOption } from '../../../types/booking';
import { ReliableImage } from '@/components/common/ReliableImage';
import type { BookingListItem, BookingStatusTone } from '../types/booking.types';

const getOptionPrice = (option: ServiceOption) => option.price ?? option.fixedPrice ?? 0;

interface BookingShellProps {
  children: ReactNode;
}

const statusToneClass: Record<BookingStatusTone, string> = {
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  cancelled: 'border-red-200 bg-red-50 text-red-700',
  active: 'border-blue-200 bg-blue-50 text-blue-700',
};

const orderStatusClass: Record<string, string> = {
  created: 'border-amber-200 bg-amber-50 text-amber-700',
  accepted: 'border-violet-200 bg-violet-50 text-violet-700',
  in_progress: 'border-blue-200 bg-blue-50 text-blue-700',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  cancelled: 'border-red-200 bg-red-50 text-red-700',
};

export const BookingShell: React.FC<BookingShellProps> = ({ children }) => (
  <DashboardShell role="CUSTOMER">{children}</DashboardShell>
);

export const OrderCreationShell: React.FC<BookingShellProps> = ({ children }) => (
  <div className="min-h-screen overflow-x-hidden bg-background font-body-md text-body-md">
    <Navbar role="CUSTOMER" />
    <main className="relative min-h-screen pb-12 pt-32">
      <div className="mx-auto max-w-container-max space-y-8 px-4 sm:px-5 lg:px-8">
        {children}
      </div>
    </main>
  </div>
);

export const BookingPageHeader: React.FC<{
  title: string;
  description: string;
  action?: ReactNode;
}> = ({ title, description, action }) => (
  <header className="space-y-md">
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">{title}</h1>
      <p className="text-on-surface-variant font-body-md mt-1">{description}</p>
    </div>
    {action}
  </header>
);

export const BookingStepper: React.FC<{ currentStep: 1 | 2 | 3 }> = ({ currentStep }) => {
  const steps = [
    { id: 1, label: 'Dịch vụ' },
    { id: 2, label: 'Thời gian & địa điểm' },
    { id: 3, label: 'Thanh toán' },
  ] as const;

  return (
    <nav aria-label="Tiến trình đặt dịch vụ" className="mx-auto w-full max-w-[720px] py-2">
      <div className="relative">
        <div
          aria-hidden="true"
          className="absolute left-[16.6667%] right-[16.6667%] top-[15px] h-px bg-outline-variant/70"
        >
          <div
            className="h-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
          />
        </div>

        <ol className="relative grid grid-cols-3">
          {steps.map((step) => {
            const isDone = step.id < currentStep;
            const isActive = step.id === currentStep;

            return (
              <li
                key={step.id}
                aria-current={isActive ? 'step' : undefined}
                className="relative z-10 flex min-w-0 flex-col items-center text-center"
              >
                <span
                  className={`grid h-[30px] w-[30px] place-items-center rounded-full border text-xs font-bold leading-none transition-colors ${
                    isDone
                      ? 'border-primary bg-primary text-on-primary'
                      : isActive
                        ? 'border-primary bg-surface-container-lowest text-primary ring-[3px] ring-primary-fixed'
                        : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant'
                  }`}
                >
                  {isDone ? (
                    <span className="material-symbols-outlined text-[16px] leading-none">check</span>
                  ) : (
                    step.id
                  )}
                </span>
                <span
                  className={`mt-1 block min-h-8 px-1 font-label-sm text-label-sm sm:min-h-0 sm:whitespace-nowrap ${
                    isDone || isActive
                      ? 'font-semibold text-primary'
                      : 'font-semibold text-on-surface-variant'
                  }`}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
};

export const BookingHistoryCard: React.FC<{ booking: BookingListItem }> = ({ booking }) => {
  const navigate = useNavigate();
  const detailUrl = `/customer/bookings/${booking.id}`;
  const isCompleted = booking.status === 'completed' || booking.statusTone === 'completed';

  const openDetail = () => navigate(detailUrl);

  return (
  <article
    role="link"
    tabIndex={0}
    aria-label={`Xem chi tiết đơn ${booking.serviceName}`}
    onClick={openDetail}
    onKeyDown={(event) => {
      if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      openDetail();
    }}
    className={`group flex cursor-pointer flex-col items-stretch gap-md rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-md shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-primary/15 sm:flex-row sm:items-center ${booking?.statusTone === 'cancelled' ? 'opacity-80' : ''}`}
  >
    <div className={`h-44 w-full rounded-xl overflow-hidden flex-shrink-0 sm:h-28 sm:w-28 ${booking?.statusTone === 'cancelled' ? 'grayscale' : ''}`}>
      <ReliableImage
        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        src={booking?.imageUrl}
        alt={booking?.serviceName || 'Dịch vụ'}
      />
    </div>

    <div className="min-w-0 w-full flex-1">
      <h3 className="min-w-0 break-words font-headline-md text-headline-md text-on-surface">{booking?.serviceName || 'Dịch vụ'}</h3>
      <div className="flex flex-wrap gap-x-md gap-y-1 text-on-surface-variant text-label-md mb-2">
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[18px]">calendar_today</span>
          {booking?.schedule || 'Sớm nhất'}
        </span>
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[18px]">{booking?.statusTone === 'pending' ? 'info' : 'person'}</span>
          {booking?.meta || 'Đang cập nhật'}
        </span>
      </div>
      <p className={`font-bold text-primary font-body-lg text-body-lg ${booking?.statusTone === 'cancelled' ? 'line-through opacity-50' : ''}`}>
        {booking?.price || '0đ'}
      </p>
    </div>

    <div className="flex w-full shrink-0 flex-col gap-sm sm:w-auto sm:min-w-52 sm:items-end sm:self-stretch sm:justify-between">
      <span className={`inline-flex h-8 w-fit min-w-28 items-center justify-center self-end rounded-full border px-3 text-center text-xs font-bold leading-none ${orderStatusClass[booking.status || ''] || (booking?.statusTone ? statusToneClass[booking.statusTone] : statusToneClass.pending)}`}>
        {booking?.statusLabel || 'Đang xử lý'}
      </span>
      {booking?.rating ? (
        <div className="flex items-center gap-1 px-2 text-amber-500">
          <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            star
          </span>
          <span className="font-label-md text-label-md">{booking.rating}</span>
        </div>
      ) : null}
      <div className="flex w-full flex-wrap items-center justify-end gap-2" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
        <Link
          to={detailUrl}
          className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-primary/40 px-4 py-2 text-center font-label-md text-label-md font-bold text-primary transition-all hover:border-primary hover:bg-primary/5 active:scale-95 sm:flex-none"
        >
          Chi tiết
        </Link>
        {isCompleted && (
          <Link
            to={`/customer/orders/${booking.id}/feedback`}
            className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl bg-primary px-4 py-2 text-center font-label-md text-label-md font-bold text-on-primary shadow-sm transition-all hover:shadow-md active:scale-95 sm:flex-none"
          >
            Đánh giá
          </Link>
        )}
      </div>
    </div>
  </article>
  );
};

export const OrderSummaryCard: React.FC<{
  step: 1 | 2 | 3;
  actionLabel: string;
  actionTo?: string;
  onAction?: () => void;
  isLoading?: boolean;
  summaryContent?: ReactNode;
  discountAmount?: number;
}> = ({
  step,
  actionLabel,
  actionTo,
  onAction,
  isLoading,
  summaryContent,
  discountAmount = 0,
}) => {
  const {
    categoryId,
    serviceId,
    selectedOptionIds,
    orderType,
    scheduledAt,
    preferredProviderName,
  } = useBookingStore();
  const [service, setService] = useState<Service | null>(null);
  const [options, setOptions] = useState<ServiceOption[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    if (serviceId) {
      serviceCatalogApi.servicesByCategory(categoryId || '').then(services => {
        if (!isMounted) return;
        const found = services.find(s => s._id === serviceId);
        if (found) setService(found);
      });

      serviceCatalogApi.options(serviceId).then(data => {
        if (isMounted) setOptions(data);
      });
    } else {
      setTimeout(() => {
        if (isMounted) {
          setService(null);
          setOptions([]);
        }
      }, 0);
    }
    return () => { isMounted = false; };
  }, [serviceId, categoryId]);

  const selectedOptions = options.filter(opt => selectedOptionIds.includes(opt._id));

  const calculateTotal = () => {
    let total = 0;
    if (service?.serviceType === 'fixed_price') {
      total = service?.fixedPrice || 0;
    } else if (service?.serviceType === 'variable_price') {
      total = service?.depositAmount || 0;
    }
    if (service?.serviceType !== 'variable_price') {
      selectedOptions.forEach(opt => {
        total += getOptionPrice(opt);
      });
    }
    return total;
  };

  const total = calculateTotal();
  const finalTotal = Math.max(total - discountAmount, 0);

  const handleAction = () => {
    if (onAction) {
      onAction();
    } else if (actionTo) {
      navigate(actionTo);
    }
  };

  return (
    <aside className="space-y-md lg:sticky lg:top-24">
      <div className="bg-white rounded-3xl p-md shadow-lg border border-outline-variant/30">
        <h3 className="font-headline-md text-headline-md text-primary mb-md">Tóm tắt đơn hàng</h3>

        <div className="space-y-md">
          <div className="flex gap-sm p-sm bg-surface-container-low rounded-2xl">
            <img
              className="w-16 h-16 rounded-xl object-cover"
              src={service?.image || selectedServiceImage}
              alt={service?.name || 'Dịch vụ'}
            />
            <div>
              <p className="font-bold">{service?.name || 'Chưa chọn dịch vụ'}</p>
              <p className="text-xs text-on-surface-variant truncate max-w-[150px]">
                {service?.description || 'Vui lòng chọn dịch vụ'}
              </p>
              <p className="text-sm font-bold text-primary mt-1">
                {service?.serviceType === 'fixed_price'
                  ? `${(service.fixedPrice || 0).toLocaleString()}đ`
                  : service?.serviceType === 'variable_price'
                    ? `Phí cọc: ${(service.depositAmount || 0).toLocaleString()}đ`
                    : '0đ'}
              </p>
            </div>
          </div>

          {step >= 2 && orderType !== 'normal' && (
            <div className="space-y-sm border-t border-dashed border-outline-variant pt-md text-sm">
              <div className="flex items-start gap-sm">
                <span aria-hidden="true" className="material-symbols-outlined text-[19px] text-primary">calendar_today</span>
                <div>
                  <p className="text-xs text-on-surface-variant">Lịch thực hiện</p>
                  <p className="font-bold text-on-surface">
                    {scheduledAt?.includes('T')
                      ? new Date(scheduledAt).toLocaleString('vi-VN')
                      : 'Chưa chọn đủ ngày giờ'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-sm">
                <span aria-hidden="true" className="material-symbols-outlined text-[19px] text-primary">person</span>
                <div>
                  <p className="text-xs text-on-surface-variant">Chuyên gia</p>
                  <p className="font-bold text-on-surface">
                    {preferredProviderName || 'Chưa chọn chuyên gia'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-dashed border-outline-variant pt-md space-y-sm text-sm">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">
                {service?.serviceType === 'variable_price' ? 'Phí đặt cọc' : 'Phí dịch vụ'}
              </span>
              <span className="font-medium">
                {service?.serviceType === 'fixed_price'
                  ? `${(service?.fixedPrice || 0).toLocaleString()}đ`
                  : `${(service?.depositAmount || 0).toLocaleString()}đ`}
              </span>
            </div>
            {selectedOptions.map(opt => (
              <div key={opt._id} className="flex justify-between">
                <span className="text-on-surface-variant">{opt.name}</span>
                {service?.serviceType !== 'variable_price' && (
                  <span className="font-medium">+{getOptionPrice(opt).toLocaleString()}đ</span>
                )}
              </div>
            ))}
          </div>

          <div className="pt-md border-t border-outline-variant flex justify-between items-center">
            <div>
              <span className="font-bold">Tổng cộng</span>
              {discountAmount > 0 && (
                <p className="mt-1 text-sm font-semibold text-emerald-600">
                  Đã giảm {discountAmount.toLocaleString("vi-VN")}đ
                </p>
              )}
            </div>
            <div className="text-right">
              {discountAmount > 0 && (
                <p className="text-sm text-on-surface-variant line-through">
                  {total.toLocaleString("vi-VN")}đ
                </p>
              )}
              <span className="text-2xl font-bold text-primary">
                {finalTotal.toLocaleString("vi-VN")}đ
              </span>
            </div>
          </div>

          {summaryContent}
        </div>

        <div className="mt-lg space-y-sm">
          {step > 1 && (
            <button
              onClick={() => navigate(-1)}
              className="w-full py-3 border border-primary text-primary rounded-2xl font-bold hover:bg-primary/5 transition-[background-color,transform] active:scale-95 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Quay lại
            </button>
          )}
          <button
            onClick={handleAction}
            disabled={isLoading || (step === 1 && !serviceId)}
            className="w-full bg-primary text-white py-md rounded-2xl font-bold text-lg shadow-xl shadow-primary/20 hover:-translate-y-1 active:translate-y-0 transition-[transform,box-shadow] flex items-center justify-center gap-sm disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
          >
            {isLoading ? (
              <span className="animate-spin material-symbols-outlined">progress_activity</span>
            ) : (
              <>
                {step === 3 ? (
                  <span className="material-symbols-outlined">
                    {orderType === 'normal' ? 'lock' : 'event_available'}
                  </span>
                ) : null}
                {actionLabel}
                <span className="material-symbols-outlined">arrow_forward</span>
              </>
            )}
          </button>
        </div>

        <p className="text-center text-xs leading-5 text-on-surface-variant mt-md">
          {orderType !== 'normal' && step >= 2
            ? 'Chưa thu tiền khi gửi yêu cầu. Bạn chỉ thanh toán sau khi chuyên gia xác nhận lịch.'
            : 'Thanh toán an toàn và bảo mật bởi HandiGo.'}
        </p>
      </div>
    </aside>
  );
};

