import type { ProviderApplication } from "@/features/provider-application/types/providerApplication.types";

export type ProviderBannerMode = "rejected" | "waiting" | "cta";

const WAITING_PROVIDER_STATUSES: ProviderApplication["status"][] = [
  "pending",
  "resubmitted",
];

export const getProviderBannerMode = (
  application: ProviderApplication | null,
): ProviderBannerMode => {
  if (application?.status === "rejected") return "rejected";
  if (application && WAITING_PROVIDER_STATUSES.includes(application.status)) {
    return "waiting";
  }
  return "cta";
};

export const getProviderBannerStorageKey = (profileId?: string) =>
  `handigo:customer-profile:provider-banner:${profileId || "current"}`;

export const isValidBannerMode = (
  value: string | null,
): value is ProviderBannerMode =>
  value === "rejected" || value === "waiting" || value === "cta";
