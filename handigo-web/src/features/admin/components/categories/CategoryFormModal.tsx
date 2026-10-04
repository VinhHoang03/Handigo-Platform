import type { FormEvent } from 'react';
import { CategoryIconPicker } from './CategoryIconPicker';
import { Modal } from '@/components/common/Modal';
import type { CategoryFormState } from './category.helpers';

interface CategoryFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  form: CategoryFormState;
  busy: boolean;
  error?: string;
  colorLoading?: boolean;
  colorError?: string;
  unavailableIconColors?: Record<string, string>;
  onReloadColors?: () => void;
  onChange: (form: CategoryFormState) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}

/** Modal thêm/sửa danh mục — tách khỏi trang chính để giữ trang dưới 200 dòng. */
export function CategoryFormModal({
  open, mode, form, busy, error, colorLoading = false, colorError,
  unavailableIconColors = {}, onReloadColors, onChange, onClose, onSubmit,
}: CategoryFormModalProps) {
  const colorConflict = unavailableIconColors[form.iconColor.toLowerCase()];
  return (
    <Modal open={open} title={mode === 'edit' ? 'Sửa danh mục' : 'Thêm danh mục'} onClose={() => { if (!busy) onClose(); }} closeOnEsc={!busy} closeOnOverlayClick={!busy}>
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <p role="alert" className="rounded-xl bg-error/10 p-3 text-sm text-error">{error}</p>}
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Tên danh mục</span>
          <input
            required
            disabled={busy}
            value={form.name}
            onChange={(event) => onChange({ ...form, name: event.target.value })}
            className="w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Slug</span>
          <input
            disabled={busy}
            value={form.slug}
            onChange={(event) => onChange({ ...form, slug: event.target.value })}
            placeholder="Tự sinh nếu bỏ trống"
            className="w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <CategoryIconPicker
          icon={form.icon}
          color={form.iconColor}
          name={form.name}
          disabled={busy || colorLoading || Boolean(colorError)}
          unavailableColors={unavailableIconColors}
          onChange={(icon, iconColor) => onChange({ ...form, icon, iconColor })}
        />
        {colorLoading && <p role="status" className="text-sm text-on-surface-variant">Đang kiểm tra màu đã dùng...</p>}
        {colorError && (
          <div role="alert" className="rounded-xl bg-error/10 p-3 text-sm text-error">
            {colorError}
            <button type="button" onClick={onReloadColors} className="ml-2 font-semibold underline">Thử lại</button>
          </div>
        )}
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Mô tả</span>
          <textarea
            disabled={busy}
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
            disabled={busy}
            checked={form.isActive}
            onChange={(event) => onChange({ ...form, isActive: event.target.checked })}
            className="h-5 w-5 accent-primary"
          />
        </label>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-xl bg-surface-container-high px-5 py-2.5">
            Hủy
          </button>
          <button type="submit" disabled={busy || colorLoading || Boolean(colorError) || Boolean(colorConflict) || !form.iconColor} className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-on-primary disabled:opacity-50">
            {busy ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
