import api from '@/api/client';
import type { Address, CreateAddressPayload } from '../types/customer.types';

interface BackendAddress {
  _id?: string;
  id?: string;
  label: string;
  addressLine: string;
  ward: string;
  district: string;
  city: string;
  isDefault?: boolean;
}

const normalizeAddressType = (label: string): Address['type'] => {
  const normalized = label.toLowerCase();
  if (normalized.includes('home') || normalized.includes('nhà') || normalized.includes('nha')) return 'home';
  if (normalized.includes('office') || normalized.includes('văn phòng') || normalized.includes('van phong')) return 'office';
  return 'other';
};

const mapAddress = (address: BackendAddress): Address => {
  const fullAddress = [
    address.addressLine,
    address.ward,
    address.district,
    address.city,
  ].filter(Boolean).join(', ');

  return {
    id: address.id || address._id || '',
    type: normalizeAddressType(address.label),
    label: address.label,
    addressLine: address.addressLine,
    ward: address.ward,
    district: address.district,
    city: address.city,
    isDefault: address.isDefault,
    address: fullAddress,
  };
};

export const getCustomerAddresses = async (): Promise<Address[]> => {
  const response = await api.get<{ success: boolean; data: BackendAddress[] }>('/addresses');
  return response.data.data.map(mapAddress);
};

export const createCustomerAddress = async (payload: CreateAddressPayload): Promise<Address> => {
  const response = await api.post<{ success: boolean; data: BackendAddress }>('/addresses', payload);
  return mapAddress(response.data.data);
};

export const updateCustomerAddress = async (id: string, payload: CreateAddressPayload): Promise<Address> => {
  const response = await api.put<{ success: boolean; data: BackendAddress }>(`/addresses/${id}`, payload);
  return mapAddress(response.data.data);
};

export const deleteCustomerAddress = async (id: string): Promise<void> => {
  await api.delete(`/addresses/${id}`);
};
