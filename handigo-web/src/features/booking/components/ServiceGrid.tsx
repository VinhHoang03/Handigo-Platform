import type { Service } from '../../../types/booking';
import { CheckCircle2, Wrench } from "lucide-react";

interface ServiceGridProps {
  services: Service[];
  serviceId?: string;
  onSelect: (serviceId: string) => void;
}

export const ServiceGrid = ({ services, serviceId, onSelect }: ServiceGridProps) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-sm">
    {services.map((service) => (
      <button
        key={service._id}
        onClick={() => onSelect(service._id)}
        className={`relative text-left overflow-hidden rounded-xl bg-surface-container-lowest border border-outline-variant/30 border-2 cursor-pointer group transition-all hover:border-outline-variant ${serviceId === service._id ? 'border-primary bg-primary-container/5' : 'border-transparent'
          }`}
      >
        {serviceId === service._id ? (
          <CheckCircle2 aria-hidden="true" size={24} className="absolute top-3 right-3 z-10 text-primary" fill="currentColor" />
        ) : null}
        <div className="aspect-[5/3] w-full overflow-hidden bg-surface-container-low">
          {service.image ? (
            <img
              src={service.image}
              alt={service.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-primary">
              <Wrench aria-hidden="true" size={36} />
            </div>
          )}
        </div>
        <div className="p-sm">
          <h3 className="font-label-md mb-1 pr-8 leading-snug line-clamp-1">{service.name}</h3>
          <p className="text-xs text-on-surface-variant line-clamp-2 leading-snug">{service.description}</p>
        </div>
      </button>
    ))}
  </div>
);
