import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ReliableImage } from '@/components/common/ReliableImage';
import type { BookingListItem, BookingStatusTone } from '../types/booking.types';
import { toneOutlineClasses } from '@/utils/statusTone';
import { getOrderStatusMeta } from '@/utils/orderStatus';
import { Calendar, Star } from "lucide-react";

// Bảng màu quy về token ngữ nghĩa dùng chung, xem `utils/statusTone.ts`.
const statusToneClass: Record<BookingStatusTone, string> = {
  completed: toneOutlineClasses.success,
  pending: toneOutlineClasses.warning,
  cancelled: toneOutlineClasses.error,
  active: toneOutlineClasses.info,
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
          <Calendar aria-hidden="true" size={18} />
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
      <span className={`inline-flex h-8 w-fit min-w-28 items-center justify-center self-end rounded-full border px-3 text-center text-xs font-bold leading-none ${booking.status ? toneOutlineClasses[getOrderStatusMeta(booking.status).tone] : statusToneClass[booking?.statusTone || 'pending']}`}>
        {booking?.statusLabel || 'Đang xử lý'}
      </span>
      {booking?.rating ? (
        <div className="flex items-center gap-1 px-2 text-tertiary">
          <Star aria-hidden="true" size={20} fill="currentColor" />
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
