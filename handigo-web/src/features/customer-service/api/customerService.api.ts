import api from "@/api/client";
import type { Category, Service, ServiceOption } from "@/types/booking";

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface ListResponse<T> {
  items: T[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CustomerServiceQuery {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  serviceType?: string;
  isActive?: string;
  bookedOnly?: string;
}

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

const unwrap = <T>(response: { data: ApiResponse<T> }) => response.data.data;

export const customerServiceApi = {
  categories: async () =>
    unwrap<Category[]>(await api.get("/categories/active")),

  services: async (query: CustomerServiceQuery = {}) =>
    unwrap<ListResponse<Service>>(
      await api.get("/services", {
        params: { page: 1, limit: 100, isActive: "true", ...query },
      }),
    ),

  serviceById: async (serviceId: string) =>
    unwrap<Service>(await api.get(`/services/${serviceId}`)),

  options: async (serviceId: string) =>
    unwrap<ServiceOption[]>(await api.get(`/services/${serviceId}/options`)),

  nearbyProviders: async (serviceId: string, addressId: string) =>
    unwrap<NearbyProvider[]>(
      await api.get("/providers/nearby", {
        params: { serviceId, addressId },
      }),
    ),

  publicProviderProfile: async (providerId: string) =>
    unwrap<PublicProviderProfile>(await api.get(`/providers/${providerId}/public`)),
};
