import type { Service, ServiceOption } from "@/types/booking";

export type ServiceOptionGroup = {
  key: string;
  label: string;
  selectionMode: "single" | "multiple";
  isRequired: boolean;
  options: ServiceOption[];
};

const getGroupKey = (option: ServiceOption) =>
  option.groupId || option.selectionGroup?.trim().toLowerCase() || "__ungrouped__";

export const groupServiceOptions = (
  options: ServiceOption[],
): ServiceOptionGroup[] => {
  const groups = new Map<string, ServiceOptionGroup>();

  for (const option of options) {
    const key = getGroupKey(option);
    const existing = groups.get(key);
    if (existing) {
      existing.isRequired ||= option.isRequired ?? false;
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
      isRequired: option.isRequired ?? false,
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
  options: ServiceOption[] = [],
) => {
  if (!service) return false;
  const definitions = service.optionGroups ?? [];
  if (definitions.length > 0) return definitions.some(group => group.isRequired
    && !options.some(option => option.groupId === group._id && selectedIds.includes(option._id)));
  return Boolean(service.requiresOptionSelection && options.length > 0 && selectedIds.length === 0);
};
