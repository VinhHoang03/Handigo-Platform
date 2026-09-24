import type { FormEvent } from 'react';
import { CategoryIcon } from '@/components/common/CategoryIcon';
import { Modal } from '@/components/common/Modal';
import type { CategoryFormState } from './category.helpers';

interface CategoryFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  form: CategoryFormState;
  busy: boolean;
  onChange: (form: CategoryFormState) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}

/** Modal thêm/sửa danh mục — tách khỏi trang chính để giữ trang dưới 200 dòng. */
export function CategoryFormModal({ open, mode, form, busy, onChange, onClose, onSubmit }: CategoryFormModalProps) {
  return (
    <Modal open={open} title={mode === 'edit' ? 'Sửa danh mục' : 'Thêm danh mục'} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Tên danh mục</span>
          <input
            required
            value={form.name}
            onChange={(event) => onChange({ ...form, name: event.target.value })}
            className="w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Slug</span>
          <input
            value={form.slug}
            onChange={(event) => onChange({ ...form, slug: event.target.value })}
            placeholder="Tự sinh nếu bỏ trống"
            className="w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <div>
          <span className="mb-1 block text-sm font-semibold">Mã icon danh mục hoặc URL ảnh</span>
          <div className="flex gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CategoryIcon icon={form.icon} name={form.name} className="h-7 w-7" />
            </div>
            <input
              value={form.icon}
              onChange={(event) => onChange({ ...form, icon: event.target.value })}
              placeholder="electrical, cleaning, plumbing hoặc https://..."
              className="flex-1 rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Mô tả</span>
          <textarea
            rows={3}
            value={form.description}
            onChange={(event) => onChange({ ...form, description: event.target.value })}
            className="w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <label className="flex items-center justify-between rounded-xl bg-surface-container-low p-3">
          <span className="font-semibold">Hiển thị danh mục</span>
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) => onChange({ ...form, isActive: event.target.checked })}
            className="h-5 w-5 accent-primary"
          />
        </label>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-xl bg-surface-container-high px-5 py-2.5">
            Hủy
          </button>
          <button type="submit" disabled={busy} className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-on-primary disabled:opacity-50">
            {busy ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
