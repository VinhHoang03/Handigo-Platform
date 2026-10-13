import { Address, IAddress } from "../models/address.model";
import { createHash } from "node:crypto";
import mongoose, { ClientSession } from "mongoose";
import { geocodeSavedAddress } from "./reverseGeocoding.service";
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

const CURRENT_LOCATION_NOTE =
  "Địa chỉ được tạo từ vị trí hiện tại khi đặt dịch vụ.";

// Chỉ tra cứu địa chỉ khách đã chọn khi chưa có tọa độ hợp lệ.
export const ensureAddressCoordinates = async (address: IAddress): Promise<IAddress> => {
  if (Number.isFinite(address.latitude) && Number.isFinite(address.longitude)
    && Math.abs(address.latitude!) <= 90 && Math.abs(address.longitude!) <= 180) {
    return address;
  }
  const coordinates = await geocodeSavedAddress(address);
  const updated = await Address.findOneAndUpdate(
    { _id: address._id, userId: address.userId, updatedAt: address.updatedAt },
    { $set: { latitude: coordinates.latitude, longitude: coordinates.longitude } },
    { new: true, runValidators: true },
  );
  if (!updated) {
    throw new AppError("Địa chỉ vừa được thay đổi. Vui lòng chọn lại địa chỉ và đặt đơn.", 409);
  }
  return updated;
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

const normalizeAddressPart = (value?: string) =>
  value?.trim().toLocaleLowerCase("vi-VN").replace(/\s+/g, " ") || "";

const addressIdentity = (payload: AddressPayload) => createHash("sha256").update(JSON.stringify([
  normalizeAddressPart(payload.fullAddress), normalizeAddressPart(payload.province), normalizeAddressPart(payload.ward),
])).digest("hex");

// Khóa theo chủ sở hữu để không tạo nhiều địa chỉ mặc định khi ghi đồng thời.
const changeAddresses = async <T>(userId: string, work: (session: ClientSession) => Promise<T>) => {
  try {
    return await mongoose.connection.transaction(async session => {
      const owner = await User.updateOne({ _id: userId }, { $inc: { __v: 1 } }, { session, runValidators: true });
      if (!owner.matchedCount) throw new AppError("Không tìm thấy chủ sở hữu địa chỉ.", 404);
      return work(session);
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw new AppError("Địa chỉ này đã tồn tại trong sổ địa chỉ.", 409);
    throw error;
  }
};

// Lấy tọa độ trước khi ghi để không lưu địa chỉ mới với vị trí cũ.
const resolveAddressPayload = async (payload: AddressPayload, current?: IAddress) => {
  const hasCoordinates = (value: AddressPayload) =>
    Number.isFinite(value.latitude) && Number.isFinite(value.longitude)
    && Math.abs(value.latitude!) <= 90 && Math.abs(value.longitude!) <= 180;
  if ((payload.latitude !== undefined || payload.longitude !== undefined)
    && !hasCoordinates(payload)) {
    throw new AppError("Vui lòng cung cấp đầy đủ kinh độ và vĩ độ hợp lệ.", 422);
  }
  const locationChanged = current && (
    (["fullAddress", "province", "ward"] as const).some((field) =>
      payload[field] !== undefined
      && normalizeAddressPart(payload[field]) !== normalizeAddressPart(current[field]))
    || (["provinceCode", "wardCode"] as const).some((field) =>
      payload[field] !== undefined && payload[field] !== current[field])
  );
  const hasNewPin = hasCoordinates(payload) && (!current
    || payload.latitude !== current.latitude || payload.longitude !== current.longitude);
  if (hasNewPin || (!locationChanged && hasCoordinates(current || payload))) return payload;

  const coordinates = await geocodeSavedAddress({
    fullAddress: payload.fullAddress ?? current?.fullAddress ?? "",
    province: payload.province ?? current?.province ?? "",
    ward: payload.ward ?? current?.ward ?? "",
  });
  const resolved = { ...payload, latitude: coordinates.latitude, longitude: coordinates.longitude };
  delete resolved.placeId;
  return resolved;
};

const hasSameAdministrativeUnit = (
  currentCode: number | undefined,
  candidateCode: number | undefined,
  currentName: string,
  candidateName: string | undefined,
) => {
  if (currentCode && candidateCode) return currentCode === candidateCode;
  return normalizeAddressPart(currentName) === normalizeAddressPart(candidateName);
};

const findDuplicateAddress = async (userId: string, payload: AddressPayload, session: ClientSession, excludeId?: string) => {
  const addresses = await Address.find({ userId })
    .select("fullAddress province provinceCode ward wardCode placeId isDeleted updatedAt")
    .sort({ isDeleted: 1, createdAt: -1 }).session(session)
    .lean();

  return addresses.find((address) => {
    if (address._id.toString() === excludeId) return false;
    if (
      payload.placeId &&
      address.placeId &&
      normalizeAddressPart(address.fullAddress) === normalizeAddressPart(payload.fullAddress) &&
      normalizeAddressPart(address.placeId) === normalizeAddressPart(payload.placeId)
    ) {
      return true;
    }

    return (
      normalizeAddressPart(address.fullAddress) === normalizeAddressPart(payload.fullAddress) &&
      hasSameAdministrativeUnit(
        address.provinceCode,
        payload.provinceCode,
        address.province,
        payload.province,
      ) &&
      hasSameAdministrativeUnit(
        address.wardCode,
        payload.wardCode,
        address.ward,
        payload.ward,
      )
    );
  });
};

export const createAddress = async (userId: string, data: AddressPayload) => {
  const payload = await resolveAddressPayload(pickAddressPayload(data));
  return changeAddresses(userId, async session => {
    const duplicate = await findDuplicateAddress(userId, payload, session);
    if (duplicate && !duplicate.isDeleted) {
      if (payload.note === CURRENT_LOCATION_NOTE) return Address.findById(duplicate._id).session(session);
      throw new AppError("Địa chỉ này đã tồn tại trong sổ địa chỉ.", 409);
    }
    if (payload.isDefault) await Address.updateMany({ userId, isDeleted: { $ne: true } }, { $set: { isDefault: false } }, { session, runValidators: true });
    const fields = { ...payload, identityKey: addressIdentity(payload), isDeleted: false, deletedAt: null };
    if (duplicate) {
      const restored = await Address.findOneAndUpdate(
        { _id: duplicate._id, userId, isDeleted: true, updatedAt: duplicate.updatedAt },
        { $set: fields }, { new: true, session, runValidators: true },
      );
      if (!restored) throw new AppError("Địa chỉ vừa thay đổi. Vui lòng thử lại.", 409);
      return restored;
    }
    const [created] = await Address.create([{ ...fields, userId }], { session });
    return created;
  });
};

export const updateAddress = async (addressId: string, userId: string, data: AddressPayload) => {
  const current = await Address.findOne({ _id: addressId, userId, isDeleted: { $ne: true } });
  if (!current) throw new AppError("Không tìm thấy địa chỉ.", 404);
  const payload = await resolveAddressPayload(pickAddressPayload(data), current);
  return changeAddresses(userId, async session => {
    const merged = { ...current.toObject(), ...payload };
    if (await findDuplicateAddress(userId, merged, session, addressId)) throw new AppError("Địa chỉ này đã tồn tại. Hãy chọn hoặc khôi phục địa chỉ đã lưu.", 409);
    if (payload.isDefault) await Address.updateMany({ userId, _id: { $ne: addressId } }, { $set: { isDefault: false } }, { session, runValidators: true });
    const address = await Address.findOneAndUpdate(
      { _id: addressId, userId, isDeleted: { $ne: true }, updatedAt: current.updatedAt },
      { $set: { ...payload, identityKey: addressIdentity(merged) },
        ...(payload.latitude !== undefined && !payload.placeId ? { $unset: { placeId: 1 } } : {}) },
      { new: true, session, runValidators: true },
    );
    if (!address) throw new AppError("Địa chỉ vừa thay đổi. Vui lòng tải lại và thử lại.", 409);
    return address;
  });
};

export const deleteAddress = async (addressId: string, userId: string) => changeAddresses(userId, async session => {
  const address = await Address.findOneAndUpdate({ _id: addressId, userId, isDeleted: { $ne: true } },
    { $set: { isDeleted: true, deletedAt: new Date(), isDefault: false } }, { new: true, session, runValidators: true });
  if (!address) throw new AppError("Không tìm thấy địa chỉ.", 404);
  return address;
});

export const getUserAddresses = async (userId: string) => {
  const [addresses, user] = await Promise.all([
    Address.find({ userId, isDeleted: { $ne: true } }).sort({ createdAt: -1 }).lean(),
    User.findById(userId).select("fullName phone").lean(),
  ]);

  return addresses.map((address) => ({
    ...address,
    recipientName: address.recipientName || user?.fullName || "",
    recipientPhone: address.recipientPhone || user?.phone || "",
  }));
};

export const setDefaultAddress = async (userId: string, addressId: string) => changeAddresses(userId, async session => {
  const exists = await Address.exists({ _id: addressId, userId, isDeleted: { $ne: true } }).session(session);
  if (!exists) throw new AppError("Không tìm thấy địa chỉ.", 404);
  await Address.updateMany({ userId, _id: { $ne: addressId } }, { $set: { isDefault: false } }, { session, runValidators: true });
  return Address.findOneAndUpdate({ _id: addressId, userId, isDeleted: { $ne: true } },
    { $set: { isDefault: true } }, { new: true, session, runValidators: true });
});

export const getServiceHistory = async (_userId: string) => {
  return [];
};

export const checkAddressUpdate = async (
  addressId: string,
  userId: string,
  candidate: AddressPayload,
) => {
  const current = await Address.findOne({ _id: addressId, userId, isDeleted: { $ne: true } }).lean();
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
  return updateAddress(addressId, userId, candidate);
};
