import { useEffect, type ReactNode } from 'react';
import { authService } from '@/features/auth/services/auth.service';

export function AuthBootstrap({ children }: { children: ReactNode }) {
  useEffect(() => {
    void authService.restoreSession();
  }, []);

  return children;
}
