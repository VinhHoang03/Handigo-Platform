import type { Address, Service, ServiceOption } from '../../../types/booking';
import { getOptionPrice } from './useConfirmPaymentFlow';
import { Calendar, CalendarCheck, MapPin, ReceiptText, SprayCan, UserSearch, type LucideIcon } from "lucide-react";

const formatAddress = (address: Address | null) => {
  if (!address) return '';
  return [
    address.detailAddress,
    address.ward,
    address.district,
    address.province,
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ');
};

interface ConfirmPaymentServiceDetailsProps {
  isAppointment: boolean;
  service: Service | null;
  scheduledAt?: string;
  address: Address | null;
  preferredProviderId?: string;
  preferredProviderName?: string;
  selectedOptions: ServiceOption[];
  selectedOptionQuantities?: Record<string, number>;
}

/** Banner lịch hẹn (nếu có) + thẻ "Chi tiết dịch vụ" của bước xác nhận thanh toán. */
export const ConfirmPaymentServiceDetails = ({
  isAppointment, service, scheduledAt, address,
  preferredProviderId, preferredProviderName, selectedOptions, selectedOptionQuantities,
}: ConfirmPaymentServiceDetailsProps) => {
  const addressText = formatAddress(address);
  const detailItems: Array<[LucideIcon, string, string]> = [
    [SprayCan, 'Dịch vụ', service?.name || '…'],
    [
      Calendar,
      'Thời gian',
      scheduledAt
        ? new Date(scheduledAt).toLocaleString('vi-VN')
        : 'Sớm nhất có thể',
    ],
    ...(addressText ? [[MapPin, 'Địa chỉ', addressText] as [LucideIcon, string, string]] : []),
    [
      UserSearch,
      isAppointment && preferredProviderId ? 'Chuyên gia đặt trước' : 'Điều phối chuyên gia',
      preferredProviderId
        ? isAppointment
          ? preferredProviderName || 'Chuyên gia đã chọn'
          : `Yêu cầu trực tiếp ${preferredProviderName || 'provider đã chọn'}`
        : 'Handigo tự điều phối',
    ],
  ];

  return (
    <>
      {isAppointment && (
        <section className="flex items-start gap-sm rounded-xl border border-primary/20 bg-primary-container/10 p-md">
          <CalendarCheck aria-hidden="true" size={24} className="text-primary" />
          <div>
            <h2 className="font-bold text-on-surface">Xác nhận yêu cầu lịch hẹn</h2>
            <p className="mt-1 text-sm leading-6 text-on-surface-variant">
              Handigo chưa thu tiền ở bước này. Chuyên gia sẽ xác nhận lịch trước,
              sau đó bạn có 15 phút để thanh toán và giữ chỗ.
            </p>
          </div>
        </section>
      )}
      <section className="bg-surface-container-lowest rounded-xl p-md border border-outline-variant/30 shadow-sm">
        <h2 className="font-headline-md text-headline-md mb-6 flex items-center gap-2">
          <ReceiptText aria-hidden="true" size={24} className="text-primary" />
          Chi tiết dịch vụ
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {detailItems.map(([Icon, label, value], index) => (
            <div
              key={label}
              className={`flex items-start gap-4 ${index === 2 ? 'md:col-span-2' : ''}`}
            >
              <div className="bg-primary-fixed-dim/30 p-3 rounded-lg text-primary">
                <Icon aria-hidden="true" size={24} />
              </div>
              <div>
                <p className="font-label-md text-label-md text-on-surface-variant">
                  {label}
                </p>
                <p className="font-body-md text-body-md font-semibold">
                  {value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {selectedOptions.length > 0 && (
          <div className="mt-6 pt-6 border-t border-outline-variant">
            <p className="font-label-md text-on-surface-variant mb-3">
              Dịch vụ bổ sung:
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedOptions.map((opt) => (
                <span
                  key={opt._id}
                  className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium tabular-nums"
                >
                  {opt.name}
                  {(selectedOptionQuantities?.[opt._id] ?? 1) > 1 &&
                    ` × ${selectedOptionQuantities?.[opt._id]}`}
                  {service?.serviceType !== 'variable_price' &&
                    ` (${(getOptionPrice(opt) * (selectedOptionQuantities?.[opt._id] ?? 1)).toLocaleString()}đ)`}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
};
