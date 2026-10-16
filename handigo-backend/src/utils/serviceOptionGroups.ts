import type { IService } from "../models/service.model";
import type { IServiceOption } from "../models/serviceOption.model";
import { AppError } from "./appError";

export const getOptionGroupKey = (option: Pick<IServiceOption, "groupId" | "selectionGroup">) =>
  option.groupId?.toString() ?? option.selectionGroup?.trim().toLocaleLowerCase("vi") ?? "__ungrouped__";

export const validateOptionSelection = (
  service: Pick<IService, "optionGroups" | "requiresOptionSelection">,
  options: IServiceOption[],
  selectedIds: Set<string>,
) => {
  const groups = service.optionGroups ?? [];
  for (const group of groups) {
    const members = options.filter(option => option.groupId?.toString() === group._id.toString());
    const count = members.filter(option => selectedIds.has(option._id.toString())).length;
    if (group.isRequired && count === 0) {
      throw new AppError(`Vui lòng chọn tùy chọn trong nhóm “${group.name}”.`, 400);
    }
    if (group.selectionMode === "single" && count > 1) {
      throw new AppError(`Nhóm “${group.name}” chỉ được chọn một tùy chọn.`, 400);
    }
  }
  if (groups.length === 0 && service.requiresOptionSelection && options.length > 0 && selectedIds.size === 0) {
    throw new AppError("Vui lòng chọn tùy chọn dịch vụ trước khi đặt đơn.", 400);
  }
  const legacyGroups = new Map<string, IServiceOption[]>();
  for (const option of options.filter(option => !option.groupId && option.selectionGroup?.trim())) {
    const key = getOptionGroupKey(option);
    legacyGroups.set(key, [...(legacyGroups.get(key) ?? []), option]);
  }
  for (const members of legacyGroups.values()) {
    if (members.every(option => option.selectionMode === "single")
      && members.filter(option => selectedIds.has(option._id.toString())).length > 1) {
      throw new AppError(`Nhóm “${members[0].selectionGroup}” chỉ được chọn một tùy chọn.`, 400);
    }
  }
};

export const optionWithGroup = (service: Pick<IService, "optionGroups">, option: IServiceOption) => {
  const group = service.optionGroups?.find(item => item._id.toString() === option.groupId?.toString());
  return group ? { selectionGroup: group.name, selectionMode: group.selectionMode, isRequired: group.isRequired } : {};
};
