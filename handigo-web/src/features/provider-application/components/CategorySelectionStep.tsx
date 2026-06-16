import { AlertCircle, Check } from 'lucide-react';
import { FloatingInput } from '@/components/common/FloatingField';
import type { Category } from '../types/providerApplication.types';

interface Props {
  categories: Category[];
  selectedIds: string[];
  experienceYears: number;
  onToggle: (id: string) => void;
  onExperienceChange: (value: number) => void;
}

export function CategorySelectionStep({
  categories,
  selectedIds,
  experienceYears,
  onToggle,
  onExperienceChange,
}: Props) {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-headline-md font-bold">Lĩnh vực và kinh nghiệm</h2>
        <p className="mt-1 text-on-surface-variant">
          Chọn ít nhất một lĩnh vực bạn có thể cung cấp cho khách hàng.
        </p>
      </div>

      {categories.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {categories.map((category) => {
            const checked = selectedIds.includes(category._id);

            return (
              <label
                key={category._id}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition duration-200 ${
                  checked
                    ? 'border-primary bg-primary/5 shadow-[0_10px_24px_rgba(53,37,205,0.08)]'
                    : 'border-outline-variant bg-surface hover:border-primary/50'
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() => onToggle(category._id)}
                />
                <span
                  className={`grid h-5 w-5 place-items-center rounded-full border transition ${
                    checked ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant'
                  }`}
                >
                  {checked && <Check size={14} />}
                </span>
                <span className="font-semibold text-on-surface">{category.name}</span>
              </label>
            );
          })}
        </div>
      ) : (
        <div className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-800">
          <AlertCircle className="shrink-0" size={20} />
          <p>
            Chưa có lĩnh vực đang hoạt động. Quản trị viên cần tạo hoặc kích hoạt category trước.
          </p>
        </div>
      )}

      <FloatingInput
        id="provider-experience-years"
        type="number"
        min={0}
        max={60}
        label="Số năm kinh nghiệm"
        value={experienceYears}
        onValueChange={(value) => onExperienceChange(Math.min(60, Math.max(0, Number(value))))}
      />
    </section>
  );
}
