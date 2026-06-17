import React from 'react';
import type { Booking, Category, Pro } from '../types/customer.types';

interface HeroOfferProps {
  imageUrl: string;
}

export const HeroOffer: React.FC<HeroOfferProps> = ({ imageUrl }) => (
  <section className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
    <div className="lg:col-span-8 relative rounded-3xl overflow-hidden group h-[300px] md:h-[400px] shadow-sm">
      <img
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        alt="Phong khach hien dai sach se voi anh sang tu nhien"
        src={imageUrl}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent flex flex-col justify-center p-md md:p-xl">
        <span className="text-secondary-fixed font-label-md text-label-md mb-2 uppercase">Ưu đãi độc quyền</span>
        <h2 className="font-headline-xl text-[36px] md:text-headline-xl text-white mb-4 leading-tight">
          Giảm ngay 20%
          <br />
          Dịch vụ vệ sinh tổng quát
        </h2>
        <button className="w-fit px-lg py-sm bg-primary text-on-primary rounded-xl font-label-md text-label-md transition-all active:scale-95 shadow-lg">
          Nhận mã ngay
        </button>
      </div>
    </div>

    <div className="lg:col-span-4 grid grid-rows-2 gap-gutter">
      <div className="bg-primary-container rounded-3xl p-md flex flex-col justify-between text-on-primary-container shadow-sm overflow-hidden relative min-h-[180px]">
        <div className="relative z-10">
          <h3 className="font-headline-md text-headline-md mb-1">Thành viên VIP</h3>
          <p className="text-body-md opacity-80">Ưu tiên đặt lịch & miễn phí khảo sát</p>
        </div>
        <div className="relative z-10 flex justify-between items-end">
          <span className="font-label-md text-label-md">Hạng vàng</span>
          <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            stars
          </span>
        </div>
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
      </div>

      <div className="glass-card rounded-3xl p-md flex flex-col justify-between shadow-sm border border-outline-variant/30 min-h-[180px]">
        <div className="flex justify-between">
          <h3 className="font-headline-md text-headline-md text-on-surface">Giới thiệu bạn</h3>
          <span className="material-symbols-outlined text-primary">redeem</span>
        </div>
        <p className="text-on-surface-variant text-label-md">
          Tặng 100k cho mỗi người bạn mới sử dụng HandiGo.
        </p>
        <button className="text-primary font-label-md text-label-md text-left flex items-center gap-base mt-2 hover:translate-x-1 transition-all">
          Chia sẻ ngay
          <span className="material-symbols-outlined">arrow_forward</span>
        </button>
      </div>
    </div>
  </section>
);

interface SectionTitleProps {
  title: string;
  description?: string;
  actionLabel?: string;
}

export const SectionTitle: React.FC<SectionTitleProps> = ({ title, description, actionLabel }) => (
  <div className="flex justify-between items-end gap-md">
    <div>
      <h2 className="font-headline-lg text-headline-lg text-on-surface">{title}</h2>
      {description ? <p className="text-on-surface-variant">{description}</p> : null}
    </div>
    {actionLabel ? (
      <a className="text-primary font-label-md text-label-md hover:underline shrink-0" href="#">
        {actionLabel}
      </a>
    ) : null}
  </div>
);

interface CategoryItemProps {
  category: Category;
}

export const CategoryItem: React.FC<CategoryItemProps> = ({ category }) => (
  <button className="group cursor-pointer text-left">
    <div className="aspect-square rounded-3xl bg-surface-container mb-4 overflow-hidden relative shadow-sm hover:shadow-md transition-all">
      {category.imageUrl ? (
        <img
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          alt={category.imageAlt ?? category.name}
          src={category.imageUrl}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-primary-fixed text-primary">
          <span className="material-symbols-outlined text-[48px]">{category.icon}</span>
        </div>
      )}
      <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
    <h3 className="font-label-md text-label-md text-center text-on-surface group-hover:text-primary transition-colors">
      {category.name}
    </h3>
  </button>
);

interface CategoriesGridProps {
  categories: Category[];
}

export const CategoriesGrid: React.FC<CategoriesGridProps> = ({ categories }) => (
  <section className="space-y-md">
    <SectionTitle
      title="Danh mục phổ biến"
      description="Tìm kiếm dịch vụ phù hợp nhất cho tổ ấm của bạn"
      actionLabel="Xem tất cả"
    />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-gutter">
      {categories.map((category) => (
        <CategoryItem key={category.name} category={category} />
      ))}
    </div>
  </section>
);

interface BookingCardProps {
  booking: Booking;
}

const statusClassNames = {
  confirmed: 'bg-secondary-container/20 text-on-secondary-container',
  pending: 'bg-surface-container-high text-on-surface-variant',
  cancelled: 'bg-error-container text-on-error-container',
};

