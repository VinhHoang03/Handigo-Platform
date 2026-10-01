import { Types } from "mongoose";
import type { IService } from "../models/service.model";
import { ServiceOption } from "../models/serviceOption.model";
import { AppError } from "../utils/appError";
import { getNumberConfigValue } from "./systemConfig.service";
import { getUniformServicePrice } from "../utils/uniformServicePrice";
import { isAirConditionerCleaning } from "../utils/airConditionerCleaning";

const QUOTATION_SERVICE_DEPOSIT_AMOUNT_CONFIG_KEY =
  "QUOTATION_SERVICE_DEPOSIT_AMOUNT";

const normalizeGroup = (value?: string | null) =>
  value?.trim().toLowerCase() || null;

export const previewServiceBooking = async (payload: { serviceId: string; selectedOptionIds?: string[]; selectedOptions?: unknown; orderType?: string }) => {
  const service = await Service.findOne({ _id: payload.serviceId, isActive: true, isDeleted: false });
  if (!service) throw new AppError("Dịch vụ không còn khả dụng.", 404);
  return buildServicePricingSnapshot(service, payload.selectedOptionIds, payload.selectedOptions, payload.orderType ?? "normal");
};

export const buildServicePricingSnapshot = async (
  service: IService,
  selectedOptionIdsInput: unknown = [],
  selectedOptionsInput?: unknown,
  uniformQuantity?: number,
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
  if (selectedOptionsPayload.length > 50) throw new AppError("Chỉ được chọn tối đa 50 tùy chọn dịch vụ.", 400);
  const selectedOptionIds = selectedOptionsPayload.map((item) => item.optionId);
  if (selectedOptionIds.some((id) => !Types.ObjectId.isValid(id))) {
    throw new AppError("Danh sách tùy chọn dịch vụ không hợp lệ.", 400);
  }

  const uniqueOptionIds = [...new Set(selectedOptionIds)];
  if (uniqueOptionIds.length !== selectedOptionIds.length) {
    throw new AppError("Danh sách tùy chọn dịch vụ bị trùng lặp.", 400);
  }

  const isCleaning = isAirConditionerCleaning(service);
  const availableOptions = isCleaning ? [] : await ServiceOption.find({
    serviceId: service._id,
    isActive: true,
    isDeleted: false,
  }).sort({ sortOrder: 1, createdAt: 1 });
  const uniform = getUniformServicePrice(service.serviceType, availableOptions, service.fixedPrice);
  if (isCleaning || uniformQuantity !== undefined || (availableOptions.length === 0 && uniform)) {
    const quantity = uniformQuantity ?? 1;
    if (!uniform || !Number.isInteger(quantity) || quantity < 1 || quantity > 99
      || (!uniform.allowsQuantity && quantity !== 1) || uniqueOptionIds.length > 0
      || (isCleaning && legacySelectedOptionIds.length > 0)) {
      throw new AppError(isCleaning
        ? "Vệ sinh điều hòa cần đơn giá hợp lệ và số lượng nguyên từ 1 đến 99, không kèm tùy chọn."
        : "Dịch vụ không còn áp dụng giá chung cho yêu cầu này. Vui lòng chọn lại tùy chọn phù hợp.", 400);
    }
    const amount = uniform.unitPrice * quantity;
    return {
      optionIds: [] as Types.ObjectId[], selectedOptionsSnapshot: [{
        optionId: null, name: service.name, optionType: "other", price: uniform.unitPrice,
        quantity, subtotal: amount,
      }], bookingAmount: amount, depositAmount: 0
    };
  }
  const selectedIdSet = new Set(uniqueOptionIds);
  const quantityByOptionId = new Map(
    selectedOptionsPayload.map((item) => [item.optionId, item.quantity]),
  );
  let selectedOptions = availableOptions.filter((option) =>
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

  if (selectedOptions.length === 0 && availableOptions.length > 0) {
    const defaultOpt = availableOptions.find((opt) => opt.price > 0) || availableOptions[0];
    selectedOptions = [defaultOpt];
    selectedIdSet.add(defaultOpt._id.toString());
    quantityByOptionId.set(defaultOpt._id.toString(), 1);
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

  if (service.serviceType === "fixed_price" && bookingAmount <= 0 && selectedOptions.length === 0) {
    throw new AppError(
      "Vui lòng chọn ít nhất một tùy chọn có giá cho dịch vụ này.",
      400,
    );
  }

  const policy = await getBookingPolicy();
  const immediateFee = calculateImmediateFee(bookingAmount, service.serviceType === "variable_price", orderType, policy);
  return {
    optionIds: selectedOptions.map((option) => option._id as Types.ObjectId),
    selectedOptionsSnapshot,
    bookingAmount: bookingAmount + immediateFee,
    baseAmount: bookingAmount,
    immediateFee,
    immediateProviderPercent: policy.providerFeePercent,
    minAdvanceMinutes: policy.minAdvanceMinutes,
    paymentHoldMinutes: policy.paymentHoldMinutes,
    schedule: {
      durationMinutes: calculateDuration(service._id.toString(), service.serviceType === "variable_price", selectedOptionsSnapshot, policy),
      bufferMinutes: policy.bufferMinutes,
      travelMinutes: policy.travelMinutes,
    },
    depositAmount: service.serviceType === "variable_price" ? depositAmount : 0,
  };
};
