import api from "@/api/client";
import { unwrap } from "@/api/response";
import {
  serviceCatalogApi,
  type ServiceCatalogQuery,
} from "./serviceCatalog.api";

export type CustomerServiceQuery = ServiceCatalogQuery;

export interface NearbyProvider {
  id: string;
  user: {
    id: string;
    fullName: string;
    avatar?: string | null;
  };
  services: Array<{
    id: string;
    name: string;
  }>;
  workingAreas: string[];
  serviceArea?: {
    province?: string;
    ward?: string;
  };
  availabilityStatus: "online" | "offline" | "busy";
  averageRating: number;
  totalFeedbacks: number;
  totalCompletedOrders: number;
  distanceMeters: number;
}

export interface PublicProviderProfile {
  user: {
    id: string;
    fullName: string;
    avatar?: string | null;
    joinedAt?: string;
  };
  provider: {
    id: string;
    description: string;
    bio?: string;
    mainServiceText?: string;
    experienceYears: number;
    availabilityStatus: "online" | "offline" | "busy";
    verified: boolean;
    services: Array<{
      id: string;
      name: string;
      slug?: string;
    }>;
    workingAreas: string[];
    serviceArea?: {
      province?: string;
      ward?: string;
    };
    averageRating: number;
    totalFeedbacks: number;
    totalCompletedOrders: number;
    identityVerified: boolean;
    certificates: Array<{
      id: string;
      title: string;
      issuer?: string;
      issuedAt?: string;
      expiresAt?: string;
      imageUrls: string[];
      description?: string;
      status: "approved" | "pending" | "rejected";
    }>;
  };
  feedbacks: Array<{
    id: string;
    rating: number;
    comment?: string | null;
    images: string[];
    createdAt: string;
    customer: {
      fullName: string;
      avatar?: string | null;
    };
    service: {
      name: string;
      image?: string | null;
    };
    providerReply?: {
      content: string;
      repliedAt: string;
    } | null;
  }>;
}

export const customerServiceApi = {
  categories: serviceCatalogApi.categories,
  services: (query: CustomerServiceQuery = {}) => serviceCatalogApi.services(query),
  serviceById: serviceCatalogApi.serviceById,
  options: serviceCatalogApi.options,

  nearbyProviders: async (
    serviceId: string,
    addressId: string,
    scheduledAt?: string,
    recurrenceUnit?: "weekly" | "monthly",
    recurrenceCount?: number,
  ) =>
    unwrap<NearbyProvider[]>(
      await api.get("/providers/nearby", {
        params: { serviceId, addressId, scheduledAt, recurrenceUnit, recurrenceCount },
      }),
    ),

  publicProviderProfile: async (providerId: string) =>
    unwrap<PublicProviderProfile>(await api.get(`/providers/${providerId}/public`)),
};
