import type { Service } from "@/types/booking";

interface ServiceDescriptionSectionProps {
  service: Service;
}

/** Mô tả tổng quan của dịch vụ. */
export function ServiceDescriptionSection({ service }: ServiceDescriptionSectionProps) {
  return (
    <section className="rounded-xl bg-surface-container-lowest p-5 shadow-sm">
      <h2 className="mb-3 text-2xl font-bold">Mô tả dịch vụ</h2>
      <p className="leading-7 text-on-surface-variant">
        {service.description ||
          "Dịch vụ được thiết kế để xử lý nhanh nhu cầu tại nhà, minh bạch về phạm vi công việc và kết nối với provider phù hợp trên Handigo."}
      </p>
    </section>
  );
}
