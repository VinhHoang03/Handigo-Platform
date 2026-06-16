import type { ReactNode } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/auth.store';

export function DashboardShell({ role, children }: { role: 'CUSTOMER' | 'PROVIDER' | 'ADMIN'; children: ReactNode }) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const avatar = user?.avatarUrl || 'https://ui-avatars.com/api/?name=Handigo&background=4f46e5&color=fff';
  const navItems = role === 'ADMIN'
    ? [
        { icon: 'people', label: 'Người dùng', path: '/admin/users' },
        { icon: 'verified_user', label: 'Hồ sơ thợ', path: '/admin/provider-applications' },
        { icon: 'reviews', label: 'Đánh giá', path: '/admin/feedbacks' },
      ]
    : role === 'PROVIDER'
      ? [
          { icon: 'grid_view', label: 'Bảng điều khiển', path: '/provider' },
          { icon: 'reviews', label: 'Đánh giá', path: '/provider/feedbacks' },
          { icon: 'settings', label: 'Hồ sơ', path: '/provider/profile' },
        ]
      : [
          { icon: 'grid_view', label: 'Bảng điều khiển', path: '/customer' },
          { icon: 'settings', label: 'Hồ sơ', path: '/customer/profile' },
          { icon: 'engineering', label: 'Đăng ký làm thợ', path: '/register-provider' },
        ];
  return (
    <DashboardLayout
      navItems={navItems}
      switchLabel={role === 'PROVIDER' ? 'Chuyển sang khách hàng' : 'Về trang chủ'}
      onSwitch={() => navigate(role === 'PROVIDER' ? '/customer' : '/')}
      userAvatar={avatar}
    >
      {children}
    </DashboardLayout>
  );
}
