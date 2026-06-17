import { Types } from "mongoose";
import { ServiceOption } from "../models/serviceOption.model";
import { AppError } from "../utils/appError";

export const getOptionsByServiceId = async (serviceId: string) => {
  if (!Types.ObjectId.isValid(serviceId)) {
    throw new AppError("Invalid service id", 400);
  }
  return ServiceOption.find({ serviceId, isActive: true, isDeleted: false });
};
