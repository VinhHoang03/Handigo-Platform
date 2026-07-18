import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { getRoleHomePath } from '@/features/auth/utils/roleNavigation';

type AppRole = 'CUSTOMER' | 'PROVIDER' | 'ADMIN';

export function RouteGuard({
  roles,
  children,
  allowUnapprovedProvider = false,
}: {
  roles: AppRole[];
  children: ReactNode;
  allowUnapprovedProvider?: boolean;
}) {
  const location = useLocation();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const isInitializing = useAuthStore((state) => state.isInitializing);

  if (isInitializing) {
    return (
      <div className="grid min-h-screen place-items-center text-on-surface-variant">
        Đang khôi phục phiên đăng nhập...
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const normalizedRole = user.role.toUpperCase() as AppRole;
  if (!roles.includes(normalizedRole)) {
    return <Navigate to={getRoleHomePath(user.role, user.providerOnboardingStatus)} replace />;
  }

  if (
    normalizedRole === 'PROVIDER' &&
    !allowUnapprovedProvider &&
    user.providerOnboardingStatus &&
    user.providerOnboardingStatus !== 'APPROVED'
  ) {
    return <Navigate to="/register-provider" replace />;
  }

  return children;
}
