import { Search } from 'lucide-react';
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
    <div className="application-filters grid gap-4 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 sm:grid-cols-2 xl:grid-cols-12">
      <label htmlFor="admin-application-keyword" className="min-w-0 sm:col-span-2 xl:col-span-6">
        <span className="application-filter-label">Tìm kiếm</span>
        <span className="relative block">
          <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input id="admin-application-keyword" name="keyword" type="search" autoComplete="off" className="application-search" placeholder="Tìm theo tên hoặc email…"
            value={query.keyword || ''} onChange={event => onChange({ ...query, keyword: event.target.value, page: 1 })} />
        </span>
      </label>
      <FormSelect
        id="admin-application-status"
        label="Trạng thái"
        className="xl:col-span-3"
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
        className="xl:col-span-3"
        value={query.applicationType || ''}
        onValueChange={(value) => onChange({ ...query, applicationType: value, page: 1 })}
      >
        <option value="">Tất cả loại đơn</option>
        <option value="initial">Đăng ký nhà cung cấp</option>
        <option value="service_addition">Bổ sung dịch vụ</option>
      </FormSelect>
      <FormSelect
        id="admin-application-category"
        label="Lĩnh vực chuyên môn"
        className="xl:col-span-4"
        value={query.categoryId || ''}
        onValueChange={(value) => onChange({ ...query, categoryId: value, page: 1 })}
      >
        <option value="">Tất cả lĩnh vực</option>
        {categories.map((category) => (
          <option key={category._id} value={category._id}>{category.name}</option>
        ))}
      </FormSelect>
      <div className="application-filter-date xl:col-span-4"><AdminDatePicker
        id="admin-application-from-date"
        label="Từ ngày tạo"
        value={query.fromDate || ''}
        max={query.toDate || undefined}
        onChange={(value) => onChange({ ...query, fromDate: value || undefined, page: 1 })}
      /></div>
      <div className="application-filter-date xl:col-span-4"><AdminDatePicker
        id="admin-application-to-date"
        label="Đến ngày tạo"
        value={query.toDate || ''}
        min={query.fromDate || undefined}
        onChange={(value) => onChange({ ...query, toDate: value || undefined, page: 1 })}
      /></div>
    </div>
  );
}
