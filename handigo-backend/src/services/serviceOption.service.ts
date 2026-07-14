import { Types } from "mongoose";
import { Service } from "../models/service.model";
import { ServiceOption } from "../models/serviceOption.model";
import { AppError } from "../utils/appError";

const ensureValidId = (id: string, field = "id") => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${field}`, 400);
  }
};

export const getOptionsByServiceId = async (
  serviceId: string,
  includeInactive = false,
) => {
  ensureValidId(serviceId, "service id");
  return ServiceOption.find({
    serviceId,
    isDeleted: false,
    ...(includeInactive ? {} : { isActive: true }),
  }).sort({
    sortOrder: 1,
    createdAt: 1,
  });
};

interface ServiceOptionInput {
  name?: string;
  description?: string | null;
  optionType?: "room_count" | "area_size" | "package" | "add_on" | "other";
  price?: number;
  selectionGroup?: string | null;
  selectionMode?: "single" | "multiple";
  isRequired?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

const ensureConsistentSelectionGroup = async (
  serviceId: Types.ObjectId | string,
  data: ServiceOptionInput,
  excludeOptionId?: string,
) => {
  const selectionGroup = data.selectionGroup?.trim();
  if (!selectionGroup) {
    if (data.isRequired || data.selectionMode === "single") {
      throw new AppError(
        "Vui lòng nhập tên nhóm khi tùy chọn bắt buộc hoặc chỉ được chọn một.",
        400,
      );
    }
    return;
  }

  const sibling = await ServiceOption.findOne({
    serviceId,
    selectionGroup,
    isDeleted: false,
    ...(excludeOptionId ? { _id: { $ne: excludeOptionId } } : {}),
  }).select("selectionMode isRequired");

  if (
    sibling &&
    (sibling.selectionMode !== (data.selectionMode ?? "multiple") ||
      sibling.isRequired !== (data.isRequired ?? false))
  ) {
    throw new AppError(
      "Các tùy chọn trong cùng một nhóm phải có cùng kiểu chọn và quy tắc bắt buộc.",
      400,
    );
  }
};

const normalizeGroup = (value?: string | null) =>
  value?.trim().toLowerCase() || null;

export const createOption = async (serviceId: string, data: ServiceOptionInput) => {
  ensureValidId(serviceId, "service id");
  const service = await Service.findOne({ _id: serviceId, isDeleted: false });
  if (!service) throw new AppError("Không tìm thấy dịch vụ.", 404);
  await ensureConsistentSelectionGroup(serviceId, data);
  return ServiceOption.create({
    ...data,
    selectionGroup: data.selectionGroup?.trim() || null,
    serviceId,
  });
};

export const updateOption = async (optionId: string, data: ServiceOptionInput) => {
  ensureValidId(optionId, "option id");
  const option = await ServiceOption.findOne({ _id: optionId, isDeleted: false });
  if (!option) throw new AppError("Không tìm thấy tùy chọn dịch vụ.", 404);
  const nextData = {
    ...data,
    selectionGroup:
      data.selectionGroup === undefined
        ? option.selectionGroup
        : data.selectionGroup?.trim() || null,
    selectionMode: data.selectionMode ?? option.selectionMode,
    isRequired: data.isRequired ?? option.isRequired,
  };
  const staysInCurrentGroup =
    normalizeGroup(nextData.selectionGroup) === normalizeGroup(option.selectionGroup);
  if (!staysInCurrentGroup) {
    await ensureConsistentSelectionGroup(option.serviceId, nextData, optionId);
  }
  Object.assign(option, nextData);
  await option.save();

  if (staysInCurrentGroup && nextData.selectionGroup) {
    await ServiceOption.updateMany(
      {
        serviceId: option.serviceId,
        selectionGroup: nextData.selectionGroup,
        isDeleted: false,
        _id: { $ne: option._id },
      },
      {
        $set: {
          selectionMode: nextData.selectionMode,
          isRequired: nextData.isRequired,
        },
      },
      { runValidators: true },
    );
  }

  return option;
};

export const deleteOption = async (optionId: string) => {
  ensureValidId(optionId, "option id");
  const option = await ServiceOption.findOne({ _id: optionId, isDeleted: false });
  if (!option) throw new AppError("Service option not found", 404);
  option.isDeleted = true;
  option.deletedAt = new Date();
  option.isActive = false;
  await option.save();
};
