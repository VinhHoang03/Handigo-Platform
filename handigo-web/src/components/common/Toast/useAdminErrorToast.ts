import { useContext, useEffect, useRef } from 'react';
import { AdminLayoutContext } from '../dashboard/adminLayout.context';
import { ToastContext } from './toast-context';

export function useAdminErrorToast(error?: string, force = false) {
  const admin = useContext(AdminLayoutContext);
  const addToast = useContext(ToastContext)?.addToast;
  const reported = useRef('');
  useEffect(() => {
    if (!error) { reported.current = ''; return; }
    if ((admin || force) && addToast && reported.current !== error) {
      reported.current = error;
      addToast(error, 'error');
    }
  }, [admin, force, addToast, error]);
  return admin;
}
