import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { StatBox, CertificationItem, SecurityItem } from '../components/ProviderProfileComponents';
import type { ProviderProfile } from '../types/provider.types';

const ProviderProfilePage: React.FC = () => {
  const navigate = useNavigate();

  const navItems = [
    { icon: 'grid_view', label: 'Bảng điều khiển', path: '/provider' },
    { icon: 'event_available', label: 'Đặt lịch', path: '#' },
    { icon: 'mail', label: 'Tin nhắn', path: '#' },
    { icon: 'payments', label: 'Ví', path: '#' },
    { icon: 'settings', label: 'Cài đặt', path: '/provider/profile' },
  ];

  const profile: ProviderProfile = {
    fullName: 'Alex Henderson', email: 'alex.h@fixnow.com', phone: '+1 (555) 928-3344', city: 'San Francisco, CA',
    address: '242 Berry St, Suite 400, San Francisco, CA 94158',
    bio: 'Experienced HVAC and electrical specialist with over 8 years in the field. I focus on energy-efficient home solutions and high-end residential maintenance. Dedicated to providing frictionless, expert service with clear communication.',
    skills: ['HVAC', 'Electrical', 'Smart Home'], certifications: [{ id: '1', title: 'Licensed Electrician (State of CA)', expiryDate: 'Oct 2025' }],
    rating: 4.9, totalBookings: 142, joinDate: 'Mar 2023',
    avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBYsy-DKcuOjXk3bJ2TZ7yIFHGaiQzpdN3in_X8y1TGZ6yZICvKNAltClr4Ex-3ZRwUjFMrn7qkJfdwwDB4j9Jw8pXrNf73FuLCJ7F3ss4q9DmTTfqKXlwdD1GCwMeXUJ8r_u2xkDAFu5oZAFNXUj876n6FeBW2YlSffXSv_aTSSFgBZNjvXD2G37HhWRNIjVDOH0sr9NYXZhjngyMo0F3fdhuvcMTGkDlsI0F_KFeIUZilvPBFO3pD0aZb4PkzT1wAtL1o0dTmfTw',
  };

  return (
    <DashboardLayout navItems={navItems} switchLabel="Chuyển sang Khách hàng" onSwitch={() => navigate('/customer')} userAvatar={profile.avatarUrl}>
      <div className="max-w-5xl mx-auto space-y-md">
        <section className="relative h-[240px] md:h-[320px] rounded-3xl overflow-hidden mt-base border border-outline-variant/30">
          <img alt="Cover" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDpMJM1jH35NgarwqSriwzgk7kuz375mFY2PklXs5vmgHD3jI4IRTv8ElL5vMPHcaA4ki3o5dtnT6r-gEko4L1sUxScQPSaPoHvcE2LPaS-RL3Lme67PTldq4oawc7kGrd0_Pc-sSi7dKTQGvYQB6SQGvaGHinHnPT_NguR4XkEd4QsCFgRXLL0obCkkghrxVb5TzqtuoYs6-H10n35m0lT8IwsI_kBjHn3gXH4T-B4wO0p5ueM53J-0119whBBpgCbw8oKIhDMNRk" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
          <div className="absolute bottom-6 left-6 flex items-end gap-md"><h1 className="text-xl md:text-headline-lg font-headline-lg text-on-background">{profile.fullName}</h1></div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          <div className="lg:col-span-4 space-y-md">
            <div className="glass-card p-md rounded-2xl"><h3 className="font-headline-md text-headline-md text-on-surface mb-4">Tổng quan hoạt động</h3><div className="space-y-4"><StatBox label="Tổng số đặt lịch" value={profile.totalBookings} /><StatBox label="Đánh giá trung bình" value={profile.rating} /><StatBox label="Ngày tham gia" value={profile.joinDate} color="text-on-surface" /></div></div>
          </div>

          <div className="lg:col-span-8 space-y-md">
            <div className="glass-card p-6 md:p-lg rounded-3xl"><h3 className="text-xl md:text-headline-lg font-headline-lg text-on-surface mb-lg">Thông tin cá nhân</h3></div>
            <div className="glass-card p-6 md:p-lg rounded-3xl"><h3 className="text-xl md:text-headline-lg font-headline-lg text-on-surface mb-lg">Chi tiết nghề nghiệp</h3>{profile.certifications.map((cert) => <CertificationItem key={cert.id} cert={cert} />)}</div>
            <div className="glass-card p-6 md:p-lg rounded-3xl"><h3 className="text-xl md:text-headline-lg font-headline-lg text-on-surface mb-lg">Bảo mật & Quyền riêng tư</h3><div className="space-y-gutter"><SecurityItem icon="lock" title="Mật khẩu" desc="Đổi lần cuối 4 tháng trước" action={<button className="px-6 py-2 border border-primary text-primary rounded-xl">Cập nhật</button>} /><SecurityItem icon="shield_person" title="Xác thực hai yếu tố (2FA)" desc="Thêm một lớp bảo mật bổ sung vào tài khoản của bạn." action={<input type="checkbox" defaultChecked className="h-5 w-5" />} /></div></div>
            <div className="glass-card p-6 md:p-lg rounded-3xl"><h3 className="text-xl md:text-headline-lg font-headline-lg text-on-surface mb-lg">Cài đặt thông báo</h3><div className="space-y-gutter"><SecurityItem icon="event_available" title="Cập nhật đặt lịch" desc="Nhận thông báo khi lịch đặt được xác nhận hoặc thay đổi." action={<input type="checkbox" defaultChecked className="h-5 w-5" />} /><SecurityItem icon="campaign" title="Tiếp thị và Khuyến mãi" desc="Nhận các ưu đãi cá nhân hóa và tin tức thị trường." action={<input type="checkbox" className="h-5 w-5" />} /><SecurityItem icon="sms" title="Tin nhắn SMS trực tiếp" desc="Gửi tin nhắn trực tiếp đến điện thoại của bạn qua SMS." action={<input type="checkbox" defaultChecked className="h-5 w-5" />} /></div></div>
            <div className="flex justify-end gap-md pt-lg"><button className="px-8 py-3 text-on-surface-variant font-label-md hover:text-primary transition-all">Hủy thay đổi</button><button className="px-12 py-3 bg-primary text-on-primary rounded-2xl font-bold">Lưu tất cả cập nhật</button></div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ProviderProfilePage;
