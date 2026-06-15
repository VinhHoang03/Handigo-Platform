import { useState } from 'react';
import { AsyncState } from '@/components/common/AsyncState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DashboardShell } from '@/components/common/DashboardShell';
import { Modal } from '@/components/common/Modal';
import { Pagination } from '@/components/common/Pagination';
import { StatusBadge } from '@/components/common/StatusBadge';
import { adminApi } from '../api/admin.api';
import { useAdminList } from '../hooks/useAdminList';
import type { AdminQuery, AdminUser } from '../types/admin.types';

export default function AdminUsersPage() {
  const [query, setQuery] = useState<AdminQuery>({ page: 1, limit: 10 });
  const { result, loading, error, load } = useAdminList('users', query);
  const users = (result?.items || []) as AdminUser[];
  const [detail, setDetail] = useState<AdminUser | null>(null);
  const [target, setTarget] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState(false);
  const update = async () => {
    if (!target) return;
    try { setBusy(true); await adminApi.updateUserStatus(target._id, target.status === 'active' ? 'locked' : 'active'); setTarget(null); await load(); }
    finally { setBusy(false); }
  };
  return (
    <DashboardShell role="ADMIN">
      <div><h1 className="text-headline-lg font-bold">Quản lý người dùng</h1><p className="text-on-surface-variant">Tìm kiếm, xem chi tiết và khóa tài khoản.</p></div>
      <div className="glass-card flex flex-wrap gap-3 rounded-2xl p-4">
        <input value={query.keyword || ''} onChange={(e) => setQuery({ ...query, keyword: e.target.value, page: 1 })} className="min-w-56 flex-1 rounded-xl border border-outline-variant p-3" placeholder="Tên hoặc email..." />
        <select value={query.role || ''} onChange={(e) => setQuery({ ...query, role: e.target.value, page: 1 })} className="rounded-xl border border-outline-variant p-3"><option value="">Tất cả vai trò</option><option value="CUSTOMER">Khách hàng</option><option value="PROVIDER">Thợ</option><option value="ADMIN">Quản trị viên</option></select>
        <select value={query.status || ''} onChange={(e) => setQuery({ ...query, status: e.target.value, page: 1 })} className="rounded-xl border border-outline-variant p-3"><option value="">Tất cả trạng thái</option><option value="active">Hoạt động</option><option value="locked">Đã khóa</option></select>
      </div>
      <AsyncState loading={loading} error={error} empty={!users.length} emptyMessage="Không có người dùng phù hợp." onRetry={load}>
        <div className="overflow-x-auto rounded-2xl border border-outline-variant/40 bg-surface"><table className="w-full text-left"><thead className="bg-surface-container-low"><tr><th className="p-4">Người dùng</th><th className="p-4">Vai trò</th><th className="p-4">Trạng thái</th><th className="p-4 text-right">Thao tác</th></tr></thead><tbody>{users.map((user) => <tr key={user._id} className="border-t border-outline-variant/30"><td className="p-4"><p className="font-semibold">{user.fullName}</p><p className="text-sm text-on-surface-variant">{user.email}</p></td><td className="p-4">{user.role}</td><td className="p-4"><StatusBadge value={user.status} /></td><td className="p-4 text-right"><button onClick={() => setDetail(user)} className="mr-4 text-primary">Chi tiết</button>{user.role !== 'ADMIN' && <button onClick={() => setTarget(user)} className="text-primary">{user.status === 'active' ? 'Khóa' : 'Mở khóa'}</button>}</td></tr>)}</tbody></table></div>
      </AsyncState>
      <Pagination page={query.page || 1} totalPages={result?.pagination.totalPages || 1} onChange={(page) => setQuery({ ...query, page })} />
      <Modal open={Boolean(detail)} title="Chi tiết người dùng" onClose={() => setDetail(null)}>{detail && <div className="space-y-3"><p><b>Họ tên:</b> {detail.fullName}</p><p><b>Email:</b> {detail.email}</p><p><b>Số điện thoại:</b> {detail.phone || 'Chưa cập nhật'}</p><p><b>Vai trò:</b> {detail.role}</p><p><b>Ngày tạo:</b> {new Date(detail.createdAt).toLocaleString('vi-VN')}</p></div>}</Modal>
      <ConfirmDialog open={Boolean(target)} title={target?.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'} message="Thao tác sẽ có hiệu lực ngay với các API được bảo vệ." busy={busy} onCancel={() => setTarget(null)} onConfirm={update} />
    </DashboardShell>
  );
}
