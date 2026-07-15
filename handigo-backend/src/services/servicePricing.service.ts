import { Types } from "mongoose";
import type { IService } from "../models/service.model";
import { ServiceOption } from "../models/serviceOption.model";
import { AppError } from "../utils/appError";
import { getNumberConfigValue } from "./systemConfig.service";

const QUOTATION_SERVICE_DEPOSIT_AMOUNT_CONFIG_KEY =
  "QUOTATION_SERVICE_DEPOSIT_AMOUNT";

const normalizeGroup = (value?: string | null) =>
  value?.trim().toLowerCase() || null;

export const buildServicePricingSnapshot = async (
  service: IService,
  selectedOptionIdsInput: unknown = [],
) => {
  if (
    !Array.isArray(selectedOptionIdsInput) ||
    selectedOptionIdsInput.some((id) => typeof id !== "string")
  ) {
    throw new AppError("Danh sách tùy chọn dịch vụ không hợp lệ.", 400);
  }
  const selectedOptionIds = selectedOptionIdsInput as string[];
  if (selectedOptionIds.some((id) => !Types.ObjectId.isValid(id))) {
    throw new AppError("Danh sách tùy chọn dịch vụ không hợp lệ.", 400);
  }

  const uniqueOptionIds = [...new Set(selectedOptionIds)];
  if (uniqueOptionIds.length !== selectedOptionIds.length) {
    throw new AppError("Danh sách tùy chọn dịch vụ bị trùng lặp.", 400);
  }

  const availableOptions = await ServiceOption.find({
    serviceId: service._id,
    isActive: true,
    isDeleted: false,
  }).sort({ sortOrder: 1, createdAt: 1 });
  const selectedIdSet = new Set(uniqueOptionIds);
  const selectedOptions = availableOptions.filter((option) =>
    selectedIdSet.has(option._id.toString()),
  );

  if (selectedOptions.length !== uniqueOptionIds.length) {
    throw new AppError(
      "Có tùy chọn không thuộc dịch vụ này hoặc đã ngừng hoạt động.",
      400,
    );
  }

  const groups = new Map<string, typeof availableOptions>();
  for (const option of availableOptions) {
    const group = normalizeGroup(option.selectionGroup);
    if (!group) continue;
    groups.set(group, [...(groups.get(group) ?? []), option]);
  }

  for (const groupOptions of groups.values()) {
    const selectedInGroup = groupOptions.filter((option) =>
      selectedIdSet.has(option._id.toString()),
    );
    const groupName = groupOptions[0].selectionGroup;
    const selectionMode = groupOptions[0].selectionMode ?? "multiple";
    const isRequired = groupOptions[0].isRequired ?? false;

    if (selectionMode === "single" && selectedInGroup.length > 1) {
      throw new AppError(`Nhóm “${groupName}” chỉ được chọn một tùy chọn.`, 400);
    }
    if (isRequired && selectedInGroup.length === 0) {
      throw new AppError(`Vui lòng chọn một tùy chọn trong nhóm “${groupName}”.`, 400);
    }
  }

  const selectedOptionsSnapshot = selectedOptions.map((option) => ({
    optionId: option._id as Types.ObjectId,
    name: option.name,
    optionType: option.optionType,
    price: option.price,
  }));
  const optionAmount = selectedOptionsSnapshot.reduce(
    (sum, option) => sum + option.price,
    0,
  );
  const defaultDepositAmount = await getNumberConfigValue(
    QUOTATION_SERVICE_DEPOSIT_AMOUNT_CONFIG_KEY,
    0,
  );
  const depositAmount = Math.max(
    service.depositAmount ?? defaultDepositAmount,
    0,
  );
  const bookingAmount =
    service.serviceType === "fixed_price"
      ? Math.max(service.fixedPrice ?? 0, 0) + optionAmount
      : depositAmount;

  return {
    optionIds: selectedOptions.map((option) => option._id as Types.ObjectId),
    selectedOptionsSnapshot,
    bookingAmount,
    depositAmount: service.serviceType === "variable_price" ? depositAmount : 0,
  };
};
