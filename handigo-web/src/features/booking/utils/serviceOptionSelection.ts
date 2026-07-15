import type { ServiceOption } from "@/types/booking";

export type ServiceOptionGroup = {
  key: string;
  label: string;
  selectionMode: "single" | "multiple";
  isRequired: boolean;
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
    return option.isRequired
      ? selectedIds
      : selectedIds.filter((id) => id !== option._id);
  }

  if ((option.selectionMode ?? "multiple") !== "single") {
    return [...selectedIds, option._id];
  }

  const groupKey = getGroupKey(option);
  const siblingIds = new Set(
    allOptions
      .filter((candidate) => getGroupKey(candidate) === groupKey)
      .map((candidate) => candidate._id),
  );
  return [...selectedIds.filter((id) => !siblingIds.has(id)), option._id];
};

export const getMissingRequiredGroup = (
  selectedIds: string[],
  options: ServiceOption[],
) =>
  groupServiceOptions(options).find(
    (group) =>
      group.isRequired &&
      !group.options.some((option) => selectedIds.includes(option._id)),
  );
