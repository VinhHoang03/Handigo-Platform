import api from '@/api/client';
import type { Address, CreateAddressPayload } from '../types/customer.types';

interface BackendAddress {
  _id?: string;
  id?: string;
  fullAddress: string;
  province: string;
  ward: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  isDefault?: boolean;
  note?: string | null;
}

const mapAddress = (address: BackendAddress): Address => ({
  id: address.id || address._id || '',
  fullAddress: address.fullAddress,
  province: address.province,
  ward: address.ward,
  latitude: address.latitude,
  longitude: address.longitude,
  placeId: address.placeId,
  isDefault: address.isDefault,
  note: address.note,
  address: address.fullAddress,
});

const sanitizeAddressPayload = (payload: CreateAddressPayload): CreateAddressPayload => ({
  fullAddress: payload.fullAddress.trim(),
  province: payload.province.trim(),
  ward: payload.ward.trim(),
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
