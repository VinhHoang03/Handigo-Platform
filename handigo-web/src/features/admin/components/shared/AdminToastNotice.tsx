import { useAdminErrorToast } from '@/components/common/Toast/useAdminErrorToast';

export function AdminToastNotice({ message }: { message?: string | null }) {
  useAdminErrorToast(message ?? undefined, true);
  return null;
}
