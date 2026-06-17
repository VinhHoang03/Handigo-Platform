import api from '@/api/client';

export interface AdministrativeUnit {
  code: number;
  name: string;
  codeName: string;
  divisionType: string;
  parentCode?: number;
}

type AdministrativeUnitResponse = {
  success: boolean;
  data: AdministrativeUnit[];
};

export const getProvinces = async (): Promise<AdministrativeUnit[]> => {
  const response = await api.get<AdministrativeUnitResponse>('/vietnam-addresses/provinces');
  return response.data.data;
};

export const getWardsByProvince = async (provinceCode: number): Promise<AdministrativeUnit[]> => {
  const response = await api.get<AdministrativeUnitResponse>(
    `/vietnam-addresses/provinces/${provinceCode}/wards`,
  );
  return response.data.data;
};
