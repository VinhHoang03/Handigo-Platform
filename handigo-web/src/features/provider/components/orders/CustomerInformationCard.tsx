import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { ReliableImage } from '@/components/common/ReliableImage';
import { normalizeImageUrl } from '@/utils/imageUrl';
import type { Order } from '@/types/booking';
import { formatDateTime, getCustomer, getOrderRecipient } from '../../utils/providerOrder.utils';
import { CardTitle } from './CardTitle';
import { CalendarDays, MapPin, Phone, StickyNote, User, Wrench } from "lucide-react";
interface CustomerInformationCardProps {
  order: Order;
  customer: ReturnType<typeof getCustomer>;
  addressLine: string;
  orderType: string;
  showOrderDetails?: boolean;
}

export function CustomerInformationCard({
  order,
  customer,
  addressLine,
  orderType,
  showOrderDetails = true,
}: CustomerInformationCardProps) {
  const recipient = getOrderRecipient(order);
  const contactPhone = recipient.phone.trim();
  const addressNote = order.addressSnapshot?.note?.trim() || order.addressId?.note?.trim();
  const selectedOptions = order.selectedOptionsSnapshot ?? [];
  const details = [
    { icon: User, label: 'Người liên hệ tại địa điểm', value: recipient.fullName },
    { icon: Phone, label: 'Số điện thoại liên hệ', value: contactPhone || 'Chưa cập nhật' },
    { icon: MapPin, label: 'Địa chỉ thực hiện', value: addressLine || 'Chưa cập nhật' },
    ...(showOrderDetails ? [
      ...(addressNote ? [{ icon: StickyNote, label: 'Lưu ý khi đến địa chỉ', value: addressNote }] : []),
      { icon: CalendarDays, label: 'Lịch thực hiện', value: formatDateTime(order.scheduledAt || order.createdAt) },
    ] : []),
  ];

  return (
    <section className="order-1 h-full overflow-hidden rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-md sm:p-lg">
      <CardTitle icon={User} title={showOrderDetails ? "Thông tin khách hàng & yêu cầu" : "Thông tin khách hàng"} />
      <div className="mt-md flex items-center gap-3 rounded-2xl bg-primary/5 p-3">
        <InitialsAvatar
          name={customer?.fullName || 'Khách hàng'}
          src={customer?.avatar}
          className="h-14 w-14 shrink-0"
          rounded="rounded-2xl"
        />
        <div className="min-w-0">
          <p className="text-xs font-medium text-on-surface-variant">Người đặt dịch vụ</p>
          <p className="truncate text-lg font-bold text-on-surface">{customer?.fullName || 'Khách hàng'}</p>
          <span className="mt-1 inline-flex rounded-full bg-surface-container-lowest px-2 py-0.5 text-[11px] font-semibold text-primary">{orderType}</span>
        </div>
      </div>
      {showOrderDetails && (
        <div className="mt-md rounded-2xl border border-primary/10 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <Wrench aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-primary">Tình trạng / vấn đề cần xử lý</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-on-surface">
                {order.problemDescription?.trim() || 'Khách hàng chưa cung cấp mô tả tình trạng.'}
              </p>
            </div>
          </div>
          {selectedOptions.length > 0 && (
            <div className="mt-3 border-t border-primary/10 pt-3">
              <p className="text-xs font-semibold text-on-surface-variant">Hạng mục đã chọn</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedOptions.map((option, index) => (
                  <span key={`${option.optionId || option.name}-${index}`} className="rounded-full bg-surface-container-lowest px-2.5 py-1 text-xs font-semibold text-on-surface">
                    {option.name}{(option.quantity ?? 1) > 1 ? ` ×${option.quantity}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="mt-md grid gap-3 sm:grid-cols-2">
        {details.map((item) => (
          <div key={item.label} className="flex gap-3 rounded-xl bg-surface-container-low px-3 py-3">
            <item.icon aria-hidden="true" size={20} className="mt-0.5 text-primary" />
            <div className="min-w-0">
              <p className="text-xs text-on-surface-variant">{item.label}</p>
              <p className="mt-0.5 break-words text-sm font-semibold text-on-surface">{item.value}</p>
            </div>
          </div>
        ))}
      </div>
      {showOrderDetails && order.customerAttachments?.length ? (
        <div className="mt-md">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-on-surface-variant">Ảnh mô tả</p>
          <div className="grid grid-cols-3 gap-2">
            {order.customerAttachments.map((url, index) => (
              <a key={`${url}-${index}`} href={normalizeImageUrl(url)} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-xl bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                <ReliableImage src={url} alt={`Ảnh mô tả ${index + 1}`} className="h-full w-full object-cover transition-transform hover:scale-105 motion-reduce:transition-none motion-reduce:hover:scale-100" />
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
