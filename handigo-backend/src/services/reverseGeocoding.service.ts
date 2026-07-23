import axios from "axios";
import { AppError } from "../utils/appError";
import { createLogger } from "../utils/logger";
import type { ReverseGeocodeQuery } from "../validations/location.validator";

const LOCATIONIQ_URL = "https://us1.locationiq.com/v1/reverse";
const REQUEST_TIMEOUT_MS = 8000;
const MIN_REQUEST_INTERVAL_MS = 1000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 2000;
const reverseGeocodingLogger = createLogger("ReverseGeocoding");

type LocationIqAddress = {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  footway?: string;
  residential?: string;
  neighbourhood?: string;
  quarter?: string;
  suburb?: string;
  locality?: string;
  borough?: string;
  village?: string;
  hamlet?: string;
  municipality?: string;
  city_district?: string;
  district?: string;
  county?: string;
  city?: string;
  town?: string;
  state?: string;
  province?: string;
  region?: string;
  country?: string;
  country_code?: string;
};

type LocationIqResponse = {
  place_id?: number | string;
  osm_type?: string;
  osm_id?: number | string;
  display_name?: string;
  address?: LocationIqAddress;
  error?: string;
};

export type ReverseGeocodedAddress = {
  fullAddress: string;
  province: string;
  ward: string;
  latitude: number;
  longitude: number;
  placeId?: string;
  attribution: string;
};

type CacheEntry = {
  expiresAt: number;
  data: ReverseGeocodedAddress;
};

const cache = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, Promise<ReverseGeocodedAddress>>();
let requestQueue: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

const firstValue = (...values: Array<string | undefined>) =>
  values.find((value) => value?.trim())?.trim() || "";

const getProvinceFromDisplayName = (
  fullAddress: string,
  country?: string,
) => {
  const parts = fullAddress
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const normalizedCountry = country?.trim().toLocaleLowerCase("vi-VN");

  while (parts.length > 0) {
    const lastPart = parts[parts.length - 1];
    const normalizedPart = lastPart.toLocaleLowerCase("vi-VN");
    if (
      normalizedPart === normalizedCountry ||
      normalizedPart === "việt nam" ||
      normalizedPart === "vietnam" ||
      /^\d{4,6}$/.test(lastPart)
    ) {
      parts.pop();
      continue;
    }
    return lastPart;
  }

  return "";
};

const getCacheKey = ({ latitude, longitude }: ReverseGeocodeQuery) =>
  `${latitude.toFixed(4)}:${longitude.toFixed(4)}`;

const getCached = (key: string) => {
  const entry = cache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.data;
};

const setCached = (key: string, data: ReverseGeocodedAddress) => {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
};

const wait = (durationMs: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, durationMs));

const enqueueLocationIqRequest = async <T>(request: () => Promise<T>) => {
  const previousRequest = requestQueue;
  let releaseQueue: () => void = () => undefined;
  requestQueue = new Promise<void>((resolve) => {
    releaseQueue = resolve;
  });

  await previousRequest;
  try {
    const remainingDelay =
      MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt);
    if (remainingDelay > 0) await wait(remainingDelay);
    lastRequestAt = Date.now();
    return await request();
  } finally {
    releaseQueue();
  }
};

const normalizeResponse = (
  response: LocationIqResponse,
  query: ReverseGeocodeQuery,
): ReverseGeocodedAddress => {
  const address = response.address;
  const fullAddress = response.display_name?.trim() || "";
  const provinceFromDisplayName = getProvinceFromDisplayName(
    fullAddress,
    address?.country,
  );
  const province = firstValue(
    address?.state,
    address?.province,
    address?.region,
    provinceFromDisplayName,
    address?.city,
  );
  const ward = firstValue(
    address?.quarter,
    address?.suburb,
    address?.neighbourhood,
    address?.locality,
    address?.village,
    address?.hamlet,
    address?.town,
    address?.municipality,
    address?.borough,
    address?.city_district,
    address?.district,
    address?.county,
    address?.city,
  );

  if (!fullAddress || !province || !ward) {
    throw new AppError(
      "Không xác định được địa chỉ cụ thể từ vị trí hiện tại. Vui lòng chọn địa chỉ đã lưu.",
      422,
    );
  }

  const placeId =
    response.osm_type && response.osm_id
      ? `osm:${response.osm_type}:${response.osm_id}`
      : response.place_id
        ? `locationiq:${response.place_id}`
        : undefined;

  return {
    fullAddress,
    province,
    ward,
    latitude: query.latitude,
    longitude: query.longitude,
    placeId,
    attribution: "© OpenStreetMap contributors | Search by LocationIQ.com",
  };
};

const getLocationIqApiKey = () => {
  const apiKey = process.env.LOCATIONIQ_API_KEY?.trim();
  if (!apiKey) {
    throw new AppError(
      "Dịch vụ xác định địa chỉ chưa được cấu hình.",
      503,
    );
  }
  return apiKey;
};

const fetchFromLocationIq = async (query: ReverseGeocodeQuery) => {
  try {
    const response = await axios.get<LocationIqResponse>(LOCATIONIQ_URL, {
      params: {
        key: getLocationIqApiKey(),
        lat: query.latitude,
        lon: query.longitude,
        format: "json",
        zoom: 18,
        addressdetails: 1,
        "accept-language": "vi",
      },
      headers: {
        Accept: "application/json",
      },
      timeout: REQUEST_TIMEOUT_MS,
    });

    if (response.data.error) {
      throw new AppError(
        "Không tìm thấy địa chỉ phù hợp với vị trí hiện tại.",
        422,
      );
    }
    return normalizeResponse(response.data, query);
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (axios.isAxiosError(error)) {
      reverseGeocodingLogger.error(
        "Không thể lấy địa chỉ từ LocationIQ",
        error,
        {
          status: error.response?.status,
          code: error.code,
        },
      );
    }
    throw new AppError(
      "Dịch vụ xác định địa chỉ đang tạm thời gián đoạn. Vui lòng thử lại sau.",
      502,
    );
  }
};

export const reverseGeocode = async (query: ReverseGeocodeQuery) => {
  const cacheKey = getCacheKey(query);
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const pending = pendingRequests.get(cacheKey);
  if (pending) return pending;

  const request = enqueueLocationIqRequest(() => fetchFromLocationIq(query))
    .then((data) => setCached(cacheKey, data))
    .finally(() => pendingRequests.delete(cacheKey));
  pendingRequests.set(cacheKey, request);
  return request;
};
