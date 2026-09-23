import { DataTable } from '@/components/common/dashboard/DataTable';
import type { AdminUser } from '../../types/admin.types';
import { buildUserTableColumns } from './user-table-columns';

export function UserTable({ users, onView, onToggleStatus }: {
  users: AdminUser[];
  onView: (user: AdminUser) => void;
  onToggleStatus: (user: AdminUser) => void;
}) {
  return (
    <DataTable
      columns={buildUserTableColumns({ onView, onToggleStatus })}
      rows={users}
      rowKey={(user) => user._id}
      minWidthClassName="min-w-[780px]"
      emptyState={
        <div className="p-10 text-center text-on-surface-variant">
          Không có người dùng phù hợp.
        </div>
      }
    />
  );
}
