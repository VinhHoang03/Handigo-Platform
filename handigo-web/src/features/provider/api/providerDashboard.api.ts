import api from "@/api/client";

export type ProviderAvailabilityStatus = "online" | "offline" | "busy";

interface ProviderOverview {
  availabilityStatus?: ProviderAvailabilityStatus;
}

const data = <T>(response: { data: { data: T } }) => response.data.data;

export const providerDashboardApi = {
  overview: async () =>
    data<ProviderOverview>(await api.get("/dashboard/overview")),
  updateAvailability: async (availabilityStatus: ProviderAvailabilityStatus) =>
    data<{ availabilityStatus: ProviderAvailabilityStatus }>(
      await api.patch("/dashboard/provider/availability", {
        availabilityStatus,
      }),
    ),
};
