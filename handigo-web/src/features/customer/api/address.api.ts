import api from '@/api/client';
import type { Address, CreateAddressPayload } from '../types/customer.types';

interface BackendAddress {
  _id?: string;
  id?: string;
  recipientName?: string;
  recipientPhone?: string;
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

const mapAddress = (address: BackendAddress): Address => ({
  id: address.id || address._id || '',
  recipientName: address.recipientName,
  recipientPhone: address.recipientPhone,
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
  address: address.fullAddress,
});

const sanitizeAddressPayload = (payload: CreateAddressPayload): CreateAddressPayload => ({
  recipientName: payload.recipientName.trim(),
  recipientPhone: payload.recipientPhone.trim(),
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

export const getCustomerAddresses = async (): Promise<Address[]> => {
  const response = await api.get<{ success: boolean; data: BackendAddress[] }>('/addresses');
  return response.data.data.map(mapAddress);
};

export const createCustomerAddress = async (payload: CreateAddressPayload): Promise<Address> => {
  const response = await api.post<{ success: boolean; data: BackendAddress }>('/addresses', sanitizeAddressPayload(payload));
  return mapAddress(response.data.data);
};

export const updateCustomerAddress = async (id: string, payload: CreateAddressPayload): Promise<Address> => {
  const response = await api.put<{ success: boolean; data: BackendAddress }>(`/addresses/${id}`, sanitizeAddressPayload(payload));
  return mapAddress(response.data.data);
};

export const deleteCustomerAddress = async (id: string): Promise<void> => {
  await api.delete(`/addresses/${id}`);
};
