import { Address } from "../models/address.model";
import User from "../models/user.model";
import { AppError } from "../utils/appError";
// import ServiceRequest from "../models/request.model";

type AddressPayload = {
  recipientName?: string;
  recipientPhone?: string;
  fullAddress?: string;
  province?: string;
  provinceCode?: number;
  ward?: string;
  wardCode?: number;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  isDefault?: boolean;
  note?: string | null;
};

const pickAddressPayload = (data: AddressPayload): AddressPayload => {
  const payload: AddressPayload = {};
  const fields: (keyof AddressPayload)[] = [
    "recipientName",
    "recipientPhone",
    "fullAddress",
    "province",
    "provinceCode",
    "ward",
    "wardCode",
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
    { new: true, runValidators: true }
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
  const [addresses, user] = await Promise.all([
    Address.find({ userId }).sort({ createdAt: -1 }).lean(),
    User.findById(userId).select("fullName phone").lean(),
  ]);

  return addresses.map((address) => ({
    ...address,
    recipientName: address.recipientName || user?.fullName || "",
    recipientPhone: address.recipientPhone || user?.phone || "",
  }));
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

const normalizeAddressPart = (value?: string) =>
  value?.trim().toLocaleLowerCase("vi-VN").replace(/\s+/g, " ") || "";

export const checkAddressUpdate = async (
  addressId: string,
  userId: string,
  candidate: AddressPayload,
) => {
  const current = await Address.findOne({ _id: addressId, userId }).lean();
  if (!current) {
    throw new AppError("Không tìm thấy địa chỉ", 404);
  }

  const nextAddress = pickAddressPayload(candidate);
  const comparableFields: (keyof AddressPayload)[] = [
    "fullAddress",
    "province",
    "provinceCode",
    "ward",
    "wardCode",
    "latitude",
    "longitude",
    "placeId",
  ];
  const hasChanges = comparableFields.some((field) => {
    const oldValue = current[field as keyof typeof current];
    const newValue = nextAddress[field];
    if (typeof oldValue === "string" || typeof newValue === "string") {
      return normalizeAddressPart(String(oldValue || "")) !== normalizeAddressPart(String(newValue || ""));
    }
    return oldValue !== newValue;
  });

  return {
    hasChanges,
    oldAddress: current,
    newAddress: { ...current, ...nextAddress },
    source: "map_candidate",
  };
};

export const confirmAddressUpdate = async (
  addressId: string,
  userId: string,
  candidate: AddressPayload,
) => {
  const address = await Address.findOneAndUpdate(
    { _id: addressId, userId },
    pickAddressPayload(candidate),
    { new: true, runValidators: true },
  );
  if (!address) {
    throw new AppError("Không tìm thấy địa chỉ", 404);
  }
  return address;
};
