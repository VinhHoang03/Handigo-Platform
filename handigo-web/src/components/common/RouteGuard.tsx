import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/auth.store';

export function RouteGuard({ roles, children }: { roles: Array<'CUSTOMER' | 'PROVIDER' | 'ADMIN'>; children: ReactNode }) {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  if (!token) return <Navigate to="/signin" replace />;
  const normalizedRole = user?.role?.toUpperCase();
  if (normalizedRole && !roles.includes(normalizedRole as 'CUSTOMER' | 'PROVIDER' | 'ADMIN')) {
    return <Navigate to="/" replace />;
  }
  return children;
}
