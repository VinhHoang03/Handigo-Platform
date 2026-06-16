import { FloatingInput } from '@/components/common/FloatingField';
import { FormSelect } from '@/components/common/FormSelect';
import type { AdminQuery } from '../../types/admin.types';

export function UserFilters({
  query,
  onChange,
}: {
  query: AdminQuery;
  onChange: (query: AdminQuery) => void;
}) {
  return (
    <div className="grid gap-3 border-y border-outline-variant/40 py-4 md:grid-cols-[minmax(14rem,1fr)_12rem_12rem]">
      <FloatingInput
        id="admin-user-keyword"
        label="Tên hoặc email"
        value={query.keyword || ''}
        onValueChange={(value) => onChange({ ...query, keyword: value, page: 1 })}
      />
      <FormSelect
        id="admin-user-role"
        label="Vai trò"
        value={query.role || ''}
        onValueChange={(value) => onChange({ ...query, role: value, page: 1 })}
      >
        <option value="">Tất cả vai trò</option>
        <option value="CUSTOMER">Khách hàng</option>
        <option value="PROVIDER">Thợ</option>
        <option value="ADMIN">Quản trị viên</option>
      </FormSelect>
      <FormSelect
        id="admin-user-status"
        label="Trạng thái"
        value={query.status || ''}
        onValueChange={(value) => onChange({ ...query, status: value, page: 1 })}
      >
        <option value="">Tất cả trạng thái</option>
        <option value="active">Hoạt động</option>
        <option value="locked">Bị khóa</option>
      </FormSelect>
    </div>
  );
}
