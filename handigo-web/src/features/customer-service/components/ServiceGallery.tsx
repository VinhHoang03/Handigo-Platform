import { ReliableImage } from "@/components/common/ReliableImage";
import type { Service } from "@/types/booking";
import { getServiceImage } from "../utils/serviceDisplay";

interface ServiceGalleryProps {
  service: Service;
  categoryName: string;
}

/** Ảnh bìa dịch vụ, tên danh mục, tiêu đề và số liệu tin cậy nhanh. */
export function ServiceGallery({ service, categoryName }: ServiceGalleryProps) {
  return (
    <section className="overflow-hidden rounded-xl bg-surface-container-lowest p-5 shadow-sm">
      <div className="mb-5 grid h-[360px] grid-cols-4 grid-rows-2 gap-3">
        <div className="col-span-4 row-span-2 overflow-hidden rounded-lg md:col-span-3">
          <ReliableImage
            src={getServiceImage(service)}
            alt={service.name}
            className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
          />
        </div>
        {[1, 2].map((item) => (
          <div
            key={item}
            className="hidden overflow-hidden rounded-lg bg-surface-container md:block"
          >
            <ReliableImage
              src={getServiceImage(service, item)}
              alt={`${service.name} ${item}`}
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-bold uppercase text-primary">{categoryName}</p>
          <h1 className="mt-2 text-3xl font-bold text-on-background">{service.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-on-surface-variant">
            <span className="flex items-center gap-1">
              <span
                className="material-symbols-outlined text-star-gold"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                star
              </span>
              <b className="text-on-surface">4.8</b>
              (128 đánh giá)
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-primary">verified_user</span>
              300+ đơn hàng thành công
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="grid h-11 w-11 place-items-center rounded-full border border-outline-variant hover:bg-surface-container-low">
            <span className="material-symbols-outlined">share</span>
          </button>
          <button className="grid h-11 w-11 place-items-center rounded-full border border-outline-variant hover:bg-surface-container-low">
            <span className="material-symbols-outlined">favorite</span>
          </button>
        </div>
      </div>
    </section>
  );
}
