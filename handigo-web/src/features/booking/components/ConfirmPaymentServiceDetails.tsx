import type { Address, Service, ServiceOption } from '../../../types/booking';
import type { ReactNode } from 'react';
import { isAirConditionerCleaning } from '@/utils/airConditionerCleaning';
import { normalizeAddressPart } from '@/features/profile/utils/addressLineParsing.utils';
import { AddressLabelIcon } from '@/features/profile/components/AddressLabelIcon';
import { getOptionPrice } from './useConfirmPaymentFlow';
import { Calendar, CalendarCheck, ReceiptText, SprayCan, UserSearch } from "lucide-react";

const formatAddress = (address: Address | null) => {
  if (!address) return '';
  const parts: string[] = [];

  [
    address.fullAddress || address.detailAddress,
    address.district,
    address.ward,
    address.province,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .forEach((part) => {
      const currentAddress = normalizeAddressPart(parts.join(', '));
      if (!currentAddress.includes(normalizeAddressPart(part))) {
        parts.push(part);
      }
    });

  return parts.join(', ');
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
  uniformQuantity?: number;
}

/** Banner lịch hẹn (nếu có) + thẻ "Chi tiết dịch vụ" của bước xác nhận thanh toán. */
export const ConfirmPaymentServiceDetails = ({
  isAppointment, service, scheduledAt, address,
  preferredProviderId, preferredProviderName, selectedOptions, selectedOptionQuantities, uniformQuantity = 1,
}: ConfirmPaymentServiceDetailsProps) => {
  const addressText = formatAddress(address);
  const addressLabel = address?.addressLabel?.trim() || address?.label?.trim();
  const detailItems: Array<[ReactNode, string, string, boolean?, boolean?]> = [
    [<SprayCan aria-hidden="true" size={20} />, 'Dịch vụ', service?.name || '…'],
    ...(isAirConditionerCleaning(service)
      ? [[<SprayCan aria-hidden="true" size={20} />, 'Số lượng', `${uniformQuantity} máy`] as [ReactNode, string, string]] : []),
    [
      <Calendar aria-hidden="true" size={20} />,
      'Thời gian',
      scheduledAt
        ? new Date(scheduledAt).toLocaleString('vi-VN')
        : 'Chưa chọn thời gian',
    ],
    ...(addressText ? [[
      <AddressLabelIcon label={addressLabel} aria-hidden="true" size={20} />,
      'Địa chỉ',
      addressText,
      true,
      true,
    ] as [ReactNode, string, string, boolean, boolean]] : []),
    [
      <UserSearch aria-hidden="true" size={20} />,
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
              Hoàn tất bước thanh toán để Handigo gửi đơn cho chuyên gia theo lịch đã chọn.
            </p>
          </div>
        </section>
      )}
      <section className="bg-surface-container-lowest rounded-xl p-md border border-outline-variant/30 shadow-sm">
        <h2 className="font-headline-md text-headline-md mb-5 flex items-center gap-2">
          <ReceiptText aria-hidden="true" size={24} className="text-primary" />
          Chi tiết dịch vụ
        </h2>
        <div className="grid md:grid-cols-2 gap-5">
          {detailItems.map(([icon, label, value, hideLabel, wide]) => (
            <div
              key={label}
              className={`flex min-w-0 items-start gap-3 ${wide ? 'md:col-span-2' : ''}`}
            >
              <div className="bg-primary-fixed-dim/30 p-2.5 rounded-lg text-primary">
                {icon}
              </div>
              <div className="min-w-0">
                {!hideLabel && (
                  <p className="font-label-md text-label-md text-on-surface-variant">
                    {label}
                  </p>
                )}
                <p className="break-words font-body-md text-body-md font-semibold leading-6">
                  {value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {selectedOptions.length > 0 && (
          <div className="mt-5 pt-5 border-t border-outline-variant">
            <p className="font-label-md text-on-surface-variant mb-3">
              Tùy chọn dịch vụ:
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
