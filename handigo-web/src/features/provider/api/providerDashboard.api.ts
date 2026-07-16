import api from "@/api/client";

export type ProviderAvailabilityStatus = "online" | "offline" | "busy";

interface ProviderOverview {
  availabilityStatus?: ProviderAvailabilityStatus;
}

export interface ProviderEarningPoint {
  day: string;
  amount: number;
  count?: number;
}

export interface ProviderEarnings {
  earningsByDay: ProviderEarningPoint[];
}

const data = <T>(response: { data: { data: T } }) => response.data.data;

export const providerDashboardApi = {
  overview: async () =>
    data<ProviderOverview>(await api.get("/dashboard/overview")),
  earnings: async (fromDate: string, toDate: string) =>
    data<ProviderEarnings>(
      await api.get("/dashboard/earnings", {
        params: { fromDate, toDate, page: 1, limit: 1 },
      }),
    ),
  updateAvailability: async (availabilityStatus: ProviderAvailabilityStatus) =>
    data<{ availabilityStatus: ProviderAvailabilityStatus }>(
      await api.patch("/dashboard/provider/availability", {
        availabilityStatus,
      }),
    ),
  updateCurrentLocation: async (latitude: number, longitude: number) =>
    data(
      await api.put("/locations/me", {
        latitude,
        longitude,
      }),
    ),
};
