import { Link } from "react-router-dom";
import { ReliableImage } from "@/components/common/ReliableImage";
import {
  formatServicePrice,
  formatServicePriceNote,
  getCategoryName,
  getServiceImage,
  getServicePriceLabel,
} from "../utils/serviceDisplay";
import type { Category, Service } from "@/types/booking";
import { ArrowRight } from "lucide-react";

interface ServiceCardProps {
  service: Service;
  index: number;
  categories: Category[];
}

/** Thẻ dịch vụ trong lưới danh sách dịch vụ khách hàng. */
export function ServiceCard({ service, index, categories }: ServiceCardProps) {
  const priceLabel = getServicePriceLabel(service);
  const priceNote = formatServicePriceNote(priceLabel);
  // Chỉ giá thật mới in đậm cỡ lớn. "Báo giá sau khảo sát" là một câu, không
  // phải một con số, nên không dùng cỡ chữ dành cho tiền.
  const isAmount = priceLabel.kind === "from" || priceLabel.kind === "exact";

  return (
    <Link
      to={`/customer/services/${service._id}`}
      className="group overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-lowest shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <ReliableImage
          src={getServiceImage(service)}
          alt={service.name}
          loading={index < 3 ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={index < 3 ? "high" : "auto"}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="p-4">
        {/* Nhãn danh mục nay nằm ngoài khung ảnh. Dán chữ đè lên ảnh làm hỏng cả
            hai: ảnh mất một góc, còn chữ thì phải tự chống chọi với nền không
            đoán trước được độ sáng. */}
        <p className="text-xs font-bold uppercase tracking-wide text-secondary">
          {getCategoryName(service, categories)}
        </p>
        <h3 className="mt-1.5 line-clamp-2 text-lg font-bold leading-tight text-on-surface transition-colors group-hover:text-primary">
          {service.name}
        </h3>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-outline-variant/30 pt-3">
          <div className="min-w-0">
            <span
              className={`block text-primary ${isAmount ? "text-lg font-bold tabular-nums" : "text-sm font-semibold"}`}
            >
              {formatServicePrice(priceLabel)}
            </span>
            {priceNote && (
              <span className="mt-0.5 block text-xs text-on-surface-variant">
                {priceNote}
              </span>
            )}
          </div>
          {/* Nút "Xem chi tiết" cũ đã gỡ: cả thẻ vốn đã là một liên kết, nên nút
              đó không mở thêm được gì mà chỉ chiếm chỗ. Ở lưới 3 cột, nó ép cả
              nhãn giá lẫn chính nó xuống hai dòng. Mũi tên giữ lại tín hiệu
              "bấm được" mà không cần một từ nào. */}
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-on-primary">
            <ArrowRight aria-hidden="true" size={20} />
          </span>
        </div>
      </div>
    </Link>
  );
}
