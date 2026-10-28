import type { Order } from "@/types/booking";

export type ProviderInfo = {
  name: string;
  phone?: string;
  avatar?: string | null;
  completedOrders: number;
  rating: number;
  feedbacks: number;
  experienceYears: number;
  verified: boolean;
};

export const getProviderInfo = (order: Order): ProviderInfo | null => {
  if (!order.providerId) return null;
  const p = order.providerId;
  return {
    name: p.userId?.fullName || p.name || "Chuyên gia",
    phone: p.userId?.phone,
    avatar: p.userId?.avatar || p.avatar,
    completedOrders: p.totalCompletedOrders ?? p.completedOrders ?? 0,
    rating: p.averageRating ?? 0,
    feedbacks: p.totalFeedbacks ?? 0,
    experienceYears: p.experienceYears ?? 0,
    verified: p.verified ?? false,
  };
};

export const formatOrderAddress = (order: Order) => {
  const address = order.addressId;
  if (!address) return "";

  return (
    address.fullAddress?.trim() ||
    [address.detailAddress, address.ward, address.district, address.province]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(", ")
  );
};
