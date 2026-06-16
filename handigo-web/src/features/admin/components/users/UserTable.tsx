import { Eye, LockKeyhole, LockKeyholeOpen } from 'lucide-react';
import type { AdminUser } from '../../types/admin.types';

const roleLabel = { CUSTOMER: 'Khách hàng', PROVIDER: 'Thợ', ADMIN: 'Quản trị viên' };

export function UserTable({ users, onView, onToggleStatus }: {
  users: AdminUser[];
  onView: (user: AdminUser) => void;
  onToggleStatus: (user: AdminUser) => void;
}) {
  return (
    <div className="overflow-x-auto border-b border-outline-variant/40">
      <table className="w-full min-w-[780px] text-left">
        <thead className="bg-surface-container-low"><tr><th className="p-4">Người dùng</th><th className="p-4">Vai trò</th><th className="p-4">Ngày tham gia</th><th className="p-4">Trạng thái</th><th className="p-4 text-right">Thao tác</th></tr></thead>
        <tbody>
          {users.map((user) => {
            const avatar = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=4f46e5&color=fff`;
            return (
              <tr key={user._id} className="border-t border-outline-variant/30">
                <td className="p-4"><div className="flex items-center gap-3"><img src={avatar} alt="" className="h-10 w-10 rounded-full object-cover" /><div><p className="font-semibold">{user.fullName}</p><p className="text-sm text-on-surface-variant">{user.email}</p></div></div></td>
                <td className="p-4">{roleLabel[user.role]}</td>
                <td className="p-4">{new Date(user.createdAt).toLocaleDateString('vi-VN')}</td>
                <td className="p-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${user.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{user.status === 'active' ? 'Hoạt động' : 'Bị khóa'}</span></td>
                <td className="p-4"><div className="flex justify-end gap-2">
                  <button type="button" title="Xem chi tiết" onClick={() => onView(user)} className="rounded-lg border border-outline-variant p-2 text-primary"><Eye size={18} /></button>
                  {user.role !== 'ADMIN' && <button type="button" title={user.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'} onClick={() => onToggleStatus(user)} className="rounded-lg border border-outline-variant p-2 text-primary">{user.status === 'active' ? <LockKeyhole size={18} /> : <LockKeyholeOpen size={18} />}</button>}
                </div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
