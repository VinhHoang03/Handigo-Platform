import { ReliableImage } from '@/components/common/ReliableImage';
import type { Order } from '../../../types/booking';
import { Clock, MapPin } from "lucide-react";

interface BookingSuccessOrderCardProps {
  order: Order;
  addressText: string;
}

export const BookingSuccessOrderCard = ({ order, addressText }: BookingSuccessOrderCardProps) => (
  <section className="md:col-span-2 bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-md shadow-sm">
    <div className="flex justify-between items-start mb-md">
      <div>
        <span className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider">
          Mã đơn hàng
        </span>
        <p className="font-headline-md text-headline-md text-primary">{order.orderCode}</p>
      </div>
      <div className="bg-primary/10 text-primary px-3 py-1 rounded-full font-label-sm">
        {order.status === 'created' ? 'Đang chờ xử lý' : 'Đã xác nhận'}
      </div>
    </div>

    <div className="space-y-md">
      <div className="flex gap-md">
        <ReliableImage
          className="w-24 h-24 rounded-2xl object-cover shadow-sm"
          src={order.serviceId.image}
          alt={order.serviceId.name}
        />
        <div className="flex flex-col justify-center">
          <h2 className="font-headline-md text-headline-md text-on-surface">{order.serviceId.name}</h2>
          <p className="text-on-surface-variant flex items-center gap-xs">
            Loại dịch vụ: {order.serviceId.serviceType === 'fixed_price' ? 'Giá cố định' : 'Báo giá sau'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-md border-t border-outline-variant/30 pt-md">
        <div className="flex items-start gap-sm">
          <div className="p-2 bg-surface-container rounded-lg text-primary">
            <Clock aria-hidden="true" size={24} />
          </div>
          <div>
            <p className="font-label-sm text-on-surface-variant">Thời gian</p>
            <p className="font-label-md text-on-surface">
              {order.scheduledAt ? new Date(order.scheduledAt).toLocaleString('vi-VN') : 'Sớm nhất có thể'}
            </p>
          </div>
        </div>
        {addressText && (
          <div className="flex items-start gap-sm">
            <div className="p-2 bg-surface-container rounded-lg text-primary">
              <MapPin aria-hidden="true" size={24} />
            </div>
            <div>
              <p className="font-label-sm text-on-surface-variant">Địa chỉ</p>
              <p className="font-label-md text-on-surface">{addressText}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  </section>
);
