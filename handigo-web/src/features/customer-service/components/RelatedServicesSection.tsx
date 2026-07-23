import { Link } from "react-router-dom";
import { ReliableImage } from "@/components/common/ReliableImage";
import type { Service } from "@/types/booking";
import { getServiceImage, money } from "../utils/serviceDisplay";

interface RelatedServicesSectionProps {
  relatedServices: Service[];
}

/** Gợi ý các dịch vụ cùng danh mục để xem tiếp. */
export function RelatedServicesSection({ relatedServices }: RelatedServicesSectionProps) {
  if (relatedServices.length === 0) return null;

  return (
    <section>
      <h2 className="mb-4 text-2xl font-bold">Dịch vụ liên quan</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {relatedServices.map((item) => (
          <Link
            key={item._id}
            to={`/customer/services/${item._id}`}
            className="group overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest transition hover:shadow-md"
          >
            <ReliableImage
              src={getServiceImage(item)}
              alt={item.name}
              className="h-32 w-full object-cover"
            />
            <div className="p-4">
              <h3 className="font-bold text-on-surface group-hover:text-primary">
                {item.name}
              </h3>
              <p className="mt-1 text-sm font-bold tabular-nums text-primary">
                {item.serviceType === "fixed_price" && item.fixedPrice
                  ? money.format(item.fixedPrice)
                  : "Xem chi tiết"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
