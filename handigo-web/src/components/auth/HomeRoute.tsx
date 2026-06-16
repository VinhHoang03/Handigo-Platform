import { Navigate } from 'react-router-dom';
import HomePage from '@/pages/HomePage';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { getRoleHomePath } from '@/features/auth/utils/roleNavigation';

export function HomeRoute() {
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

  if (token && user) {
    return <Navigate to={getRoleHomePath(user.role)} replace />;
  }

  return <HomePage />;
}
