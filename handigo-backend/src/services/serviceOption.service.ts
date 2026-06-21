import { Types } from "mongoose";
import { Service } from "../models/service.model";
import { ServiceOption } from "../models/serviceOption.model";
import { AppError } from "../utils/appError";

const ensureValidId = (id: string, field = "id") => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${field}`, 400);
  }
};

export const getOptionsByServiceId = async (serviceId: string) => {
  ensureValidId(serviceId, "service id");
  return ServiceOption.find({ serviceId, isActive: true, isDeleted: false }).sort({ createdAt: 1 });
};

interface ServiceOptionInput {
  name?: string;
  description?: string | null;
  optionType?: "room_count" | "area_size" | "package" | "add_on" | "other";
  price?: number;
  isActive?: boolean;
}

export const createOption = async (serviceId: string, data: ServiceOptionInput) => {
  ensureValidId(serviceId, "service id");
  const service = await Service.findOne({ _id: serviceId, isDeleted: false });
  if (!service) throw new AppError("Service not found", 404);
  return ServiceOption.create({ ...data, serviceId });
};

export const updateOption = async (optionId: string, data: ServiceOptionInput) => {
  ensureValidId(optionId, "option id");
  const option = await ServiceOption.findOne({ _id: optionId, isDeleted: false });
  if (!option) throw new AppError("Service option not found", 404);
  Object.assign(option, data);
  return option.save();
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
