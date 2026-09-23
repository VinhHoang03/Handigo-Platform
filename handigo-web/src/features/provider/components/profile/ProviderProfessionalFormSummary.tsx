import type { Category } from "@/features/provider-application/types/providerApplication.types";

export function ProfessionalFormSummary({
  categories,
  selectedServiceIds,
}: {
  categories: Category[];
  selectedServiceIds: string[];
}) {
  const selectedServices = categories
    .flatMap((category) => category.services || [])
    .filter((service) => selectedServiceIds.includes(service._id));

  if (selectedServices.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex max-h-28 flex-wrap gap-2 overflow-y-auto pr-1">
      {selectedServices.map((service) => (
        <span
          key={service._id}
          className="max-w-full truncate rounded-lg bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface"
        >
          {service.name}
        </span>
      ))}
    </div>
  );
}
