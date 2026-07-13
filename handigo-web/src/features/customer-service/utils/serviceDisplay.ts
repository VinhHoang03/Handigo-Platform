import type { Category, Service, ServiceOption } from "@/types/booking";

export const fallbackServiceImages = [
  "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1200&q=80",
];

export const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export const getCategoryId = (service: Service) => {
  const category = service.categoryId as unknown;
  if (typeof category === "object" && category && "_id" in category) {
    return String((category as Category)._id);
  }
  return String(service.categoryId || "");
};

export const getCategoryName = (service: Service, categories: Category[]) => {
  const category = service.categoryId as unknown;
  if (typeof category === "object" && category && "name" in category) {
    return String((category as Category).name);
  }
  return categories.find((item) => item._id === getCategoryId(service))?.name || "Dịch vụ";
};

export const normalizeServiceImageUrl = (value?: string | null) => {
  const url = value?.trim();
  if (!url) return null;
  if (/^\/\/res\.cloudinary\.com/i.test(url)) return `https:${url}`;
  if (/^res\.cloudinary\.com/i.test(url)) return `https://${url}`;
  return url.replace(/^http:\/\/res\.cloudinary\.com/i, "https://res.cloudinary.com");
};

export const getServiceImage = (service?: Service | null, index = 0) =>
  normalizeServiceImageUrl(service?.image) || fallbackServiceImages[index % fallbackServiceImages.length];

export const getOptionPrice = (option: ServiceOption) =>
  option.price ?? option.fixedPrice ?? 0;

export const getServicePrice = (service: Service) => {
  if (service.serviceType === "fixed_price") {
    return service.fixedPrice || 0;
  }

  return service.depositAmount || 0;
};
