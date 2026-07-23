import { Link } from "react-router-dom";
import { ReliableImage } from "@/components/common/ReliableImage";
import { getServiceImage } from "@/features/customer-service/utils/serviceDisplay";
import type { Service } from "@/types/booking";
import type { NavbarItem } from "./navbar.types";
import { ChevronDown, LayoutGrid } from "lucide-react";

interface NavbarLinksProps {
  navItems: NavbarItem[];
  isActive: (item: NavbarItem) => boolean;
  services: Service[];
}

/** Thanh liên kết chính trên desktop, gồm mega-menu "Dịch vụ". */
export function NavbarLinks({ navItems, isActive, services }: NavbarLinksProps) {
  return (
    <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-2 xl:flex">
      {navItems.map((item) => {
        const active = isActive(item);
        const isServiceItem = item.activePrefix === "/customer/services";

        if (isServiceItem) {
          return (
            <div key={item.label} className="group relative">
              <Link
                to={item.path}
                className={`flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-primary text-on-primary shadow-[0_8px_18px_rgba(53,37,205,0.18)]"
                    : "text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
                }`}
              >
                {item.label}
                <ChevronDown aria-hidden="true" size={18} className="transition-transform group-hover:rotate-180" />
              </Link>

              <div className="invisible absolute left-1/2 top-full z-50 w-[520px] -translate-x-1/2 translate-y-2 pt-3 opacity-0 transition-all duration-300 ease-out group-hover:visible group-group-hover:opacity-100">
                <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-3 shadow-[0_18px_46px_rgba(19,27,46,0.16)]">
                  <Link
                    to="/customer/services"
                    className="mb-2 flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-on-surface-variant transition hover:bg-surface-container-low hover:text-primary"
                  >
                    <LayoutGrid aria-hidden="true" size={20} />
                    Tất cả dịch vụ
                  </Link>
                  {services.length > 0 ? (
                    <div className="grid grid-cols-3 gap-3">
                      {services.map((service) => (
                        <Link
                          key={service._id}
                          to={`/customer/services/${service._id}`}
                          className="group/card overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-lowest transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                        >
                          <ReliableImage
                            src={getServiceImage(service)}
                            alt={service.name}
                            className="h-20 w-full bg-surface-container object-cover transition duration-300 group-hover/card:scale-105"
                          />
                          <div className="px-3 py-2">
                            <p className="line-clamp-2 min-h-10 text-xs font-semibold leading-5 text-on-surface group-hover/card:text-primary">
                              {service.name}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl px-3 py-3 text-sm text-on-surface-variant">
                      Chưa có dịch vụ khả dụng.
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        }

        return (
          <Link
            key={item.label}
            to={item.path}
            className={`whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
              active
                ? "bg-primary text-on-primary shadow-[0_8px_18px_rgba(53,37,205,0.18)]"
                : "text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
