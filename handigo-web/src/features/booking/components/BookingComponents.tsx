import React, { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '../../../components/DashboardLayout';
import {
  bookingNavItems,
  selectedServiceImage,
  userAvatar,
  type BookingListItem,
  type BookingStatusTone,
} from '../data/bookingMockData';

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
  <DashboardLayout
    navItems={bookingNavItems}
    switchLabel="Đăng tin dịch vụ"
    onSwitch={() => undefined}
    switchVariant="gradient"
    userAvatar={userAvatar}
  >
    {children}
  </DashboardLayout>
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
    <div className="flex items-center justify-between max-w-2xl mx-auto relative py-md">
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
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-sm ${
                isDone || isActive
                  ? 'bg-primary text-white'
                  : 'bg-surface-container-highest border-2 border-outline-variant text-on-surface-variant'
              } ${isActive ? 'ring-4 ring-primary-fixed/70' : ''}`}
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
    className={`glass-card rounded-2xl p-md flex flex-col md:flex-row gap-md items-start md:items-center hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group ${
      booking.statusTone === 'pending' ? 'border-l-4 border-l-tertiary' : ''
    } ${booking.statusTone === 'cancelled' ? 'opacity-75' : ''}`}
  >
    <div className={`w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 ${booking.statusTone === 'cancelled' ? 'grayscale' : ''}`}>
      <img
        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        src={booking.imageUrl}
        alt={booking.serviceName}
      />
    </div>

    <div className="flex-1 min-w-0 w-full">
      <div className="flex flex-col sm:flex-row sm:justify-between gap-2 mb-1">
        <h3 className="font-headline-md text-headline-md text-on-surface truncate">{booking.serviceName}</h3>
        <span className={`px-3 py-1 rounded-full text-label-sm font-label-sm w-fit ${statusToneClass[booking.statusTone]}`}>
          {booking.statusLabel}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-md gap-y-1 text-on-surface-variant text-label-md mb-2">
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[18px]">calendar_today</span>
          {booking.schedule}
        </span>
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[18px]">{booking.statusTone === 'pending' ? 'info' : 'person'}</span>
          {booking.meta}
        </span>
      </div>
      <p className={`font-bold text-primary font-body-lg text-body-lg ${booking.statusTone === 'cancelled' ? 'line-through opacity-50' : ''}`}>
        {booking.price}
      </p>
    </div>

    <div className="flex gap-sm w-full md:w-auto mt-2 md:mt-0">
      {booking.rating ? (
        <div className="flex items-center gap-1 text-tertiary px-2">
          <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            star
          </span>
          <span className="font-label-md text-label-md">{booking.rating}</span>
        </div>
      ) : null}
      <Link
        to={`/customer/bookings/${booking.id}`}
        className={`flex-1 md:flex-none px-md py-2 rounded-xl font-label-md text-label-md text-center transition-all active:scale-95 ${
          booking.statusTone === 'pending'
            ? 'bg-primary text-on-primary shadow-sm hover:shadow-md'
            : 'border border-primary text-primary hover:bg-primary/5'
        }`}
      >
        {booking.primaryAction}
      </Link>
      {booking.secondaryAction ? (
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
  total?: string;
}> = ({ step, actionLabel, actionTo, total = '1.296.000đ' }) => {
  const content = (
    <>
      <div className="space-y-md">
        <div className="flex gap-sm p-sm bg-surface-container-low rounded-2xl">
          <img className="w-16 h-16 rounded-xl object-cover" src={selectedServiceImage} alt="Tổng vệ sinh căn hộ" />
          <div>
            <p className="font-bold">Tổng vệ sinh căn hộ</p>
            <p className="text-xs text-on-surface-variant">Gói cao cấp (3 giờ)</p>
            <p className="text-sm font-bold text-primary mt-1">1.200.000đ</p>
          </div>
        </div>

        <div className="border-t border-dashed border-outline-variant pt-md space-y-sm text-sm">
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Phí dịch vụ</span>
            <span className="font-medium">{step === 1 ? '250.000đ' : '1.200.000đ'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Phí di chuyển</span>
            <span className="text-secondary font-medium">{step === 3 ? '20.000đ' : 'Miễn phí'}</span>
          </div>
          {step > 1 ? (
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Thuế (VAT 8%)</span>
              <span className="font-medium">{step === 3 ? '37.600đ' : '96.000đ'}</span>
            </div>
          ) : null}
          {step === 3 ? (
            <div className="flex justify-between text-primary">
              <span>Khuyến mãi (HANDI20)</span>
              <span>-50.000đ</span>
            </div>
          ) : null}
        </div>

        <div className="pt-md border-t border-outline-variant flex justify-between items-center">
          <span className="font-bold">{step === 1 ? 'Tạm tính' : 'Tổng cộng'}</span>
          <span className="text-2xl font-bold text-primary">{step === 1 ? '250.000đ' : total}</span>
        </div>
      </div>

      {actionTo ? (
        <Link
          to={actionTo}
          className="mt-lg w-full bg-primary text-white py-md rounded-2xl font-bold text-lg shadow-xl shadow-primary/20 hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center gap-sm"
        >
          {actionLabel}
          <span className="material-symbols-outlined">arrow_forward</span>
        </Link>
      ) : (
        <button className="mt-lg w-full bg-primary text-white py-md rounded-2xl font-bold text-lg shadow-xl shadow-primary/20 hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center gap-sm">
          <span className="material-symbols-outlined">lock</span>
          {actionLabel}
        </button>
      )}
    </>
  );

  return (
    <aside className="space-y-md lg:sticky lg:top-24">
      <div className="bg-white rounded-3xl p-md shadow-lg border border-outline-variant/30">
        <h3 className="font-headline-md text-headline-md text-primary mb-md">Tóm tắt đơn hàng</h3>
        {content}
        <p className="text-center text-xs text-on-surface-variant mt-md">
          Thanh toán an toàn và bảo mật bởi HandiGo.
        </p>
      </div>
      <div className="glass-card rounded-2xl p-sm flex items-center gap-sm">
        <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            verified_user
          </span>
        </div>
        <div>
          <p className="text-sm font-bold">Bảo hiểm an tâm</p>
          <p className="text-xs text-on-surface-variant">Đền bù lên đến 50 triệu đồng</p>
        </div>
      </div>
    </aside>
  );
};
