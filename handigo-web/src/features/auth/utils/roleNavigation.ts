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
