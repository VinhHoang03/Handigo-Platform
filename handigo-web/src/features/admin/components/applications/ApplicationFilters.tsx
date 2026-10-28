import { FloatingInput } from '@/components/common/FloatingField';
import { AdminDatePicker } from '../shared/AdminDatePicker';
import { FormSelect } from '@/components/common/FormSelect';
import type { Category } from '@/features/provider-application/types/providerApplication.types';
import type { AdminQuery } from '../../types/admin.types';

export function ApplicationFilters({ query, categories, onChange }: {
  query: AdminQuery;
  categories: Category[];
  onChange: (query: AdminQuery) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <FloatingInput
        id="admin-application-keyword"
        type="search"
        label="Tìm theo tên hoặc email"
        containerClassName="sm:col-span-2"
        value={query.keyword || ''}
        onValueChange={(value) => onChange({ ...query, keyword: value, page: 1 })}
      />
      <FormSelect
        id="admin-application-status"
        label="Trạng thái"
        value={query.status || ''}
        onValueChange={(value) => onChange({ ...query, status: value, page: 1 })}
      >
        <option value="">Tất cả trạng thái</option>
        <option value="pending">Chờ duyệt</option>
        <option value="resubmitted">Đã gửi lại</option>
        <option value="approved">Đã duyệt</option>
        <option value="rejected">Từ chối</option>
      </FormSelect>
      <FormSelect
        id="admin-application-type"
        label="Loại đơn"
        value={query.applicationType || ''}
        onValueChange={(value) => onChange({ ...query, applicationType: value, page: 1 })}
      >
        <option value="">Tất cả loại đơn</option>
        <option value="initial">Đăng ký nhà cung cấp</option>
        <option value="service_addition">Bổ sung dịch vụ</option>
      </FormSelect>
      <FormSelect
        id="admin-application-category"
        label="Lĩnh vực"
        value={query.categoryId || ''}
        onValueChange={(value) => onChange({ ...query, categoryId: value, page: 1 })}
      >
        <option value="">Tất cả lĩnh vực</option>
        {categories.map((category) => (
          <option key={category._id} value={category._id}>{category.name}</option>
        ))}
      </FormSelect>
      <AdminDatePicker
        id="admin-application-from-date"
        label="Từ ngày tạo"
        value={query.fromDate || ''}
        max={query.toDate || undefined}
        onChange={(value) => onChange({ ...query, fromDate: value || undefined, page: 1 })}
      />
      <AdminDatePicker
        id="admin-application-to-date"
        label="Đến ngày tạo"
        value={query.toDate || ''}
        min={query.fromDate || undefined}
        onChange={(value) => onChange({ ...query, toDate: value || undefined, page: 1 })}
      />
    </div>
  );
}
