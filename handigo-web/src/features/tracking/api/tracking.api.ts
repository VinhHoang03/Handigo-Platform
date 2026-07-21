import api from "@/api/client";

export type TrackingRoute = {
  distanceMeters: number;
  durationSeconds: number;
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
};

type TrackingCoordinate = {
  latitude: number;
  longitude: number;
};

export const trackingApi = {
  getOrderRoute: async (
    orderId: string,
    origin: TrackingCoordinate,
    destination: TrackingCoordinate,
    signal?: AbortSignal,
  ) => {
    const response = await api.get<{
      success: boolean;
      data: TrackingRoute;
    }>(`/orders/${orderId}/tracking-route`, {
      signal,
      params: {
        originLatitude: origin.latitude,
        originLongitude: origin.longitude,
        destinationLatitude: destination.latitude,
        destinationLongitude: destination.longitude,
      },
    });
    const data = response.data.data;
    if (
      !data ||
      data.geometry?.type !== "LineString" ||
      !Array.isArray(data.geometry.coordinates) ||
      data.geometry.coordinates.length < 2 ||
      !data.geometry.coordinates.every(
        (point) =>
          Array.isArray(point) &&
          point.length >= 2 &&
          Number.isFinite(point[0]) &&
          Number.isFinite(point[1]),
      ) ||
      !Number.isFinite(data.distanceMeters) ||
      !Number.isFinite(data.durationSeconds)
    ) {
      throw new Error("Dữ liệu tuyến đường không hợp lệ.");
    }
    return data;
  },
};
