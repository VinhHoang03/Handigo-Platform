import { Types } from "mongoose";
import { Service } from "../models/service.model";
import { ServiceOption } from "../models/serviceOption.model";
import { AppError } from "../utils/appError";
import { optionWithGroup } from "../utils/serviceOptionGroups";

const ensureValidId = (id: string, field = "được yêu cầu") => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Định danh ${field} không hợp lệ`, 400);
  }
};

export const getOptionsByServiceId = async (
  serviceId: string,
  includeInactive = false,
) => {
  ensureValidId(serviceId, "dịch vụ");
  const service = await Service.findOne({ _id: serviceId, isDeleted: false });
  if (!service) throw new AppError("Không tìm thấy dịch vụ.", 404);
  const options = await ServiceOption.find({
    serviceId,
    isDeleted: false,
    ...(includeInactive ? {} : { isActive: true }),
  }).sort({
    sortOrder: 1,
    createdAt: 1,
  });
  return options.map(option => ({ ...option.toObject(), ...optionWithGroup(service, option) }));
};

interface ServiceOptionInput {
  groupId?: string | null;
  allowsQuantity?: boolean;
  name?: string;
  description?: string | null;
  image?: string | null;
  optionType?: "room_count" | "area_size" | "package" | "add_on" | "other";
  price?: number;
  selectionGroup?: string | null;
  selectionMode?: "single" | "multiple";
  sortOrder?: number;
  isActive?: boolean;
}

const getSelectionGroupFilter = (selectionGroup: string) => ({
  $regex: `^${selectionGroup.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
  $options: "i",
});

const ensureConsistentSelectionGroup = async (
  serviceId: Types.ObjectId | string,
  data: ServiceOptionInput,
  excludeOptionId?: string,
) => {
  const selectionGroup = data.selectionGroup?.trim();
  if (!selectionGroup) {
    if (data.selectionMode === "single") {
      throw new AppError(
        "Vui lòng nhập tên nhóm khi tùy chọn chỉ được chọn một.",
        400,
      );
    }
    return;
  }

  const sibling = await ServiceOption.findOne({
    serviceId,
    selectionGroup: getSelectionGroupFilter(selectionGroup),
    isDeleted: false,
    ...(excludeOptionId ? { _id: { $ne: excludeOptionId } } : {}),
  }).select("selectionMode");

  if (
    sibling &&
    sibling.selectionMode !== (data.selectionMode ?? "multiple")
  ) {
    throw new AppError(
      "Các tùy chọn trong cùng một nhóm phải có cùng cách lựa chọn.",
      400,
    );
  }
};

const normalizeGroup = (value?: string | null) =>
  value?.trim().toLowerCase() || null;

export const createOption = async (serviceId: string, data: ServiceOptionInput) => {
  ensureValidId(serviceId, "dịch vụ");
  const service = await Service.findOne({ _id: serviceId, isDeleted: false });
  if (!service) throw new AppError("Không tìm thấy dịch vụ.", 404);
  const group = data.groupId ? service.optionGroups?.find(item => item._id.toString() === data.groupId) : null;
  if (data.groupId && !group) throw new AppError("Nhóm tùy chọn không thuộc dịch vụ này.", 400);
  if (!group) await ensureConsistentSelectionGroup(serviceId, data);
  return ServiceOption.create({
    ...data,
    ...(group ? { selectionGroup: group.name, selectionMode: group.selectionMode } : {}),
    price: service.serviceType === "variable_price" ? 0 : data.price,
    selectionGroup: group?.name ?? data.selectionGroup?.trim() ?? null,
    serviceId,
  });
};

export const updateOption = async (optionId: string, data: ServiceOptionInput) => {
  ensureValidId(optionId, "tùy chọn");
  const option = await ServiceOption.findOne({ _id: optionId, isDeleted: false });
  if (!option) throw new AppError("Không tìm thấy tùy chọn dịch vụ.", 404);
  const service = await Service.findOne({
    _id: option.serviceId,
    isDeleted: false,
  });
  if (!service) throw new AppError("Không tìm thấy dịch vụ.", 404);
  const groupId = data.groupId === undefined ? option.groupId?.toString() : data.groupId;
  const group = groupId ? service.optionGroups?.find(item => item._id.toString() === groupId) : null;
  if (groupId && !group) throw new AppError("Nhóm tùy chọn không thuộc dịch vụ này.", 400);
  if (option.groupId && (data.isActive === false || groupId !== option.groupId.toString())) {
    const oldGroup = service.optionGroups?.find(item => item._id.equals(option.groupId!));
    if (service.isActive && oldGroup?.isRequired && !await ServiceOption.exists({
      serviceId: service._id, groupId: option.groupId, _id: { $ne: option._id }, isActive: true, isDeleted: false,
    })) throw new AppError("Không thể bỏ tùy chọn cuối cùng của nhóm bắt buộc đang hoạt động.", 400);
  }
  const nextData = {
    ...data,
    price: data.price ?? option.price,
    selectionGroup:
      data.selectionGroup === undefined
        ? option.selectionGroup
        : data.selectionGroup?.trim() || null,
    selectionMode: group?.selectionMode ?? data.selectionMode ?? option.selectionMode,
  };
  if (group) nextData.selectionGroup = group.name;
  const staysInCurrentGroup =
    normalizeGroup(nextData.selectionGroup) === normalizeGroup(option.selectionGroup);
  if (!group && !staysInCurrentGroup) {
    await ensureConsistentSelectionGroup(option.serviceId, nextData, optionId);
  }
  Object.assign(option, nextData);
  await option.save();

  if (!group && staysInCurrentGroup && nextData.selectionGroup) {
    await ServiceOption.updateMany(
      {
        serviceId: option.serviceId,
        selectionGroup: getSelectionGroupFilter(nextData.selectionGroup),
        isDeleted: false,
        _id: { $ne: option._id },
      },
      {
        $set: {
          selectionMode: nextData.selectionMode,
        },
      },
      { runValidators: true },
    );
  }

  return option;
};

export const deleteOption = async (optionId: string) => {
  ensureValidId(optionId, "tùy chọn");
  const option = await ServiceOption.findOne({ _id: optionId, isDeleted: false });
  if (!option) throw new AppError("Không tìm thấy tùy chọn dịch vụ", 404);
  const service = await Service.findById(option.serviceId);
  const group = service?.optionGroups?.find(item => item._id.toString() === option.groupId?.toString());
  if (service?.isActive && group?.isRequired && !await ServiceOption.exists({
    serviceId: option.serviceId, groupId: option.groupId, _id: { $ne: option._id }, isActive: true, isDeleted: false,
  })) throw new AppError("Không thể xóa tùy chọn cuối cùng của nhóm bắt buộc đang hoạt động.", 400);
  option.isDeleted = true;
  option.deletedAt = new Date();
  option.isActive = false;
  await option.save();
};
