import type { Category, Service, ServiceOption } from "@/types/booking";

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

/** Tối ưu định dạng/nén khi phân phối, giữ nguyên kích thước và tỉ lệ ảnh. */
const CLOUDINARY_DELIVERY = "f_auto,q_auto";

const withCloudinaryDelivery = (url: string) => {
  if (!/res\.cloudinary\.com/i.test(url)) return url;
  // Đã có sẵn khối biến đổi thì để nguyên, tránh chồng tham số mâu thuẫn.
  if (/\/upload\/[^/]*(f_auto|q_auto|c_|w_\d)/i.test(url)) return url;
  return url.replace("/upload/", `/upload/${CLOUDINARY_DELIVERY}/`);
};

export const normalizeServiceImageUrl = (value?: string | null) => {
  const url = value?.trim();
  if (!url) return null;
  if (/^\/\/res\.cloudinary\.com/i.test(url)) return withCloudinaryDelivery(`https:${url}`);
  if (/^res\.cloudinary\.com/i.test(url)) return withCloudinaryDelivery(`https://${url}`);
  return withCloudinaryDelivery(
    url.replace(/^http:\/\/res\.cloudinary\.com/i, "https://res.cloudinary.com"),
  );
};

/** Cover chuẩn; dữ liệu cũ dùng image, thiếu ảnh trả null cho placeholder. */
export const getServiceImage = (service?: Service | null) =>
  normalizeServiceImageUrl(service?.coverImage === undefined ? service?.image : service.coverImage);

export const getOptionPrice = (option: ServiceOption) =>
  option.price ?? option.fixedPrice ?? 0;

/**
 * Giá trị dùng để **sắp xếp** danh sách dịch vụ.
 *
 * ⚠️ Không dùng cho hiển thị. Với `variable_price`, hàm trả về **tiền cọc**, mà
 * tiền cọc không phải giá dịch vụ. Muốn hiện giá thì dùng `getServicePriceLabel`.
 */
export const getServiceSortValue = (service: Service) => {
  if (service.serviceType === "fixed_price") {
    return service.minOptionPrice || service.fixedPrice || 0;
  }
  return service.depositAmount || 0;
};

/**
 * Nhãn giá của một dịch vụ, kèm ngữ nghĩa để nơi hiển thị không phải đoán.
 *
 * `variable_price` nghĩa là giá chỉ chốt được sau khi thợ khảo sát. Trước đây
 * thẻ dịch vụ in `Từ ` + `depositAmount`, tức là trình bày **tiền cọc** như thể
 * đó là mức giá thấp nhất: khách nhìn "Chuyển Nhà · Từ 20.000đ" và hiểu là
 * chuyển nhà giá 20 nghìn. Đó là hiểu nhầm về tiền, không phải lỗi trình bày.
 */
export type ServicePriceLabel =
  | { kind: "from"; amount: number }
  | { kind: "exact"; amount: number }
  | { kind: "quote"; deposit: number }
  | { kind: "unknown" };

export const getServicePriceLabel = (service: Service): ServicePriceLabel => {
  if (service.serviceType === "fixed_price") {
    if (service.minOptionPrice) return { kind: "from", amount: service.minOptionPrice };
    if (service.fixedPrice) return { kind: "exact", amount: service.fixedPrice };
    return { kind: "unknown" };
  }
  return { kind: "quote", deposit: service.depositAmount || 0 };
};

/** Dòng chữ chính của nhãn giá. */
export const formatServicePrice = (label: ServicePriceLabel) => {
  switch (label.kind) {
    case "from":
      return `Từ ${money.format(label.amount)}`;
    case "exact":
      return money.format(label.amount);
    case "quote":
      return "Báo giá sau khảo sát";
    default:
      return "Liên hệ báo giá";
  }
};

/** Dòng phụ dưới nhãn giá, hoặc `null` nếu không có gì cần nói thêm. */
export const formatServicePriceNote = (label: ServicePriceLabel) =>
  label.kind === "quote" && label.deposit > 0
    ? `Đặt cọc ${money.format(label.deposit)}`
    : null;
