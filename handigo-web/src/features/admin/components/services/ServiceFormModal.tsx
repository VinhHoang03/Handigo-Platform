import type { FormEvent, ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import type { Category } from '../../types/categoryService.types';
import { ImageInput } from './ImageInput';
import { FormActions, FormInput, FormTextArea, ToggleRow } from './service-form-fields';
import type { ServiceForm } from './service.helpers';

interface ServiceFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  categories: Category[];
  form: ServiceForm;
  busy: boolean;
  /** Chặn đóng bằng Esc/overlay khi đang xử lý hoặc đang chờ xác nhận bỏ thay đổi. */
  blockClose: boolean;
  onChange: (form: ServiceForm) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  children?: ReactNode;
}

/** Modal thêm/sửa dịch vụ, dùng ở trang quản lý dịch vụ (master-detail). */
export function ServiceFormModal({ open, mode, categories, form, busy, blockClose, onChange, onClose, onSubmit, children }: ServiceFormModalProps) {
  return (
    <Modal open={open} title={mode === 'edit' ? 'Sửa dịch vụ' : 'Thêm dịch vụ mới'} onClose={onClose} closeOnEsc={!blockClose} closeOnOverlayClick={!blockClose} size="lg">
      <form onSubmit={onSubmit} className="space-y-5">
        <fieldset className="rounded-xl border border-outline-variant/40 p-4">
          <legend className="px-2 text-sm font-bold text-primary">Thông tin cơ bản</legend>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,4fr)_minmax(0,6fr)]">
            <div>
              <ImageInput compact value={form.image} onChange={(value) => onChange({ ...form, image: value })} />
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">
                  Danh mục <span className="text-error">*</span>
                </span>
                <select
                  required
                  disabled={mode === 'edit'}
                  name="service-category"
                  value={form.categoryId}
                  onChange={(event) => onChange({ ...form, categoryId: event.target.value })}
                  className="w-full rounded-xl border border-outline-variant bg-surface p-3 disabled:cursor-not-allowed disabled:bg-surface-container-low disabled:text-on-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  <option value="">Chọn danh mục…</option>
                  {categories.map((category) => (
                    <option key={category._id} value={category._id}>{category.name}</option>
                  ))}
                </select>
              </label>
              <FormInput label="Tên dịch vụ" name="service-name" required value={form.name} onChange={(value) => onChange({ ...form, name: value })} />
              <FormInput label="Slug" name="service-slug" value={form.slug} onChange={(value) => onChange({ ...form, slug: value })} placeholder="Tự sinh nếu bỏ trống…" />
            </div>
            <div className="lg:col-span-2">
              <FormTextArea label="Mô tả" name="service-description" value={form.description} onChange={(value) => onChange({ ...form, description: value })} />
            </div>
          </div>
        </fieldset>

        <fieldset className="rounded-xl border border-outline-variant/40 p-4">
          <legend className="px-2 text-sm font-bold text-primary">Giá và vận hành</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="group/price relative mb-1 inline-flex items-center gap-1 text-sm font-semibold">
                Loại giá
                <span className="rounded-full p-0.5 text-on-surface-variant" aria-label="Giải thích loại giá">
                  <CircleAlert aria-hidden="true" size={16} />
                </span>
                <span className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 hidden w-max max-w-sm rounded-md border border-amber-300 bg-amber-100 px-3 py-2 text-xs font-normal text-amber-950 shadow-lg group-hover/price:block">
                  {form.serviceType === 'fixed_price' ? 'Giá dịch vụ được tính từ các tùy chọn bên dưới, không sử dụng giá cơ bản.' : 'Giá linh hoạt sử dụng tiền đặt cọc và không áp dụng giá cố định.'}
                </span>
              </span>
              <select
                name="service-price-type"
                value={form.serviceType}
                onChange={(event) => onChange({ ...form, serviceType: event.target.value as ServiceForm['serviceType'] })}
                className="w-full rounded-xl border border-outline-variant bg-surface p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <option value="fixed_price">Giá cố định</option>
                <option value="variable_price">Giá linh hoạt</option>
              </select>
            </label>
            {form.serviceType === 'variable_price' && (
              <FormInput
                label="Tiền đặt cọc (VNĐ)"
                name="service-deposit-amount"
                type="number"
                required
                value={form.depositAmount}
                onChange={(value) => onChange({ ...form, depositAmount: value })}
              />
            )}
          </div>
          <div className="mt-4">
            <ToggleRow compact checked={form.isActive} onChange={(value) => onChange({ ...form, isActive: value })} label="Hiển thị dịch vụ" name="service-active" />
          </div>
        </fieldset>

        {form.serviceType === 'variable_price' && (
          <ToggleRow
            checked={form.requiresOptionSelection}
            onChange={(value) => onChange({ ...form, requiresOptionSelection: value })}
            label="Bắt buộc chọn ít nhất một tùy chọn"
            name="service-requires-option"
          />
        )}
        {children}
        <FormActions busy={busy} onCancel={onClose} />
      </form>
    </Modal>
  );
}
