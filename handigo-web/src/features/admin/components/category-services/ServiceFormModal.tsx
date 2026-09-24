import type { FormEvent } from 'react';
import { Modal } from '@/components/common/Modal';
import { AssetInput } from './AssetInput';
import { FormActions, FormInput, FormTextArea, ToggleRow } from './category-service-form-fields';
import type { ServiceFormState } from './category-service.helpers';

interface ServiceFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  form: ServiceFormState;
  busy: boolean;
  onChange: (form: ServiceFormState) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}

/** Modal thêm/sửa dịch vụ thuộc danh mục đang chọn. */
export function ServiceFormModal({ open, mode, form, busy, onChange, onClose, onSubmit }: ServiceFormModalProps) {
  return (
    <Modal open={open} title={mode === 'edit' ? 'Sửa dịch vụ' : 'Thêm dịch vụ'} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormInput label="Tên dịch vụ" required value={form.name} onChange={(value) => onChange({ ...form, name: value })} />
        <FormInput label="Slug" value={form.slug} onChange={(value) => onChange({ ...form, slug: value })} placeholder="Tự sinh nếu bỏ trống" />
        <AssetInput label="Ảnh dịch vụ" value={form.image} onChange={(value) => onChange({ ...form, image: value })} placeholder="https://..." mode="image" />
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Loại giá</span>
          <select
            value={form.serviceType}
            onChange={(event) => onChange({ ...form, serviceType: event.target.value as ServiceFormState['serviceType'] })}
            className="w-full rounded-xl border border-outline-variant bg-surface p-3"
          >
            <option value="fixed_price">Giá cố định</option>
            <option value="variable_price">Giá linh hoạt</option>
          </select>
        </label>
        {form.serviceType === 'fixed_price' ? (
          <p className="rounded-lg bg-surface-container-low px-3 py-2 text-sm text-on-surface-variant">Giá dịch vụ được tính từ các tùy chọn.</p>
        ) : (
          <FormInput label="Tiền đặt cọc" type="number" required value={form.depositAmount} onChange={(value) => onChange({ ...form, depositAmount: value })} />
        )}
        <FormTextArea label="Mô tả" value={form.description} onChange={(value) => onChange({ ...form, description: value })} />
        <ToggleRow checked={form.isActive} onChange={(value) => onChange({ ...form, isActive: value })} label="Hiển thị dịch vụ" />
        <FormActions busy={busy} onCancel={onClose} />
      </form>
    </Modal>
  );
}
