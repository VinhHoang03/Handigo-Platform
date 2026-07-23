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

/**
 * Cloudinary chọn định dạng và mức nén theo trình duyệt khi có `f_auto,q_auto`
 * trong đường dẫn. Không có hai tham số này, mọi ảnh dịch vụ được trả về nguyên
 * bản JPEG: Lighthouse đo được 683 KB ảnh cho một lần mở trang danh sách, và
 * nêu đích danh "serve images in next-gen formats" là cơ hội lớn nhất còn lại.
 *
 * Chỉ đổi định dạng và chất lượng, **không** đổi kích thước: ảnh gốc vốn đã
 * khoảng 600px, thêm `w_` chỉ khiến Cloudinary phóng to hoặc làm mềm ảnh trên
 * màn hình mật độ cao.
 */
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

/**
 * Ảnh của dịch vụ, hoặc `null` khi chưa có.
 *
 * Trước đây hàm này nhận thêm `index` và rơi về một trong bốn ảnh Unsplash
 * hotlink khi thiếu ảnh. Hai vấn đề: ảnh chụp thật lệch hẳn tông với bộ minh hoạ
 * 3D của sản phẩm, và tham số `index` khiến người đọc tưởng gọi với index khác
 * sẽ ra ảnh khác. Thực ra dịch vụ có ảnh thì index bị bỏ qua hoàn toàn, nên
 * thư viện ảnh ở trang chi tiết hiện đúng một tấm ba lần.
 *
 * Trả `null` để `ReliableImage` dựng ô giữ chỗ theo token màu của hệ thống.
 */
export const getServiceImage = (service?: Service | null) =>
  normalizeServiceImageUrl(service?.image);

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
