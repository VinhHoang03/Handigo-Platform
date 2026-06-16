import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { getRoleHomePath } from '@/features/auth/utils/roleNavigation';

type AppRole = 'CUSTOMER' | 'PROVIDER' | 'ADMIN';

export function RouteGuard({ roles, children }: { roles: AppRole[]; children: ReactNode }) {
  const location = useLocation();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const isInitializing = useAuthStore((state) => state.isInitializing);

  if (isInitializing) {
    return (
      <div className="grid min-h-screen place-items-center text-on-surface-variant">
        Dang khoi phuc phien dang nhap...
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const normalizedRole = user.role.toUpperCase() as AppRole;
  if (!roles.includes(normalizedRole)) {
    return <Navigate to={getRoleHomePath(user.role)} replace />;
  }

  return children;
}
