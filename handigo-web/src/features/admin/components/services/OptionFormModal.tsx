import type { FormEvent } from 'react';
import { Modal } from '@/components/common/Modal';
import type { Service, ServiceOptionSelectionMode, ServiceOptionType } from '../../types/categoryService.types';
import { ImageInput } from './ImageInput';
import { FormActions, FormInput, FormTextArea, ToggleRow } from './service-form-fields';
import { OPTION_TYPE_LABELS, type OptionForm } from './service.helpers';

interface OptionFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  selectedService: Service | null;
  form: OptionForm;
  busy: boolean;
  blockClose: boolean;
  formError: string;
  onChange: (form: OptionForm) => void;
  onClearError: () => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}

/** Modal thêm/sửa tùy chọn dịch vụ. */
export function OptionFormModal({
  open,
  mode,
  selectedService,
  form,
  busy,
  blockClose,
  formError,
  onChange,
  onClearError,
  onClose,
  onSubmit,
}: OptionFormModalProps) {
  return (
    <Modal open={open} title={mode === 'edit' ? 'Sửa tùy chọn' : 'Thêm tùy chọn dịch vụ'} onClose={onClose} closeOnEsc={!blockClose} closeOnOverlayClick={!blockClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        {formError && (
          <div role="alert" className="rounded-xl bg-error/10 px-4 py-3 text-sm font-medium text-error">
            {formError}
          </div>
        )}
        <FormInput label="Tên tùy chọn" name="option-name" required value={form.name} onChange={(value) => onChange({ ...form, name: value })} />
        <FormTextArea label="Mô tả" name="option-description" value={form.description} onChange={(value) => onChange({ ...form, description: value })} />
        <ImageInput value={form.image} onChange={(value) => onChange({ ...form, image: value })} label="Ảnh tùy chọn" inputName="option-image" />
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Loại tùy chọn</span>
          <select
            name="option-type"
            value={form.optionType}
            onChange={(event) => onChange({ ...form, optionType: event.target.value as ServiceOptionType })}
            className="w-full rounded-xl border border-outline-variant bg-surface p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            {Object.entries(OPTION_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-semibold">Nhóm tùy chọn</span>
            <select value={form.groupId} onChange={event => onChange({ ...form, groupId: event.target.value })}
              className="w-full rounded-xl border border-outline-variant bg-surface p-3">
              <option value="">Chưa gán nhóm / nhóm cũ</option>
              {(selectedService?.optionGroups ?? []).map(group => <option key={group._id} value={group._id}>{group.name} · {group.selectionMode === 'single' ? 'Chọn một' : 'Chọn nhiều'}{group.isRequired ? ' · Bắt buộc' : ''}</option>)}
            </select>
          </label>
          {!form.groupId && <><FormInput
            label="Nhóm lựa chọn"
            name="option-selection-group"
            value={form.selectionGroup}
            onChange={(value) => {
              onChange({ ...form, selectionGroup: value });
              onClearError();
            }}
            placeholder="Ví dụ: Quy mô căn hộ"
            required={form.selectionMode === 'single'}
          />
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Cách lựa chọn</span>
            <select
              name="option-selection-mode"
              value={form.selectionMode}
              onChange={(event) => {
                onChange({ ...form, selectionMode: event.target.value as ServiceOptionSelectionMode });
                onClearError();
              }}
              className="w-full rounded-xl border border-outline-variant bg-surface p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <option value="multiple">Được chọn nhiều</option>
              <option value="single">Chỉ chọn một</option>
            </select>
          </label></>}
        </div>
        {selectedService?.serviceType === 'fixed_price' ? (
          <FormInput label="Giá (VNĐ)" name="option-price" type="number" required value={form.price} onChange={(value) => onChange({ ...form, price: value })} />
        ) : (
          <p className="rounded-lg bg-surface-container-low px-3 py-2 text-sm text-on-surface-variant">
            Dịch vụ giá linh hoạt không áp dụng giá riêng cho tùy chọn.
          </p>
        )}
        <ToggleRow
          checked={form.allowsQuantity}
          onChange={(value) => onChange({ ...form, allowsQuantity: value })}
          label="Cho phép khách chọn số lượng"
          name="option-allows-quantity"
        />
        <ToggleRow checked={form.isActive} onChange={(value) => onChange({ ...form, isActive: value })} label="Hiển thị tùy chọn" name="option-active" />
        <FormActions busy={busy} onCancel={onClose} />
      </form>
    </Modal>
  );
}
