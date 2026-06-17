import api from "@/api/client";
import type { UserAddress, UserAddressPayload } from "../types/profile.types";

interface BackendAddress {
  _id?: string;
  id?: string;
  fullAddress: string;
  province: string;
  provinceCode?: number;
  ward: string;
  wardCode?: number;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  isDefault?: boolean;
  note?: string | null;
}

const mapAddress = (address: BackendAddress): UserAddress => ({
  id: address.id || address._id || "",
  fullAddress: address.fullAddress,
  province: address.province,
  provinceCode: address.provinceCode,
  ward: address.ward,
  wardCode: address.wardCode,
  latitude: address.latitude,
  longitude: address.longitude,
  placeId: address.placeId,
  isDefault: address.isDefault,
  note: address.note,
});

const sanitizeAddressPayload = (payload: UserAddressPayload): UserAddressPayload => ({
  fullAddress: payload.fullAddress.trim(),
  province: payload.province.trim(),
  provinceCode: payload.provinceCode,
  ward: payload.ward.trim(),
  wardCode: payload.wardCode,
  latitude: payload.latitude,
  longitude: payload.longitude,
  placeId: payload.placeId?.trim() || undefined,
  isDefault: payload.isDefault,
  note: payload.note?.trim() || null,
});

export const getUserAddresses = async (): Promise<UserAddress[]> => {
  const response = await api.get<{ success: boolean; data: BackendAddress[] }>(
    "/addresses",
  );
  return response.data.data.map(mapAddress);
};

export const createUserAddress = async (
  payload: UserAddressPayload,
): Promise<UserAddress> => {
  const response = await api.post<{ success: boolean; data: BackendAddress }>(
    "/addresses",
    sanitizeAddressPayload(payload),
  );
  return mapAddress(response.data.data);
};

export const updateUserAddress = async (
  id: string,
  payload: UserAddressPayload,
): Promise<UserAddress> => {
  const response = await api.put<{ success: boolean; data: BackendAddress }>(
    `/addresses/${id}`,
    sanitizeAddressPayload(payload),
  );
  return mapAddress(response.data.data);
};

export const deleteUserAddress = async (id: string): Promise<void> => {
  await api.delete(`/addresses/${id}`);
};
