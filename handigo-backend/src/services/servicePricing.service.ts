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
  selectedOptionsInput?: unknown,
) => {
  if (
    !Array.isArray(selectedOptionIdsInput) ||
    selectedOptionIdsInput.some((id) => typeof id !== "string")
  ) {
    throw new AppError("Danh sách tùy chọn dịch vụ không hợp lệ.", 400);
  }
  const legacySelectedOptionIds = selectedOptionIdsInput as string[];
  if (
    selectedOptionsInput !== undefined &&
    (!Array.isArray(selectedOptionsInput) ||
      selectedOptionsInput.some(
        (item) =>
          typeof item !== "object" ||
          item === null ||
          typeof (item as { optionId?: unknown }).optionId !== "string" ||
          !Number.isInteger((item as { quantity?: unknown }).quantity) ||
          Number((item as { quantity?: unknown }).quantity) < 1 ||
          Number((item as { quantity?: unknown }).quantity) > 99,
      ))
  ) {
    throw new AppError("Số lượng tùy chọn dịch vụ không hợp lệ.", 400);
  }
  const selectedOptionsPayload = (selectedOptionsInput ?? legacySelectedOptionIds.map(
    (optionId) => ({ optionId, quantity: 1 }),
  )) as Array<{ optionId: string; quantity: number }>;
  const selectedOptionIds = selectedOptionsPayload.map((item) => item.optionId);
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
  const quantityByOptionId = new Map(
    selectedOptionsPayload.map((item) => [item.optionId, item.quantity]),
  );
  const selectedOptions = availableOptions.filter((option) =>
    selectedIdSet.has(option._id.toString()),
  );

  if (selectedOptions.length !== uniqueOptionIds.length) {
    throw new AppError(
      "Có tùy chọn không thuộc dịch vụ này hoặc đã ngừng hoạt động.",
      400,
    );
  }

  const optionWithInvalidQuantity = selectedOptions.find(
    (option) =>
      !option.allowsQuantity &&
      (quantityByOptionId.get(option._id.toString()) ?? 1) !== 1,
  );
  if (optionWithInvalidQuantity) {
    throw new AppError(
      `Tùy chọn “${optionWithInvalidQuantity.name}” không cho phép chọn số lượng.`,
      400,
    );
  }

  if (service.requiresOptionSelection && selectedOptions.length === 0) {
    throw new AppError("Vui lòng chọn ít nhất một tùy chọn dịch vụ.", 400);
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
    const selectionMode = groupOptions.some(
      (option) => (option.selectionMode ?? "multiple") === "multiple",
    )
      ? "multiple"
      : "single";

    if (selectionMode === "single" && selectedInGroup.length > 1) {
      throw new AppError(`Nhóm “${groupName}” chỉ được chọn một tùy chọn.`, 400);
    }
  }

  const selectedOptionsSnapshot = selectedOptions.map((option) => {
    const price = service.serviceType === "variable_price" ? 0 : option.price;
    const quantity = quantityByOptionId.get(option._id.toString()) ?? 1;
    return {
      optionId: option._id as Types.ObjectId,
      name: option.name,
      optionType: option.optionType,
      price,
      quantity,
      subtotal: price * quantity,
    };
  });
  const optionAmount = selectedOptionsSnapshot.reduce(
    (sum, option) => sum + option.subtotal,
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
      ? optionAmount
      : depositAmount;

  if (service.serviceType === "fixed_price" && bookingAmount <= 0) {
    throw new AppError(
      "Vui lòng chọn ít nhất một tùy chọn có giá cho dịch vụ này.",
      400,
    );
  }

  return {
    optionIds: selectedOptions.map((option) => option._id as Types.ObjectId),
    selectedOptionsSnapshot,
    bookingAmount,
    depositAmount: service.serviceType === "variable_price" ? depositAmount : 0,
  };
};
