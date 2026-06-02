import { Address } from "../models/address.model";
import { Types } from "mongoose";
// import ServiceRequest from "../models/request.model";

export const createAddress = async (userId: string, data: any) => {
  if (data.isDefault) {
    await Address.updateMany(
      { userId },
      { isDefault: false }
    );
  }

  const address = await Address.create({
    ...data,
    userId,
  });

  return address;
};

export const updateAddress = async (
  addressId: string,
  userId: string,
  data: any
) => {
  if (data.isDefault) {
    await Address.updateMany(
      { userId },
      { isDefault: false }
    );
  }

  const address = await Address.findOneAndUpdate(
    { _id: addressId, userId },
    data,
    { new: true }
  );

  return address;
};

export const deleteAddress = async (addressId: string, userId: string) => {
  const result = await Address.findOneAndDelete({
    _id: addressId,
    userId,
  });

  return result;
};

export const getUserAddresses = async (userId: string) => {
  return Address.find({ userId }).sort({ createdAt: -1 });
};

export const setDefaultAddress = async (userId: string, addressId: string) => {
  await Address.updateMany(
    { userId },
    { isDefault: false }
  );

  const address = await Address.findOneAndUpdate(
    { _id: addressId, userId },
    { isDefault: true },
    { new: true }
  );

  return address;
};

export const getServiceHistory = async (_userId: string) => {
  return [];
};
