import { Modal } from '@/components/common/Modal';
import type { AdminUser } from '../../types/admin.types';

const roleLabel = { CUSTOMER: 'Khách hàng', PROVIDER: 'Thợ', ADMIN: 'Quản trị viên' };

export function UserDetailModal({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  return (
    <Modal open={Boolean(user)} title="Chi tiết người dùng" onClose={onClose} size="sm">
      {user && <div className="space-y-3"><p><b>Họ tên:</b> {user.fullName}</p><p><b>Email:</b> {user.email}</p><p><b>Số điện thoại:</b> {user.phone || 'Chưa cập nhật'}</p><p><b>Vai trò:</b> {roleLabel[user.role]}</p><p><b>Ngày tham gia:</b> {new Date(user.createdAt).toLocaleString('vi-VN')}</p></div>}
    </Modal>
  );
}
