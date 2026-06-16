import axios from "axios";

const BASE_URL = "https://provinces.open-api.vn/api/v2";
const REQUEST_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CacheEntry<T> = {
  expiresAt: number;
  data: T;
};

type ExternalProvince = {
  name: string;
  code: number;
  division_type: string;
  codename: string;
  phone_code?: number;
  wards?: ExternalWard[];
};

type ExternalWard = {
  name: string;
  code: number;
  division_type: string;
  codename: string;
  province_code: number;
};

export type AdministrativeUnit = {
  code: number;
  name: string;
  codeName: string;
  divisionType: string;
  parentCode?: number;
};

const cache = new Map<string, CacheEntry<unknown>>();

const getCached = <T>(key: string): T | null => {
  const entry = cache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry.data as T;
};

const setCached = <T>(key: string, data: T): T => {
  cache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return data;
};

const fetchExternal = async <T>(path: string): Promise<T> => {
  const response = await axios.get<T>(`${BASE_URL}${path}`, {
    timeout: REQUEST_TIMEOUT_MS,
  });

  return response.data;
};

const normalizeProvince = (province: ExternalProvince): AdministrativeUnit => ({
  code: province.code,
  name: province.name,
  codeName: province.codename,
  divisionType: province.division_type,
});

const normalizeWard = (ward: ExternalWard): AdministrativeUnit => ({
  code: ward.code,
  name: ward.name,
  codeName: ward.codename,
  divisionType: ward.division_type,
  parentCode: ward.province_code,
});

const wrapExternalError = (error: unknown): Error & { statusCode?: number } => {
  const wrapped = new Error("Cannot load Vietnam administrative data") as Error & {
    statusCode?: number;
  };
  wrapped.statusCode = 502;

  if (axios.isAxiosError(error)) {
    wrapped.message = error.response
      ? "Vietnam administrative API returned an error"
      : "Vietnam administrative API is unavailable";
  }

  return wrapped;
};

export const getProvinces = async (): Promise<AdministrativeUnit[]> => {
  const cacheKey = "provinces";
  const cached = getCached<AdministrativeUnit[]>(cacheKey);
  if (cached) return cached;

  try {
    const provinces = await fetchExternal<ExternalProvince[]>("/p/");
    return setCached(cacheKey, provinces.map(normalizeProvince));
  } catch (error) {
    throw wrapExternalError(error);
  }
};

export const getWardsByProvince = async (
  provinceCode: number,
): Promise<AdministrativeUnit[]> => {
  const cacheKey = `province:${provinceCode}:wards`;
  const cached = getCached<AdministrativeUnit[]>(cacheKey);
  if (cached) return cached;

  try {
    const province = await fetchExternal<ExternalProvince>(
      `/p/${provinceCode}?depth=2`,
    );
    return setCached(cacheKey, (province.wards || []).map(normalizeWard));
  } catch (error) {
    throw wrapExternalError(error);
  }
};
