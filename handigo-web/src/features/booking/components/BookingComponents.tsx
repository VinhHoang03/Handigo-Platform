import React, { type ReactNode, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DashboardShell } from '@/components/common/DashboardShell';
import { Navbar } from '@/components/common/Navbar';
import {
  selectedServiceImage,
  type BookingListItem,
  type BookingStatusTone,
} from '../data/bookingMockData';
import { useBookingStore } from '../hooks/useBookingStore';
import { bookingApi } from '../../../api/booking';
import type { Service, ServiceOption } from '../../../types/booking';

const getOptionPrice = (option: ServiceOption) => option.price ?? option.fixedPrice ?? 0;

interface BookingShellProps {
  children: ReactNode;
}

const statusToneClass: Record<BookingStatusTone, string> = {
  completed: 'bg-primary/10 text-primary',
  pending: 'bg-tertiary/10 text-tertiary',
  cancelled: 'bg-on-surface-variant/10 text-on-surface-variant',
  active: 'bg-primary/10 text-primary',
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
    <div className="flex items-center justify-between max-w-[620px] mx-auto relative py-md">
      <div className="absolute top-1/2 left-0 w-full h-0.5 bg-outline-variant -translate-y-1/2" />
      <div
        className="absolute top-1/2 left-0 h-0.5 bg-primary -translate-y-1/2 transition-all"
        style={{ width: currentStep === 1 ? '25%' : currentStep === 2 ? '62%' : '100%' }}
      />

      {steps.map((step) => {
        const isDone = step.id < currentStep;
        const isActive = step.id === currentStep;

        return (
          <div key={step.id} className="relative z-10 flex flex-col items-center gap-2 text-center">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${isDone || isActive
                ? 'bg-primary text-white'
                : 'bg-surface-container-highest border-2 border-outline-variant text-on-surface-variant'
                } ${isActive ? 'ring-[3px] ring-primary-fixed/70' : ''}`}
            >
              {isDone ? <span className="material-symbols-outlined text-sm">check</span> : step.id}
            </div>
            <span className={`font-label-md text-label-md ${isDone || isActive ? 'text-primary font-bold' : 'text-on-surface-variant'}`}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const BookingHistoryCard: React.FC<{ booking: BookingListItem }> = ({ booking }) => (
  <article
    className={`glass-card rounded-2xl p-md flex flex-col md:flex-row gap-md items-start md:items-center hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group ${booking?.statusTone === 'pending' ? 'border-l-4 border-l-tertiary' : ''
      } ${booking?.statusTone === 'cancelled' ? 'opacity-75' : ''}`}
  >
    <div className={`w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 ${booking?.statusTone === 'cancelled' ? 'grayscale' : ''}`}>
      <img
        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        src={booking?.imageUrl || 'https://via.placeholder.com/150'}
        alt={booking?.serviceName || 'Dịch vụ'}
      />
    </div>

    <div className="flex-1 min-w-0 w-full">
      <div className="flex flex-col sm:flex-row sm:justify-between gap-2 mb-1">
        <h3 className="font-headline-md text-headline-md text-on-surface truncate">{booking?.serviceName || 'Dịch vụ'}</h3>
        <span className={`px-3 py-1 rounded-full text-label-sm font-label-sm w-fit ${booking?.statusTone ? statusToneClass[booking.statusTone] : ''}`}>
          {booking?.statusLabel || 'Đang xử lý'}
        </span>
      </div>
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

    <div className="flex gap-sm w-full md:w-auto mt-2 md:mt-0">
      {booking?.rating ? (
        <div className="flex items-center gap-1 text-tertiary px-2">
          <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            star
          </span>
          <span className="font-label-md text-label-md">{booking.rating}</span>
        </div>
      ) : null}
      <Link
        to={booking?.statusTone === 'completed'
          ? `/customer/orders/${booking?.id || ''}/feedback`
          : `/customer/bookings/${booking?.id || ''}`}
        className={`flex-1 md:flex-none px-md py-2 rounded-xl font-label-md text-label-md text-center transition-all active:scale-95 ${booking?.statusTone === 'pending'
          ? 'bg-primary text-on-primary shadow-sm hover:shadow-md'
          : 'border border-primary text-primary hover:bg-primary/5'
          }`}
      >
        {booking?.primaryAction || 'Xem chi tiết'}
      </Link>
      {booking?.secondaryAction ? (
        <Link
          to={`/customer/bookings/${booking.id}`}
          className="flex-1 md:flex-none px-md py-2 bg-surface-container-high text-on-surface-variant rounded-xl font-label-md text-label-md text-center hover:bg-surface-container-highest transition-all active:scale-95"
        >
          {booking.secondaryAction}
        </Link>
      ) : null}
    </div>
  </article>
);

export const OrderSummaryCard: React.FC<{
  step: 1 | 2 | 3;
  actionLabel: string;
  actionTo?: string;
  onAction?: () => void;
  isLoading?: boolean;
}> = ({ step, actionLabel, actionTo, onAction, isLoading }) => {
  const { categoryId, serviceId, selectedOptionIds } = useBookingStore();
  const [service, setService] = useState<Service | null>(null);
  const [options, setOptions] = useState<ServiceOption[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    if (serviceId) {
      bookingApi.getServices(categoryId || '').then(services => {
        if (!isMounted) return;
        const found = services.find(s => s._id === serviceId);
        if (found) setService(found);
      });

      bookingApi.getOptions(serviceId).then(data => {
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
            <span className="font-bold">Tổng cộng</span>
            <span className="text-2xl font-bold text-primary">
              {total.toLocaleString()}đ
            </span>
          </div>
        </div>

        <div className="mt-lg space-y-sm">
          {step > 1 && (
            <button
              onClick={() => navigate(-1)}
              className="w-full py-3 border border-primary text-primary rounded-2xl font-bold hover:bg-primary/5 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Quay lại
            </button>
          )}
          <button
            onClick={handleAction}
            disabled={isLoading || (step === 1 && !serviceId)}
            className="w-full bg-primary text-white py-md rounded-2xl font-bold text-lg shadow-xl shadow-primary/20 hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center gap-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="animate-spin material-symbols-outlined">progress_activity</span>
            ) : (
              <>
                {step === 3 ? <span className="material-symbols-outlined">lock</span> : null}
                {actionLabel}
                <span className="material-symbols-outlined">arrow_forward</span>
              </>
            )}
          </button>
        </div>

        <p className="text-center text-xs text-on-surface-variant mt-md">
          Thanh toán an toàn và bảo mật bởi HandiGo.
        </p>
      </div>
    </aside>
  );
};

