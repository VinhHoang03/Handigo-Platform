import type { FormEvent } from 'react';
import { isAirConditionerCleaning } from '@/utils/airConditionerCleaning';
import { Modal } from '@/components/common/Modal';
import { ImageInput } from '../services/ImageInput';
import { FormActions, FormInput, FormTextArea, ToggleRow } from '../services/service-form-fields';
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
        <FormInput label="Tên dịch vụ" name="service-name" required value={form.name} onChange={(value) => onChange({ ...form, name: value })} />
        <FormInput label="Slug" name="service-slug" value={form.slug} onChange={(value) => onChange({ ...form, slug: value })} placeholder="Tự sinh nếu bỏ trống" />
        <ImageInput label="Ảnh dịch vụ" value={form.image} onChange={(value) => onChange({ ...form, image: value })} />
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Loại giá</span>
          <select
            value={isAirConditionerCleaning(form) ? 'fixed_price' : form.serviceType}
            disabled={isAirConditionerCleaning(form)}
            onChange={(event) => onChange({ ...form, serviceType: event.target.value as ServiceFormState['serviceType'] })}
            className="w-full rounded-xl border border-outline-variant bg-surface p-3"
          >
            <option value="fixed_price">Giá cố định</option>
            <option value="variable_price">Giá linh hoạt</option>
          </select>
        </label>
        {isAirConditionerCleaning(form) ? (
          <FormInput label="Đơn giá mỗi máy (VNĐ)" name="service-fixed-price" type="number" required value={form.fixedPrice}
            onChange={(value) => onChange({ ...form, fixedPrice: value, serviceType: 'fixed_price' })} />
        ) : form.serviceType === 'fixed_price' ? (
          <p className="rounded-lg bg-surface-container-low px-3 py-2 text-sm text-on-surface-variant">Giá dịch vụ được tính từ các tùy chọn.</p>
        ) : (
          <FormInput label="Tiền đặt cọc" name="service-deposit-amount" type="number" required value={form.depositAmount} onChange={(value) => onChange({ ...form, depositAmount: value })} />
        )}
        <FormTextArea label="Mô tả" name="service-description" value={form.description} onChange={(value) => onChange({ ...form, description: value })} />
        <ToggleRow checked={form.isActive} onChange={(value) => onChange({ ...form, isActive: value })} label="Hiển thị dịch vụ" name="service-active" />
        <FormActions busy={busy} onCancel={onClose} />
      </form>
    </Modal>
  );
}
