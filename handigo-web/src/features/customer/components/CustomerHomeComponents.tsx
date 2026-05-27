import React from 'react';
import type { Booking, Pro, Category } from '../types/customer.types';

// CategoryItem
interface CategoryItemProps {
  category: Category;
}

export const CategoryItem: React.FC<CategoryItemProps> = ({ category }) => (
  <button className="glass-card p-md rounded-2xl flex flex-col items-center gap-3 hover:scale-105 transition-transform group">
    <div className="p-4 bg-primary-fixed text-primary rounded-full group-hover:bg-primary group-hover:text-on-primary transition-colors">
      <span className="material-symbols-outlined text-[32px]">{category.icon}</span>
    </div>
    <span className="font-label-md text-label-md">{category.name}</span>
  </button>
);

// BookingCard
interface BookingCardProps {
  booking: Booking;
}

export const BookingCard: React.FC<BookingCardProps> = ({ booking }) => (
  <div className={`glass-card p-md rounded-2xl flex flex-col md:flex-row gap-md hover:border-primary/30 transition-all ${booking.status === 'Đang chờ' || booking.status === 'Pending' ? 'opacity-80' : ''}`}>
    <div className="h-24 w-24 rounded-xl overflow-hidden shrink-0">
      <img alt={booking.title} src={booking.imageUrl} className="w-full h-full object-cover" />
    </div>
    <div className="flex-grow flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-semibold">{booking.title}</h4>
          <p className="font-label-md text-label-md text-on-surface-variant">
            {booking.providerName ? `Chuyên gia: ${booking.providerName}` : 'Đang tìm chuyên gia...'}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full font-label-sm text-label-sm ${booking.status === 'Đã xác nhận' || booking.status === 'Confirmed' ? 'bg-cyan-100 text-cyan-700' :
            booking.status === 'Đang chờ' || booking.status === 'Pending' ? 'bg-orange-100 text-orange-700' :
              'bg-gray-100 text-gray-700'
          }`}>
          {booking.status}
        </span>
      </div>
      <div className="flex items-center gap-md mt-sm">
        <div className="flex items-center gap-1 text-on-surface-variant">
          <span className="material-symbols-outlined text-[18px]">calendar_today</span>
          <span className="font-label-md text-label-md">{booking.date}, {booking.time}</span>
        </div>
        <div className="flex items-center gap-1 text-on-surface-variant">
          <span className="material-symbols-outlined text-[18px]">payments</span>
          <span className="font-label-md text-label-md">{booking.price}</span>
        </div>
      </div>
    </div>
    <div className="flex md:flex-col justify-end gap-2">
      {booking.status === 'Đã xác nhận' || booking.status === 'Confirmed' ? (
        <button className="p-2 text-primary hover:bg-primary/5 rounded-lg transition-colors material-symbols-outlined">chat</button>
      ) : null}
      {booking.status === 'Đang chờ' || booking.status === 'Pending' ? (
        <button className="p-2 text-error hover:bg-error/5 rounded-lg transition-colors material-symbols-outlined">cancel</button>
      ) : null}
      <button className="p-2 text-on-surface-variant hover:bg-surface-container-low rounded-lg transition-colors material-symbols-outlined">more_vert</button>
    </div>
  </div>
);

// ProCard
interface ProCardProps {
  pro: Pro;
}

export const ProCard: React.FC<ProCardProps> = ({ pro }) => (
  <div className="glass-card p-sm rounded-2xl flex items-center gap-md hover:translate-y-[-2px] transition-transform cursor-pointer">
    <div className="h-16 w-16 rounded-full overflow-hidden shrink-0 border-2 border-primary-container">
      <img alt={pro.name} src={pro.avatarUrl} className="w-full h-full object-cover" />
    </div>
    <div className="flex-grow">
      <h4 className="font-label-md text-label-md font-bold">{pro.name}</h4>
      <p className="text-[12px] text-on-surface-variant">{pro.title}</p>
      <div className="flex items-center gap-1 mt-1">
        <span className="material-symbols-outlined text-yellow-500 text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
        <span className="font-label-sm text-label-sm">{pro.rating} ({pro.reviewsCount} đánh giá)</span>
      </div>
    </div>
  </div>
);

// PromoCard
export const PromoCard: React.FC = () => (
  <div className="relative overflow-hidden rounded-2xl bg-primary-container p-md text-on-primary-container">
    <div className="relative z-10 space-y-sm">
      <span className="bg-primary px-2 py-1 rounded text-[10px] uppercase font-bold tracking-widest text-on-primary">Ưu đãi đặc biệt</span>
      <h4 className="text-lg font-bold">Giảm 20% cho lần dọn dẹp đầu tiên!</h4>
      <p className="text-xs opacity-80">Sử dụng mã: FIXNOW20 khi thanh toán.</p>
      <button className="mt-base bg-on-primary-container text-primary-container px-4 py-2 rounded-full font-label-md text-label-md hover:bg-on-primary-container/90 transition-all">Nhận ngay</button>
    </div>
    <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-[120px] opacity-10 rotate-12">cleaning_services</span>
  </div>
);
