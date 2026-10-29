import { FloatingInput } from '@/components/common/FloatingField';
import { FormSelect } from '@/components/common/FormSelect';
import type { FeedbackQuery } from '@/features/feedback/types/feedback.types';
import type { FeedbackList } from '@/features/feedback/types/feedback.types';
import { useEffect, useState } from 'react';
import { categoryServiceApi } from '@/features/admin/api/categoryService.api';
import { AdminToastNotice } from '../shared/AdminToastNotice';

export function AdminFeedbackFilters({
  query,
  onChange,
  stats,
}: {
  query: FeedbackQuery;
  onChange: (query: FeedbackQuery) => void;
  stats?: FeedbackList['moderationStats'];
}) {
  const [categories, setCategories] = useState<{ _id: string; name: string }[]>([]);
  const [categoryError, setCategoryError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    categoryServiceApi.listCategoryIconColors().then((items) => {
      if (active) { setCategories(items); setCategoryError(false); }
    }).catch(() => { if (active) setCategoryError(true); });
    return () => { active = false; };
  }, [attempt]);
  const quickFilters = [
    { label: 'Có hình ảnh', count: stats?.hasImages, active: query.hasImages === true, filter: { hasImages: query.hasImages === true ? undefined : true } },
    { label: 'Thợ chưa phản hồi', count: stats ? stats.total - stats.replied : undefined, active: query.replied === false, filter: { replied: query.replied === false ? undefined : false } },
    { label: 'Dưới 4 sao', count: stats?.lowRating, active: query.ratingBelow === 4, filter: { rating: undefined, ratingBelow: query.ratingBelow === 4 ? undefined : 4 } },
    { label: 'Đã ẩn', count: stats?.hidden, active: query.isVisible === false, filter: { isVisible: query.isVisible === false ? undefined : false } },
    { label: 'Mới nhất', active: query.sort === 'newest', filter: { sort: query.sort === 'newest' ? undefined : 'newest' as const } },
  ];
  return (
    <section className="space-y-3 rounded-2xl border border-outline-variant/40 bg-surface p-3" aria-label="Bộ lọc đánh giá">
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(16rem,2fr)_1fr_1fr_1.4fr]">
      <FloatingInput
        id="admin-feedback-keyword"
        type="search"
        label="Tìm nội dung, tên khách hàng, mã đơn"
        value={query.keyword || ''}
        onValueChange={(value) => onChange({ ...query, keyword: value, page: 1 })}
      />
      <FormSelect
        id="admin-feedback-rating"
        label="Số sao"
        value={query.ratingBelow === 4 ? 'below4' : query.rating || ''}
        onValueChange={(value) => onChange({ ...query, ratingBelow: value === 'below4' ? 4 : undefined, rating: value && value !== 'below4' ? Number(value) : undefined, page: 1 })}
      >
        <option value="">Tất cả số sao</option>
        <option value="below4">Dưới 4 sao</option>
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
        onValueChange={(value) => onChange({ ...query, isVisible: value === '' ? undefined : value === 'true', page: 1 })}
      >
        <option value="">Tất cả trạng thái</option>
        <option value="true">Đang hiển thị</option>
        <option value="false">Đã ẩn</option>
      </FormSelect>
      <FormSelect id="admin-feedback-category" label="Dịch vụ" value={query.categoryId || ''}
        onFocus={() => { if (categoryError) setAttempt(value => value + 1); }} onValueChange={(value) => onChange({ ...query, categoryId: value || undefined, page: 1 })}>
        <option value="">Tất cả danh mục dịch vụ</option>
        {categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
      </FormSelect>
    </div>
    <AdminToastNotice message={categoryError ? 'Không tải được danh mục dịch vụ.' : ''} />
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-on-surface-variant">Lọc nhanh:</span>
      {quickFilters.map(({ label, count, active, filter }) => <button key={label} type="button" aria-pressed={active}
        onClick={() => onChange({ ...query, ...filter, page: 1 })}
        className={`rounded-full border px-3 py-1.5 hover:border-primary focus-visible:outline-2 focus-visible:outline-primary ${active ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant/40 bg-surface-container-low text-on-surface-variant'}`}>
        {label}{count !== undefined && ` (${count})`}
      </button>)}
      <button type="button" className="px-2 py-1.5 text-primary underline" onClick={() => onChange({ page: 1, limit: 30 })}>Xóa bộ lọc</button>
    </div>
    </section>
  );
}
