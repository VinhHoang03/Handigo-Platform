import { Eye, LockKeyhole, LockKeyholeOpen } from 'lucide-react';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { DataTableColumn } from '@/components/common/dashboard/DataTable';
import type { AdminUser } from '../../types/admin.types';

const roleLabel: Record<AdminUser['role'], string> = {
  CUSTOMER: 'Khách hàng',
  PROVIDER: 'Thợ',
  ADMIN: 'Quản trị viên',
};

interface UserColumnActions {
  onView: (user: AdminUser) => void;
  onToggleStatus: (user: AdminUser) => void;
}

/**
 * Cột nhận hành động qua tham số vì hai nút cuối hàng cần callback của trang.
 * Tài khoản ADMIN không hiện nút khoá — giữ nguyên điều kiện của bản cũ.
 */
export const buildUserTableColumns = ({
  onView,
  onToggleStatus,
}: UserColumnActions): Array<DataTableColumn<AdminUser>> => [
  {
    key: 'user',
    header: 'Người dùng',
    render: (user) => (
      <div className="flex items-center gap-3">
        <InitialsAvatar name={user.fullName} src={user.avatar} className="h-10 w-10" />
        <div>
          <p className="font-semibold">{user.fullName}</p>
          <p className="text-sm text-on-surface-variant">{user.email}</p>
        </div>
      </div>
    ),
  },
  {
    key: 'role',
    header: 'Vai trò',
    render: (user) => roleLabel[user.role],
  },
  {
    key: 'createdAt',
    header: 'Ngày tham gia',
    className: 'tabular-nums',
    render: (user) => new Date(user.createdAt).toLocaleDateString('vi-VN'),
  },
  {
    key: 'status',
    header: 'Trạng thái',
    render: (user) => <StatusBadge value={user.status} />,
  },
  {
    key: 'actions',
    header: 'Thao tác',
    className: 'text-right',
    render: (user) => (
      <div className="flex justify-end gap-2">
        <button
          type="button"
          title="Xem chi tiết"
          onClick={() => onView(user)}
          className="rounded-lg border border-outline-variant p-2 text-primary"
        >
          <Eye size={18} />
        </button>
        {user.role !== 'ADMIN' && (
          <button
            type="button"
            title={user.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
            onClick={() => onToggleStatus(user)}
            className="rounded-lg border border-outline-variant p-2 text-primary"
          >
            {user.status === 'active' ? <LockKeyhole size={18} /> : <LockKeyholeOpen size={18} />}
          </button>
        )}
      </div>
    ),
  },
];
