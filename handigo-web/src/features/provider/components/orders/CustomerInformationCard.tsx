import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { ReliableImage } from '@/components/common/ReliableImage';
import { normalizeImageUrl } from '@/utils/imageUrl';
import type { Order } from '@/types/booking';
import { formatDateTime, getCustomer } from '../../utils/providerOrder.utils';
import { CardTitle } from './CardTitle';
import { CalendarDays, MapPin, Phone, Ticket, User, Wrench } from "lucide-react";
interface CustomerInformationCardProps {
  order: Order;
  customer: ReturnType<typeof getCustomer>;
  addressLine: string;
  addressNote?: string;
  orderType: string;
}

export function CustomerInformationCard({
  order,
  customer,
  addressLine,
  addressNote,
  orderType,
}: CustomerInformationCardProps) {
  const details = [
    { icon: Phone, label: 'Số điện thoại', value: customer?.phone || 'Chưa cập nhật' },
    { icon: MapPin, label: 'Địa chỉ thực hiện', value: addressLine || 'Chưa cập nhật' },
    { icon: Wrench, label: 'Loại dịch vụ', value: order.serviceId?.name || 'Chưa cập nhật' },
    { icon: CalendarDays, label: 'Thời gian đặt lịch', value: formatDateTime(order.scheduledAt || order.createdAt) },
    { icon: Ticket, label: 'Mã đơn hàng', value: order.orderCode },
  ];

  return (
    <section className="order-1 h-full overflow-hidden rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-md sm:p-lg">
      <CardTitle icon={User} title="Thông tin khách hàng" />
      <div className="mt-md flex items-center gap-3 rounded-2xl bg-primary/5 p-3">
        <InitialsAvatar
          name={customer?.fullName || 'Khách hàng'}
          src={customer?.avatar}
          className="h-14 w-14 shrink-0"
          rounded="rounded-2xl"
        />
        <div className="min-w-0">
          <p className="text-xs font-medium text-on-surface-variant">Khách hàng</p>
          <p className="truncate text-lg font-bold text-on-surface">{customer?.fullName || 'Khách hàng'}</p>
          <span className="mt-1 inline-flex rounded-full bg-surface-container-lowest px-2 py-0.5 text-[11px] font-semibold text-primary">{orderType}</span>
        </div>
      </div>
      <div className="mt-md divide-y divide-outline-variant/20">
        {details.map((item) => (
          <div key={item.label} className="flex gap-3 py-3 first:pt-0 last:pb-0">
            <item.icon aria-hidden="true" size={20} className="mt-0.5 text-primary" />
            <div className="min-w-0">
              <p className="text-xs text-on-surface-variant">{item.label}</p>
              <p className="mt-0.5 break-words text-sm font-semibold text-on-surface">{item.value}</p>
            </div>
          </div>
        ))}
      </div>
      {(order.problemDescription || addressNote) && (
        <div className="mt-md rounded-2xl bg-surface-container-low p-3 text-sm">
          {order.problemDescription && <p className="whitespace-pre-wrap text-on-surface"><strong>Mô tả:</strong> {order.problemDescription}</p>}
          {addressNote && <p className="mt-2 whitespace-pre-wrap text-on-surface"><strong>Ghi chú địa chỉ:</strong> {addressNote}</p>}
        </div>
      )}
      {order.customerAttachments?.length ? (
        <div className="mt-md">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-on-surface-variant">Ảnh mô tả</p>
          <div className="grid grid-cols-3 gap-2">
            {order.customerAttachments.map((url, index) => (
              <a key={`${url}-${index}`} href={normalizeImageUrl(url)} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-xl bg-surface-container-low">
                <ReliableImage src={url} alt={`Ảnh mô tả ${index + 1}`} className="h-full w-full object-cover transition hover:scale-105" />
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
