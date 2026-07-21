import axios from "axios";
import { AppError } from "../utils/appError";

type Coordinate = {
  latitude: number;
  longitude: number;
};

type OsrmRouteResponse = {
  code?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: {
      type?: string;
      coordinates?: number[][];
    };
  }>;
};

export type TrackingRoute = {
  distanceMeters: number;
  durationSeconds: number;
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
};

type CacheEntry = {
  expiresAt: number;
  data: TrackingRoute;
};

const DEFAULT_OSRM_BASE_URL = "https://router.project-osrm.org";
const REQUEST_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 30_000;
const MIN_REQUEST_INTERVAL_MS = 1_000;
const MAX_ROUTE_POINTS = 10_000;

const routeCache = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, Promise<TrackingRoute>>();
let requestQueue = Promise.resolve();
let lastRequestStartedAt = 0;

const getOsrmBaseUrl = () =>
  (process.env.OSRM_BASE_URL?.trim() || DEFAULT_OSRM_BASE_URL).replace(
    /\/+$/,
    "",
  );

const coordinateKey = (coordinate: Coordinate) =>
  coordinate.latitude.toFixed(4) + "," + coordinate.longitude.toFixed(4);

const getRouteCacheKey = (origin: Coordinate, destination: Coordinate) =>
  coordinateKey(origin) + "|" + coordinateKey(destination);

const getCachedRoute = (key: string) => {
  const entry = routeCache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    routeCache.delete(key);
    return null;
  }
  return entry.data;
};

const cacheRoute = (key: string, data: TrackingRoute) => {
  routeCache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return data;
};

const enqueueRequest = <T>(task: () => Promise<T>): Promise<T> => {
  const run = requestQueue.then(async () => {
    const waitMs = Math.max(
      0,
      MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestStartedAt),
    );
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    lastRequestStartedAt = Date.now();
    return task();
  });

  requestQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
};

const normalizeRoute = (payload: OsrmRouteResponse): TrackingRoute => {
  const route = payload.routes?.[0];
  const coordinates = route?.geometry?.coordinates;

  if (
    payload.code !== "Ok" ||
    route?.geometry?.type !== "LineString" ||
    !Array.isArray(coordinates) ||
    coordinates.length < 2 ||
    coordinates.length > MAX_ROUTE_POINTS
  ) {
    throw new AppError("Không tìm thấy tuyến đường phù hợp.", 422);
  }

  const normalizedCoordinates = coordinates.map((point) => {
    const longitude = point[0];
    const latitude = point[1];
    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new AppError("Dữ liệu tuyến đường từ OSRM không hợp lệ.", 502);
    }
    return [longitude, latitude] as [number, number];
  });

  if (
    !Number.isFinite(route.distance) ||
    !Number.isFinite(route.duration)
  ) {
    throw new AppError("Dữ liệu tuyến đường từ OSRM không hợp lệ.", 502);
  }

  return {
    distanceMeters: route.distance!,
    durationSeconds: route.duration!,
    geometry: {
      type: "LineString",
      coordinates: normalizedCoordinates,
    },
  };
};

const fetchDrivingRoute = async (
  origin: Coordinate,
  destination: Coordinate,
) => {
  const coordinatePath =
    origin.longitude.toFixed(6) +
    "," +
    origin.latitude.toFixed(6) +
    ";" +
    destination.longitude.toFixed(6) +
    "," +
    destination.latitude.toFixed(6);

  try {
    const response = await axios.get<OsrmRouteResponse>(
      getOsrmBaseUrl() + "/route/v1/driving/" + coordinatePath,
      {
        params: {
          overview: "full",
          geometries: "geojson",
          steps: false,
        },
        headers: {
          Accept: "application/json",
          "User-Agent": "Handigo-Platform/1.0 (order-tracking)",
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
    );
    return normalizeRoute(response.data);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "Dịch vụ tính tuyến đường đang tạm thời gián đoạn.",
      502,
    );
  }
};

export const getDrivingRoute = async (
  origin: Coordinate,
  destination: Coordinate,
) => {
  const cacheKey = getRouteCacheKey(origin, destination);
  const cached = getCachedRoute(cacheKey);
  if (cached) return cached;

  const pending = pendingRequests.get(cacheKey);
  if (pending) return pending;

  const request = enqueueRequest(() => fetchDrivingRoute(origin, destination))
    .then((data) => cacheRoute(cacheKey, data))
    .finally(() => pendingRequests.delete(cacheKey));
  pendingRequests.set(cacheKey, request);
  return request;
};
