import type { Service, ServiceOption } from "@/types/booking";

export type ServiceOptionGroup = {
  key: string;
  label: string;
  selectionMode: "single" | "multiple";
  options: ServiceOption[];
};

const getGroupKey = (option: ServiceOption) =>
  option.selectionGroup?.trim().toLowerCase() || "__ungrouped__";

export const groupServiceOptions = (
  options: ServiceOption[],
): ServiceOptionGroup[] => {
  const groups = new Map<string, ServiceOptionGroup>();

  for (const option of options) {
    const key = getGroupKey(option);
    const existing = groups.get(key);
    if (existing) {
      existing.options.push(option);
      if ((option.selectionMode ?? "multiple") === "multiple") {
        existing.selectionMode = "multiple";
      }
      continue;
    }
    groups.set(key, {
      key,
      label: option.selectionGroup?.trim() || "Dịch vụ bổ sung",
      selectionMode: option.selectionMode ?? "multiple",
      options: [option],
    });
  }

  return [...groups.values()];
};

export const toggleServiceOption = (
  selectedIds: string[],
  option: ServiceOption,
  allOptions: ServiceOption[],
) => {
  const isSelected = selectedIds.includes(option._id);
  if (isSelected) {
    return selectedIds.filter((id) => id !== option._id);
  }

  const groupKey = getGroupKey(option);
  const groupOptions = allOptions.filter(
    (candidate) => getGroupKey(candidate) === groupKey,
  );
  const selectionMode = groupOptions.some(
    (candidate) => (candidate.selectionMode ?? "multiple") === "multiple",
  )
    ? "multiple"
    : "single";

  if (selectionMode === "multiple") {
    return [...selectedIds, option._id];
  }

  const siblingIds = new Set(
    groupOptions.map((candidate) => candidate._id),
  );
  return [...selectedIds.filter((id) => !siblingIds.has(id)), option._id];
};

export const isRequiredOptionSelectionMissing = (
  service: Service | null | undefined,
  selectedIds: string[],
) =>
  Boolean(service?.requiresOptionSelection && selectedIds.length === 0);
