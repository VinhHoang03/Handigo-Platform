import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { getRoleProfilePath } from '@/features/auth/utils/roleNavigation';

export function ProfileRoute() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isInitializing = useAuthStore((state) => state.isInitializing);

  if (isInitializing) {
    return (
      <div className="grid min-h-screen place-items-center text-on-surface-variant">
        Dang khoi phuc phien dang nhap...
      </div>
    );
  }

  if (!token || !user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: '/profile',
          message: 'Vui lòng đăng nhập để truy cập hồ sơ cá nhân.',
        }}
      />
    );
  }

  return <Navigate to={getRoleProfilePath(user.role)} replace />;
}
