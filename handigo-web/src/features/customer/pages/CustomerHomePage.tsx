import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { CategoryItem, BookingCard, ProCard, PromoCard } from '../components/CustomerHomeComponents';
import type { Category, Booking, Pro } from '../types/customer.types';

const CustomerHomePage: React.FC = () => {
  const navigate = useNavigate();

  const navItems = [
    { icon: 'grid_view', label: 'Bảng điều khiển', path: '/customer' },
    { icon: 'event_available', label: 'Đặt lịch', path: '#' },
    { icon: 'mail', label: 'Tin nhắn', path: '#' },
    { icon: 'payments', label: 'Ví', path: '#' },
    { icon: 'settings', label: 'Cài đặt', path: '/customer/profile' },
  ];

  const categories: Category[] = [
    { icon: 'plumbing', name: 'Ống nước' },
    { icon: 'bolt', name: 'Điện' },
    { icon: 'cleaning_services', name: 'Dọn dẹp' },
    { icon: 'air_purifier_gen', name: 'Điều hòa & Thông gió' },
    { icon: 'pest_control', name: 'Diệt côn trùng' },
    { icon: 'carpenter', name: 'Thợ đa năng' },
  ];

  const currentBookings: Booking[] = [
    {
      id: '1',
      title: 'Sửa rò rỉ vòi nước nhà bếp',
      providerName: 'David Miller • PlumbMaster LLC',
      status: 'Đã xác nhận',
      date: 'Oct 24',
      time: '2:00 PM',
      price: '$85.00',
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCDkQeR3Etvy_bY_Y3Id6dALnVrjO2NWta-TNsN0b4hwK2G1EWN-lib-mfPWA-8c9qbqteT9pg3g5oFbKyges6I0UQxNVFH9I7CTS6vnmQW38CXABpz8ejijghNwA4pHVueFgRbEpxMzQl5qpEAL-cNBEXp3P_w6ZjSSNRrMyF8BOdBULeDy10Hnwrgckdj2V9hailN5uIll53MhC4L8qC8rs-msDaicSoU4RUjUBE70nSWvrxp0GZtX-w6jFiZaMq7dRqbuksj4d8',
    },
    {
      id: '2',
      title: 'Lắp đặt đèn thông minh phòng khách',
      status: 'Đang chờ',
      date: 'Oct 26',
      time: '10:00 AM',
      price: 'Est. $120.00',
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDG8tpoQ4WA3ddw5h5TK8_bLfskZRKNYS9kRk0lbj0xkCabIc1r9Vv7vC3pM_87XuxtCVt_QP2jusfVQcoLCexCoWbn3EAw320RbBNbbGBD0D1I4st8s_SbGuggXL8pPg3EbhRdg0xVcajUQf1ou3Ed_JkFtP1UCHzdD8WUPNneFMkkAlBUj9lOrmVFJQhIcM0aTweqCW-A1IXXzsX_DCwmT_ZGdAleo2pVHTQ6fTxXuOo3xBpyAZdWRb11ywwBhTPa3Q4Ihbq0vZk',
    },
  ];

  const topPros: Pro[] = [
    {
      id: '1',
      name: 'Sarah Jenkins',
      title: 'Thợ điện được chứng nhận',
      rating: 4.9,
      reviewsCount: 124,
      avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDldzxeZoQT1iNnmlu8p-mZi0VA7EY2pT1j6JxYNOCKXrlUA31Bd-nyZduI90597S17VvVAtrp476ZhzTg7ttcRDSBLKLTWyNjGa0Hjm1Xpe8x-V8TSXlZQ8lqtcEIUyrvaEOJjh283oDslGcyXwV8oDyG4uEqeAr8mgh66Tv8aHx0NNsmA9S8a4g20WIqeN5ZFpOfQSYhy8QEc37djKTuJVrA_OJ7L68C7MlZiRMKb6BHv3iF9Nmp-cxVU_76M3U54BY5-Yi2UyT8',
    },
    {
      id: '2',
      name: 'Mike Thompson',
      title: 'Chuyên gia dọn dẹp sâu',
      rating: 4.8,
      reviewsCount: 89,
      avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDq1tW5ylwzBdzZNrEv10thI-ahfVSlvMiHsW6kWN-d1Ab1x8j4Fn-6vCJ9e_7lL8h5LXON1EsZmNcDZ9ygNuEF85YnpsEFDKhbXRXAu-Sq_OmgDcZySNjIYTp37OkE2zBKWpvbnYKojyPzXUgoP7eBv_r_hp6u2WRaJOoqP2TsTz8I8Bx9Rq9MO0c_epc00lHkLmx3UGZ7LT0d7vkTHxFGRLlFOxc7QF5QDt_fLiIEkNY6CSW-9NI4L5UBFt1yIAULnDA-NXsy5d4',
    },
  ];

  return (
    <DashboardLayout
      navItems={navItems}
      switchLabel="Đăng ký thợ dịch vụ"
      switchVariant="gradient"
      onSwitch={() => navigate('/register-provider')}
      userAvatar="https://lh3.googleusercontent.com/aida-public/AB6AXuDEHJafX2qd3dTrHvNRy0dHwStQm_jFRmhcLv7V0Iflbe6KzeTksnzJoPq-9La8vc-adIj8yxCaNbKijj7uerHZrdZ26OjHWGwnN0LAasZmmwUJvNl29qnLlcWRpjXBtzvINjdOUc5Vqa7kppjp19pddoyUdVYqLk6tlS-7HLqNujhNuBLKccwxJqq8JLs_hR0DUZB7qr9wk45KYBT_ZrXMF28rWVmmvNL1wTSkAS7cYVUA3QSPnq_1_Vb47bF_AqhYh5TC1k28ILg"
    >
      {/* Welcome Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div className="space-y-xs">
          <h2 className="font-headline-lg text-headline-lg text-on-background">Xin chào, James!</h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant">Hôm nay chúng tôi có thể giúp bạn sửa chữa gì?</p>
        </div>
        <div className="flex gap-2">
          <div className="flex flex-col items-center glass-card px-md py-sm rounded-xl">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Hạn mức tín dụng</span>
            <span className="font-headline-md text-headline-md text-primary">$2,500</span>
          </div>
        </div>
      </section>

      {/* Quick Book */}
      <section className="space-y-md">
        <div className="flex items-center justify-between">
          <h3 className="font-headline-md text-headline-md">Đặt nhanh</h3>
          <a className="text-primary font-label-md text-label-md flex items-center gap-1 hover:underline" href="#">
            Xem tất cả <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </a>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-md">
          {categories.map((cat) => (
            <CategoryItem key={cat.name} category={cat} />
          ))}
        </div>
      </section>

      {/* Dashboard Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        {/* Current Bookings */}
        <section className="lg:col-span-2 space-y-md">
          <h3 className="font-headline-md text-headline-md">Lịch đặt hiện tại</h3>
          <div className="space-y-md">
            {currentBookings.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
          </div>
        </section>

        {/* Sidebar/Secondary Widget Area */}
        <aside className="space-y-lg">
          {/* Top Pros */}
          <section className="space-y-md">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-md text-headline-md">Chuyên gia hàng đầu gần bạn</h3>
              <div className="flex gap-2">
                <button className="p-1 rounded-full border border-outline-variant text-outline hover:bg-surface-container-low">
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                <button className="p-1 rounded-full border border-outline-variant text-outline hover:bg-surface-container-low">
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
            </div>
            <div className="space-y-md">
              {topPros.map((pro) => (
                <ProCard key={pro.id} pro={pro} />
              ))}
            </div>
          </section>

          {/* Promo Card */}
          <PromoCard />
        </aside>
      </div>
    </DashboardLayout>
  );
};

export default CustomerHomePage;
