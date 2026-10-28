import type { User } from '../types/auth.types';

export const getRoleHomePath = (
  role?: User['role'] | string | null,
  providerOnboardingStatus?: User['providerOnboardingStatus'],
) => {
  switch (role?.toUpperCase()) {
    case 'CUSTOMER':
      return '/customer';
    case 'PROVIDER':
      if (providerOnboardingStatus === 'PENDING_REVIEW') {
        return '/provider/profile';
      }
      return providerOnboardingStatus && providerOnboardingStatus !== 'APPROVED'
        ? '/register-provider'
        : '/provider';
    case 'ADMIN':
      return '/admin';
    default:
      return '/login';
  }
};

export const getRoleProfilePath = (role?: User['role'] | string | null) => {
  switch (role?.toUpperCase()) {
    case 'CUSTOMER':
      return '/customer/profile';
    case 'PROVIDER':
      return '/provider/profile';
    case 'ADMIN':
      return '/admin/users';
    default:
      return '/login';
  }
};

export const getPostLoginPath = (role: User['role'], providerOnboardingStatus: User['providerOnboardingStatus'], from: unknown) => {
  const normalizedRole = role.toUpperCase();

  if (['CUSTOMER', 'PROVIDER'].includes(normalizedRole) && typeof from === 'string') {
    try {
      const url = new URL(from, 'https://handigo.invalid');

      if (
        url.origin === 'https://handigo.invalid' &&
        url.pathname === '/ho-tro' &&
        url.searchParams.get('focus') === 'tao-yeu-cau'
      ) {
        return '/ho-tro?focus=tao-yeu-cau';
      }

      if (
        normalizedRole === 'CUSTOMER' &&
        url.origin === 'https://handigo.invalid' &&
        ['/payment/success', '/payment/cancel', '/customer/bookings/result', '/customer/bookings/success'].includes(url.pathname)
      ) {
        return url.pathname + url.search + url.hash;
      }
    } catch { /* Đường dẫn không hợp lệ quay về trang theo vai trò. */ }
  }
  return getRoleHomePath(role, providerOnboardingStatus);
};
