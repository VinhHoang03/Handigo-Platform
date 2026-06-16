import { Address } from "../models/address.model";
// import ServiceRequest from "../models/request.model";

type AddressPayload = {
  fullAddress?: string;
  province?: string;
  ward?: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  isDefault?: boolean;
  note?: string | null;
};

const pickAddressPayload = (data: AddressPayload): AddressPayload => {
  const payload: AddressPayload = {};
  const fields: (keyof AddressPayload)[] = [
    "fullAddress",
    "province",
    "ward",
    "latitude",
    "longitude",
    "placeId",
    "isDefault",
    "note",
  ];

  for (const field of fields) {
    if (data[field] !== undefined) {
      payload[field] = data[field] as never;
    }
  }

  if (payload.placeId === "") delete payload.placeId;
  if (payload.note === "") payload.note = null;

  return payload;
};

export const createAddress = async (userId: string, data: AddressPayload) => {
  const payload = pickAddressPayload(data);

  if (payload.isDefault) {
    await Address.updateMany(
      { userId },
      { isDefault: false }
    );
  }

  const address = await Address.create({
    ...payload,
    userId,
  });

  return address;
};

export const updateAddress = async (
  addressId: string,
  userId: string,
  data: AddressPayload
) => {
  const payload = pickAddressPayload(data);

  if (payload.isDefault) {
    await Address.updateMany(
      { userId },
      { isDefault: false }
    );
  }

  const address = await Address.findOneAndUpdate(
    { _id: addressId, userId },
    payload,
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
