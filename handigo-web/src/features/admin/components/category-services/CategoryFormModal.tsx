import type { FormEvent } from 'react';
import { Modal } from '@/components/common/Modal';
import { AssetInput } from './AssetInput';
import { FormActions, FormInput, FormTextArea, ToggleRow } from './category-service-form-fields';
import type { CategoryFormState } from './category-service.helpers';

interface CategoryFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  form: CategoryFormState;
  busy: boolean;
  onChange: (form: CategoryFormState) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}

/** Modal thêm/sửa danh mục. */
export function CategoryFormModal({ open, mode, form, busy, onChange, onClose, onSubmit }: CategoryFormModalProps) {
  return (
    <Modal open={open} title={mode === 'edit' ? 'Sửa danh mục' : 'Thêm danh mục'} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormInput label="Tên danh mục" required value={form.name} onChange={(value) => onChange({ ...form, name: value })} />
        <FormInput label="Slug" value={form.slug} onChange={(value) => onChange({ ...form, slug: value })} placeholder="Tự sinh nếu bỏ trống" />
        <AssetInput
          label="Icon danh mục"
          value={form.icon}
          name={form.name}
          onChange={(value) => onChange({ ...form, icon: value })}
          placeholder="electrical, cleaning, plumbing hoặc https://..."
          mode="icon"
        />
        <FormTextArea label="Mô tả" value={form.description} onChange={(value) => onChange({ ...form, description: value })} />
        <ToggleRow checked={form.isActive} onChange={(value) => onChange({ ...form, isActive: value })} label="Hiển thị danh mục" />
        <FormActions busy={busy} onCancel={onClose} />
      </form>
    </Modal>
  );
}
