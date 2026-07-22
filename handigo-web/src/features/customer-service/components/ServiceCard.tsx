import { Link } from "react-router-dom";
import { ReliableImage } from "@/components/common/ReliableImage";
import {
  getCategoryName,
  getServiceImage,
  getServicePrice,
  money,
} from "../utils/serviceDisplay";
import type { Category, Service } from "@/types/booking";

interface ServiceCardProps {
  service: Service;
  index: number;
  categories: Category[];
}

/** Thẻ dịch vụ trong lưới danh sách dịch vụ khách hàng. */
export function ServiceCard({ service, index, categories }: ServiceCardProps) {
  const price = getServicePrice(service);
  const isQuoteOnly = price <= 0;

  return (
    <Link
      to={`/customer/services/${service._id}`}
      className="group overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-lowest shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
    >
      <div className="relative h-48 overflow-hidden">
        <ReliableImage
          src={getServiceImage(service, index)}
          alt={service.name}
          loading={index < 3 ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={index < 3 ? "high" : "auto"}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="p-5">
        {/* Nhãn danh mục nay nằm ngoài khung ảnh. Dán chữ đè lên ảnh làm hỏng cả
            hai: ảnh mất một góc, còn chữ thì phải tự chống chọi với nền không
            đoán trước được độ sáng. */}
        <p className="text-xs font-bold uppercase tracking-wide text-secondary">
          {getCategoryName(service, categories)}
        </p>
        <h3 className="mt-2 line-clamp-2 text-xl font-bold leading-tight text-on-surface transition-colors group-hover:text-primary">
          {service.name}
        </h3>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-outline-variant/30 pt-4">
          <div>
            {!isQuoteOnly && (
              <span className="block text-xs text-on-surface-variant">Từ</span>
            )}
            <span className="text-lg font-bold tabular-nums text-primary">
              {isQuoteOnly
                ? service.serviceType === "fixed_price"
                  ? "Theo tùy chọn"
                  : "Báo giá"
                : money.format(price)}
            </span>
          </div>
          <span className="rounded-lg bg-primary/10 px-4 py-2 text-sm font-bold text-primary transition group-hover:bg-primary group-hover:text-on-primary">
            Xem chi tiết
          </span>
        </div>
      </div>
    </Link>
  );
}
