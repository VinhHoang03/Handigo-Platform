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
    .flatMap((category) => category.services || [])
    .filter((service) => form.serviceIds.includes(service._id))
    .map((service) => service.name);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-headline-md font-bold">Gioi thieu chuyen mon</h2>
        <p className="mt-1 text-on-surface-variant">
          Mo ta kinh nghiem, the manh va cach ban phuc vu khach hang.
        </p>
      </div>

      <FloatingTextarea
        id="provider-description"
        rows={7}
        maxLength={2000}
        label="Toi co kinh nghiem..."
        value={form.description}
        onValueChange={onChange}
        hint={`${form.description.length}/2000 ky tu`}
      />

      <div className="space-y-2 rounded-2xl bg-surface-container-low p-4 text-sm">
        <p><b>Kinh nghiem:</b> {form.experienceYears} nam</p>
        <p><b>Dich vu:</b> {selectedNames.join(', ') || 'Chua chon'}</p>
        <p><b>Khu vuc:</b> {form.workingAreas.join(', ') || 'Chua them'}</p>
      </div>
    </section>
  );
}
