import { AlertCircle, Check } from "lucide-react";
import type { Category } from "../types/providerApplication.types";

interface Props {
  categories: Category[];
  selectedIds: string[];
  experienceYears: number;
  onToggle: (id: string) => void;
  onExperienceChange: (value: number) => void;
  showExperience?: boolean;
}

const EXPERIENCE_OPTIONS = [
  { label: "1-2 năm", value: 2 },
  { label: "3-5 năm", value: 5 },
  { label: "Trên 5 năm", value: 6 },
];

const isImageIcon = (icon: string) =>
  /^(https?:)?\/\//i.test(icon) ||
  icon.startsWith("/") ||
  icon.startsWith("data:image/");

const CategoryIcon = ({ icon, name }: { icon?: string; name: string }) => {
  if (!icon) return null;

  if (isImageIcon(icon)) {
    return (
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10">
        <img
          src={icon}
          alt=""
          aria-hidden="true"
          className="h-5 w-5 object-contain"
          loading="lazy"
        />
      </span>
    );
  }

  return (
    <span
      className="material-symbols-outlined text-primary"
      aria-label={`${name} icon`}
    >
      {icon}
    </span>
  );
};

export function CategorySelectionStep({
  categories,
  selectedIds,
  experienceYears,
  onToggle,
  onExperienceChange,
  showExperience = true,
}: Props) {
  const hasServices = categories.some(
    (category) => (category.services || []).length > 0,
  );

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-headline-md font-bold">Dịch vụ và kinh nghiệm</h2>
        <p className="mt-1 text-on-surface-variant">
          Chọn các dịch vụ cụ thể mà bạn có thể cung cấp cho khách hàng.
        </p>
      </div>

      {hasServices ? (
        <div className="space-y-5">
          {categories.map((category) => {
            const services = category.services || [];

            return (
              <div
                key={category._id}
                className="rounded-2xl border border-outline-variant bg-surface p-4"
              >
                <div className="mb-3 flex items-center gap-2">
                  <CategoryIcon icon={category.icon} name={category.name} />
                  <h3 className="font-bold text-on-surface">{category.name}</h3>
                </div>

                {services.length ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {services.map((service) => {
                      const checked = selectedIds.includes(service._id);

                      return (
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={checked}
                          key={service._id}
                          className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition duration-200 ${
                            checked
                              ? "border-primary bg-primary/5 shadow-[0_10px_24px_rgba(53,37,205,0.08)]"
                              : "border-outline-variant bg-surface hover:border-primary/50"
                          }`}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => onToggle(service._id)}
                        >
                          <span
                            className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition ${
                              checked
                                ? "border-primary bg-primary text-on-primary"
                                : "border-outline-variant"
                            }`}
                          >
                            {checked && <Check size={14} />}
                          </span>
                          <span className="font-semibold text-on-surface">
                            {service.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-xl bg-surface-container-low p-3 text-sm text-on-surface-variant">
                    Chưa có dịch vụ đang hoạt động trong lĩnh vực này.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-800">
          <AlertCircle className="shrink-0" size={20} />
          <p>
            Chưa có dịch vụ đang hoạt động. Quản trị viên cần tạo hoặc kích hoạt
            category và service trước.
          </p>
        </div>
      )}

      {showExperience && <div className="space-y-3">
        <div>
          <h3 className="font-bold text-on-surface">Số năm kinh nghiệm</h3>
          <p className="mt-1 text-sm text-on-surface-variant">
            Chọn khoảng thời gian phù hợp nhất với kinh nghiệm làm việc của bạn.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {EXPERIENCE_OPTIONS.map((option) => {
            const checked = experienceYears === option.value;

            return (
              <label
                key={option.value}
                className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition duration-200 ${
                  checked
                    ? "border-primary bg-primary/5 text-primary shadow-[0_10px_24px_rgba(53,37,205,0.08)]"
                    : "border-outline-variant bg-surface text-on-surface hover:border-primary/50 hover:bg-surface-container-low"
                }`}
              >
                <input
                  type="radio"
                  name="provider-experience-years"
                  value={option.value}
                  checked={checked}
                  onChange={() => onExperienceChange(option.value)}
                  className="sr-only"
                />
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition ${
                    checked ? "border-primary" : "border-outline-variant"
                  }`}
                >
                  {checked && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                </span>
                <span className="font-semibold">{option.label}</span>
              </label>
            );
          })}
        </div>
      </div>}
    </section>
  );
}
