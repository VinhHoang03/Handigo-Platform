import { FloatingInput } from '@/components/common/FloatingField';
import { FormSelect } from '@/components/common/FormSelect';
import type { Category } from '@/features/provider-application/types/providerApplication.types';
import type { AdminQuery } from '../../types/admin.types';

export function ApplicationFilters({
  query,
  categories,
  onChange,
}: {
  query: AdminQuery;
  categories: Category[];
  onChange: (query: AdminQuery) => void;
}) {
  return (
    <div className="grid gap-3 border-y border-outline-variant/40 py-4 lg:grid-cols-[minmax(14rem,1fr)_12rem_minmax(12rem,16rem)]">
      <FloatingInput
        id="admin-application-keyword"
        label="Tên hoặc email"
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
        <option value="approved">Đã duyệt</option>
        <option value="rejected">Từ chối</option>
      </FormSelect>
      <FormSelect
        id="admin-application-category"
        label="Lĩnh vực"
        value={query.categoryId || ''}
        onValueChange={(value) => onChange({ ...query, categoryId: value, page: 1 })}
      >
        <option value="">Tất cả lĩnh vực</option>
        {categories.map((category) => (
          <option key={category._id} value={category._id}>
            {category.name}
          </option>
        ))}
      </FormSelect>
    </div>
  );
}
