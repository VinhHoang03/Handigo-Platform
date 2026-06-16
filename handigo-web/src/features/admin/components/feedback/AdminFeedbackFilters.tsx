import { FloatingInput } from '@/components/common/FloatingField';
import { FormSelect } from '@/components/common/FormSelect';
import type { FeedbackQuery } from '@/features/feedback/types/feedback.types';

export function AdminFeedbackFilters({
  query,
  onChange,
}: {
  query: FeedbackQuery;
  onChange: (query: FeedbackQuery) => void;
}) {
  return (
    <div className="grid gap-3 border-y border-outline-variant/40 py-4 md:grid-cols-[minmax(14rem,1fr)_12rem_12rem]">
      <FloatingInput
        id="admin-feedback-keyword"
        label="Tìm nội dung đánh giá"
        value={query.keyword || ''}
        onValueChange={(value) => onChange({ ...query, keyword: value, page: 1 })}
      />
      <FormSelect
        id="admin-feedback-rating"
        label="Số sao"
        value={query.rating || ''}
        onValueChange={(value) => onChange({ ...query, rating: value ? Number(value) : '', page: 1 })}
      >
        <option value="">Tất cả số sao</option>
        {[1, 2, 3, 4, 5].map((value) => (
          <option key={value} value={value}>
            {value} sao
          </option>
        ))}
      </FormSelect>
      <FormSelect
        id="admin-feedback-visible"
        label="Trạng thái"
        value={String(query.isVisible ?? '')}
        onValueChange={(value) => onChange({ ...query, isVisible: value === '' ? '' : value === 'true', page: 1 })}
      >
        <option value="">Tất cả trạng thái</option>
        <option value="true">Đang hiển thị</option>
        <option value="false">Đã ẩn</option>
      </FormSelect>
    </div>
  );
}
