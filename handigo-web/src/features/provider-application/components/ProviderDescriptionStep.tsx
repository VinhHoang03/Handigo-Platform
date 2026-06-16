import { FloatingTextarea } from '@/components/common/FloatingField';
import type { Category, ProviderApplicationPayload } from '../types/providerApplication.types';

export function ProviderDescriptionStep({
  form,
  categories,
  onChange,
}: {
  form: ProviderApplicationPayload;
  categories: Category[];
  onChange: (value: string) => void;
}) {
  const selectedNames = categories
    .filter((category) => form.serviceCategoryIds.includes(category._id))
    .map((category) => category.name);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-headline-md font-bold">Giới thiệu chuyên môn</h2>
        <p className="mt-1 text-on-surface-variant">
          Mô tả kinh nghiệm, thế mạnh và cách bạn phục vụ khách hàng.
        </p>
      </div>

      <FloatingTextarea
        id="provider-description"
        rows={7}
        maxLength={2000}
        label="Tôi có kinh nghiệm..."
        value={form.description}
        onValueChange={onChange}
        hint={`${form.description.length}/2000 ký tự`}
      />

      <div className="space-y-2 rounded-2xl bg-surface-container-low p-4 text-sm">
        <p><b>Kinh nghiệm:</b> {form.experienceYears} năm</p>
        <p><b>Lĩnh vực:</b> {selectedNames.join(', ') || 'Chưa chọn'}</p>
        <p><b>Khu vực:</b> {form.workingAreas.join(', ') || 'Chưa thêm'}</p>
      </div>
    </section>
  );
}