export const BookingCard: React.FC<BookingCardProps> = ({ booking }) => {
  const tone = booking.statusTone ?? 'pending';
  const statusLabel = booking.statusLabel ?? booking.status;

  return (
    <article className="glass-card p-md rounded-3xl transition-all hover:scale-[1.02] cursor-pointer">
      <div className="flex justify-between items-start gap-md mb-md">
        <div className="flex gap-sm">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary">{booking.icon ?? 'home_repair_service'}</span>
          </div>
          <div>
            <h4 className="font-label-md text-label-md text-on-surface">{booking.title}</h4>
            <p className="text-label-sm text-on-surface-variant">ID: #{booking.id}</p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-label-sm whitespace-nowrap ${statusClassNames[tone]}`}>
          {statusLabel}
        </span>
      </div>

      <div className="flex items-center gap-xs text-on-surface-variant mb-md">
        <span className="material-symbols-outlined text-[20px]">schedule</span>
        <span className="text-label-sm">
          {booking.date} • {booking.time}
        </span>
      </div>

      <div className="pt-md border-t border-outline-variant/30 flex justify-between items-center gap-md">
        <div className="flex items-center gap-xs min-w-0">
          {booking.providerAvatarUrl ? (
            <img alt={booking.providerName} className="w-6 h-6 rounded-full object-cover" src={booking.providerAvatarUrl} />
          ) : (
            <div className="w-6 h-6 bg-outline-variant/20 rounded-full flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[16px]">person</span>
            </div>
          )}
          <span className={`text-label-sm truncate ${booking.providerName ? '' : 'italic text-on-surface-variant'}`}>
            {booking.providerName ?? 'Đang tìm thợ...'}
          </span>
        </div>
        <span className="font-label-md text-label-md text-primary font-bold whitespace-nowrap">{booking.price}</span>
      </div>
    </article>
  );
};

interface RecentOrdersProps {
  bookings: Booking[];
}

export const RecentOrders: React.FC<RecentOrdersProps> = ({ bookings }) => (
  <section className="lg:col-span-8 space-y-md">
    <div className="flex justify-between items-center gap-md">
      <h2 className="font-headline-lg text-headline-lg text-on-surface">Đơn hàng gần đây</h2>
      <span className="bg-surface-container px-3 py-1 rounded-full text-label-sm text-on-surface-variant whitespace-nowrap">
        3 đơn đang xử lý
      </span>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
      {bookings.map((booking) => (
        <BookingCard key={booking.id} booking={booking} />
      ))}
    </div>
  </section>
);

interface ProCardProps {
  pro: Pro;
}

export const ProCard: React.FC<ProCardProps> = ({ pro }) => (
  <article className="glass-card p-md rounded-3xl flex items-center gap-md hover:shadow-md transition-all cursor-pointer">
    <div className="relative shrink-0">
      <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-primary/20">
        <img className="w-full h-full object-cover" alt={pro.name} src={pro.avatarUrl} />
      </div>
      <div
        className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white rounded-full ${
          pro.isOnline ? 'bg-green-500' : 'bg-outline-variant/50'
        }`}
      />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex justify-between items-start gap-sm">
        <h4 className="font-label-md text-label-md text-on-surface font-bold truncate">{pro.name}</h4>
        {pro.distance ? <span className="text-[10px] text-on-surface-variant whitespace-nowrap">{pro.distance}</span> : null}
      </div>
      <p className="text-label-sm text-on-surface-variant mb-1 truncate">{pro.title}</p>
      <div className="flex items-center gap-xs">
        <span className="material-symbols-outlined text-yellow-500 text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
          star
        </span>
        <span className="text-label-sm font-bold">{pro.rating}</span>
        <span className="text-label-sm text-on-surface-variant">({pro.reviewsCount} đánh giá)</span>
      </div>
    </div>
  </article>
);

interface TopProvidersProps {
  providers: Pro[];
}

export const TopProviders: React.FC<TopProvidersProps> = ({ providers }) => (
  <aside className="lg:col-span-4 space-y-md">
    <SectionTitle title="Top Provider" actionLabel="Xem tất cả" />
    <div className="flex flex-col gap-md">
      {providers.map((provider) => (
        <ProCard key={provider.id} pro={provider} />
      ))}
    </div>
  </aside>
);

export const CustomerHomeFooter: React.FC = () => (
  <footer className="p-lg mt-xl text-center border-t border-outline-variant/20">
    <p className="text-on-surface-variant text-label-sm">
      © 2024 HandiGo - Trải nghiệm dịch vụ gia đình hoàn hảo
    </p>
  </footer>
);
