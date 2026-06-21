import api from '@/api/client';

export interface FeaturedProvider {
  id: string;
  user: { id: string; fullName: string; avatar?: string };
  workingAreas: string[];
  serviceArea?: { province?: string; ward?: string };
  services: Array<{ id: string; name: string }>;
  averageRating: number;
  totalFeedbacks: number;
}

export interface LatestFeedback {
  _id: string;
  customerId: { fullName?: string; avatar?: string };
  serviceId: { name?: string };
  rating: number;
  comment?: string;
  providerReply?: { content: string } | null;
}

export interface CatalogSearchResult {
  id: string;
  type: 'category' | 'service' | 'option';
  name: string;
  description?: string | null;
  categoryId?: string;
  serviceId?: string;
}

export const homeApi = {
  featuredProviders: async () => {
    const response = await api.get<{ success: boolean; data: FeaturedProvider[] }>('/providers/featured');
    return response.data.data;
  },
  updateCurrentLocation: async (latitude: number, longitude: number) =>
    api.put('/locations/me', { latitude, longitude }),
  latestFeedbacks: async () => {
    const response = await api.get<{ success: boolean; data: LatestFeedback[] }>('/feedback/latest');
    return response.data.data;
  },
  searchCatalog: async (query: string) => {
    const response = await api.get<{ success: boolean; data: CatalogSearchResult[] }>('/search', {
      params: { q: query, limit: 12 },
    });
    return response.data.data;
  },
};
